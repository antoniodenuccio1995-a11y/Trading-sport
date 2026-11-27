import { describe, expect, it } from "vitest";
import { applyRemote, diff, hashOf, rid, stable, type RemoteRow } from "../src/sync/records.ts";
import { emptySnapshot } from "../src/state/defaults.ts";
import { makeMovement } from "../src/domain/movement.ts";
import type { Snapshot } from "../src/domain/types.ts";

/** Server finto con la stessa semantica di fp_records (upsert per chiave, ora del server, jsonb che riordina le chiavi). */
class FakeServer {
  rows = new Map<string, RemoteRow>();
  t = 0;
  jsonb(v: unknown): unknown {
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map((x) => this.jsonb(x));
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort((a, b) => a.length - b.length || (a < b ? -1 : 1));
    return Object.fromEntries(keys.map((k) => [k, this.jsonb(o[k])]));
  }
  upsert(rows: { kind: RemoteRow["kind"]; key: string; value: unknown; deleted: boolean }[]) {
    for (const r of rows) this.rows.set(rid(r.kind, r.key), { ...r, value: this.jsonb(JSON.parse(JSON.stringify(r.value ?? null))), updated_at: new Date(Date.UTC(2026, 0, 1) + ++this.t * 1000).toISOString() });
  }
  since(iso: string) { return [...this.rows.values()].filter((r) => r.updated_at > iso).sort((a, b) => a.updated_at.localeCompare(b.updated_at)); }
}

class Device {
  s: Snapshot = emptySnapshot();
  synced = new Map<string, string>();
  cursor = "1970-01-01T00:00:00Z";
  constructor(public server: FakeServer) {}
  push() {
    const d = diff(this.s, this.synced);
    this.server.upsert([...d.upserts.map((r) => ({ ...r, deleted: false })), ...d.deletes.map((r) => ({ ...r, value: null, deleted: true }))]);
    for (const r of d.upserts) this.synced.set(rid(r.kind, r.key), d.hashes.get(rid(r.kind, r.key))!);
    for (const r of d.deletes) this.synced.delete(rid(r.kind, r.key));
    return d;
  }
  pull() {
    const rows = this.server.since(this.cursor);
    const local = diff(this.s, this.synced).hashes;
    const n = applyRemote(this.s, rows, this.synced, local);
    if (rows.length) this.cursor = rows[rows.length - 1].updated_at;
    return n;
  }
  sync() { const n = this.pull(); this.push(); return n; }
  /** Primo collegamento di un dispositivo nuovo: prende ciò che c'è nel cloud (come takeCloud nel motore). */
  link() {
    const rows = this.server.since(this.cursor);
    this.s = emptySnapshot(); this.s.categories = []; this.s.accounts = []; this.s.rules = [];
    applyRemote(this.s, rows, this.synced);
    if (rows.length) this.cursor = rows[rows.length - 1].updated_at;
  }
}

const mv = (id: string, amount: number) => makeMovement({ id, account: "Revolut", date: "2026-03-01", description: "TEST " + id, amount, type: "expense", categoryId: "exp.groceries" });

describe("impronte stabili", () => {
  it("non dipendono dall'ordine delle chiavi né dai campi undefined", () => {
    expect(hashOf({ a: 1, b: { c: 2, d: [1, { e: 3 }] } })).toBe(hashOf({ b: { d: [1, { e: 3 }], c: 2 }, a: 1, z: undefined }));
    expect(stable({ b: 1, a: [2] })).toBe('{"a":[2],"b":1}');
  });
});

describe("sincronizzazione tra due dispositivi", () => {
  it("il primo invio carica tutto, poi solo ciò che cambia", () => {
    const srv = new FakeServer(), a = new Device(srv);
    a.s.movements = [mv("1", -10), mv("2", -20)];
    const first = a.push();
    expect(first.upserts.length).toBeGreaterThan(30); // movimenti + categorie + conti + regole + budget + impostazioni
    expect(a.push().upserts).toHaveLength(0);
    a.s.movements[0].categoryId = "exp.dining";
    expect(a.push().upserts.map((r) => r.key)).toEqual(["1"]);
  });

  it("un altro dispositivo riceve, modifica e rimanda; nessun rimbalzo dovuto al riordino jsonb", () => {
    const srv = new FakeServer(), a = new Device(srv), b = new Device(srv);
    a.s.movements = [mv("1", -10), mv("2", -20)];
    a.s.settings.ownerNames = ["MARIO ROSSI"];
    a.sync();
    b.link();
    expect(b.s.movements.map((m) => m.id).sort()).toEqual(["1", "2"]);
    expect(b.s.settings.ownerNames).toEqual(["MARIO ROSSI"]);
    expect(b.push().upserts).toHaveLength(0); // i valori tornati dal "jsonb" non sembrano modifiche
    b.s.movements.find((m) => m.id === "2")!.note = "spesa grossa";
    b.sync();
    expect(a.sync()).toBe(1);
    expect(a.s.movements.find((m) => m.id === "2")!.note).toBe("spesa grossa");
    expect(a.push().upserts).toHaveLength(0);
  });

  it("le cancellazioni si propagano e le preferenze del dispositivo restano locali", () => {
    const srv = new FakeServer(), a = new Device(srv), b = new Device(srv);
    a.s.movements = [mv("1", -10), mv("2", -20)];
    a.sync(); b.link();
    a.s.movements = a.s.movements.filter((m) => m.id !== "1");
    a.s.settings.theme = "light";
    a.sync(); b.sync();
    expect(b.s.movements.map((m) => m.id)).toEqual(["2"]);
    expect(b.s.settings.theme).toBe("auto");
  });

  it("una cancellazione locale non ancora inviata non viene annullata dallo scaricamento", () => {
    const srv = new FakeServer(), a = new Device(srv);
    a.s.movements = [mv("1", -10), mv("2", -20)];
    a.push();
    a.s.movements = a.s.movements.filter((m) => m.id !== "1");
    a.pull(); // il cursore è ancora all'inizio: riceve anche il movimento 1
    expect(a.s.movements.map((m) => m.id)).toEqual(["2"]);
  });

  it("una modifica locale non ancora inviata vince su quella remota", () => {
    const srv = new FakeServer(), a = new Device(srv), b = new Device(srv);
    a.s.movements = [mv("1", -10)];
    a.sync(); b.link();
    b.s.movements[0].note = "da B"; b.sync();
    a.s.movements[0].note = "da A";
    a.pull();
    expect(a.s.movements[0].note).toBe("da A");
    a.push(); b.sync();
    expect(b.s.movements[0].note).toBe("da A");
  });

  it("budget mensili e conti nuovi arrivano all'altro dispositivo", () => {
    const srv = new FakeServer(), a = new Device(srv), b = new Device(srv);
    a.sync(); b.link();
    a.s.budgets.months["2026-11"] = { "exp.dining": 200 };
    a.s.accounts.push({ id: "Conto Nuovo", name: "Conto Nuovo", kind: "bank", initialBalance: 100, initialDate: "", color: "#123456", archived: false });
    a.sync(); b.sync();
    expect(b.s.budgets.months["2026-11"]).toEqual({ "exp.dining": 200 });
    expect(b.s.accounts.find((x) => x.id === "Conto Nuovo")?.initialBalance).toBe(100);
  });

  it("investimenti: strumenti, operazioni e prezzi arrivano all'altro dispositivo", () => {
    const srv = new FakeServer(), a = new Device(srv), b = new Device(srv);
    a.sync(); b.link();
    a.s.investments = { instruments: [{ id: "i1", name: "ETF Mondo", kind: "etf", isin: "IE00B4L5Y983", currency: "EUR" }],
      trades: [{ id: "t1", date: "2026-03-01", instrumentId: "i1", account: "Trade Republic", side: "buy", quantity: 2, price: 100, fees: 1, amount: -201 }],
      prices: { i1: { price: 110, currency: "EUR", at: "2026-11-27T10:00:00Z", source: "manuale" } } };
    a.sync(); b.sync();
    expect(b.s.investments?.instruments.map((i) => i.id)).toEqual(["i1"]);
    expect(b.s.investments?.trades[0].quantity).toBe(2);
    expect(b.s.investments?.prices.i1.price).toBe(110);
    expect(b.push().upserts).toHaveLength(0);
    a.s.investments!.trades = [];
    a.sync(); b.sync();
    expect(b.s.investments?.trades).toHaveLength(0);
  });

  it("calcolo delle differenze veloce su 10.000 movimenti", () => {
    const s = emptySnapshot();
    s.movements = Array.from({ length: 10000 }, (_, i) => mv(String(i), -i));
    const t0 = performance.now();
    const d = diff(s, new Map());
    const t1 = performance.now();
    const again = diff(s, d.hashes);
    const t2 = performance.now();
    expect(again.upserts).toHaveLength(0);
    expect(t1 - t0).toBeLessThan(1500);
    expect(t2 - t1).toBeLessThan(1500);
  });
});
