import { useState } from "preact/hooks";
import { getSnap, months } from "../../state/store.ts";
import * as D from "../../state/derived.ts";
import * as A from "../../state/actions.ts";
import { groupOf, GROUPS } from "../../domain/categories.ts";
import { Icon } from "../icons.tsx";
import { Ring } from "../charts/Shapes.tsx";
import { CountUp } from "../charts/base.tsx";
import { Seg, toast } from "../components/common.tsx";
import { addMonths, cap, eur, monthLabel, parseAmount, pct } from "../format.ts";

const C = (st: string) => (st === "sforato" ? "var(--bad)" : st === "attenzione" ? "var(--warn)" : "var(--good)");
const LBL: Record<string, string> = { ok: "Nei limiti", attenzione: "Attenzione", sforato: "Sforato" };

export function BudgetView() {
  const s = getSnap();
  const ms = months();
  const [month, setMonth] = useState(D.currentMonth());
  const [scope, setScope] = useState<"month" | "default">("month");
  const b = D.budget(month);
  const bd = D.breakdown(month);
  const spentBy = new Map(bd.categories.map((c) => [c.id, c]));
  const items = new Map(b.items.map((x) => [x.categoryId, x]));
  const cats = s.categories.filter((c) => c.direction === "expense" && c.budgetEligible && c.status === "active");
  const planned = (id: string) => (scope === "default" ? s.budgets.default[id] : (s.budgets.months[month]?.[id] ?? s.budgets.default[id]));
  const isOverride = (id: string) => s.budgets.months[month]?.[id] != null;
  const nav = (n: number) => setMonth(addMonths(month, n));
  const elapsed = b.daysTotal ? b.daysElapsed / b.daysTotal : 0;

  return (
    <div class="stack enter">
      <div class="grid g-hero">
        <div class="card hero">
          <div class="row between">
            <button class="icon-btn" onClick={() => nav(-1)} aria-label="Mese precedente"><Icon name="left" /></button>
            <div style={{ textAlign: "center" }}><div class="eyebrow">Budget</div><b style={{ fontSize: "16px" }}>{cap(monthLabel(month))}</b></div>
            <button class="icon-btn" onClick={() => nav(1)} aria-label="Mese successivo"><Icon name="right" /></button>
          </div>
          <div class="row wrap" style={{ gap: "22px", marginTop: "18px", alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <Ring pct={b.totals.pct ?? 0} size={132} stroke={12} color={C(b.totals.status)} />
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
                <div><div style={{ fontSize: "24px", fontWeight: 760 }}>{b.totals.pct != null ? pct(b.totals.pct) : "—"}</div><div class="faint" style={{ fontSize: "11px" }}>usato</div></div>
              </div>
            </div>
            <div class="stack" style={{ gap: "6px", flex: 1, minWidth: "200px" }}>
              <div><span class="mid"><CountUp value={b.totals.spent} format={eur} /></span> <span class="faint">di {eur(b.totals.budget)}</span></div>
              <div class="row wrap" style={{ gap: "6px" }}>
                <span class={"tag " + (b.totals.status === "ok" ? "good" : b.totals.status === "attenzione" ? "warn" : "bad")}>{LBL[b.totals.status]}</span>
                <span class="tag">Restano {eur(Math.max(0, b.totals.remaining))}</span>
                <span class="tag">A fine mese ≈ {eur(b.totals.projected)}</span>
              </div>
              <div class="faint" style={{ fontSize: "12.5px" }}>Giorno {b.daysElapsed} di {b.daysTotal}: a questo punto del mese il ritmo atteso è {eur(b.totals.expectedAtToday)}.
                {b.unbudgetedSpent > 0 && <> Fuori budget: {eur(b.unbudgetedSpent)}.</>}</div>
            </div>
          </div>
        </div>
        <div class="card">
          <h2>Come funziona</h2>
          <p class="hint" style={{ lineHeight: 1.6 }}>Il <b>valore predefinito</b> vale per tutti i mesi; puoi cambiarlo per un singolo mese. La linea verticale su ogni barra indica dove dovresti essere oggi spendendo in modo regolare; la proiezione usa lo storico della categoria quando c'è.</p>
          <div class="row wrap" style={{ gap: "8px" }}>
            <Seg value={scope} onChange={setScope} options={[["month", "Modifica " + monthLabel(month).split(" ")[0]], ["default", "Modifica predefinito"]]} />
            {ms.includes(addMonths(month, -1)) && <button class="btn sm" onClick={() => { A.copyBudgetMonth(addMonths(month, -1), month); toast("Budget copiato dal mese prima"); }}>Copia dal mese prima</button>}
          </div>
        </div>
      </div>

      {GROUPS.map((g) => {
        const gc = cats.filter((c) => groupOf(c.id).id === g.id);
        if (!gc.length) return null;
        return (
          <div class="card" key={g.id}>
            <h2><i class="swatch" style={{ background: `var(--s${g.slot})`, width: "11px", height: "11px" }} />{g.icon} {g.label}</h2>
            <div class="stack" style={{ gap: "14px", marginTop: "12px" }}>
              {gc.map((c) => {
                const it = items.get(c.id), sp = spentBy.get(c.id)?.total ?? 0, plan = planned(c.id);
                const avg = spentBy.get(c.id)?.avg6?.base;
                return (
                  <div key={c.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 120px", gap: "6px 14px", alignItems: "center" }}>
                    <div class="row between" style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.icon} {c.label}</span>
                      <span class="money faint" style={{ fontSize: "12.5px", whiteSpace: "nowrap" }}>{eur(sp)}{it ? ` / ${eur(it.budget)}` : ""}</span>
                    </div>
                    <BudgetInput value={plan} override={scope === "month" && isOverride(c.id)} onSave={(v) => A.setBudget(c.id, v, scope === "month" ? month : undefined)} />
                    <div style={{ gridColumn: "1 / 2" }}>
                      {it ? (
                        <>
                          <div class="bar" style={{ position: "relative", overflow: "visible" }}>
                            <span style={{ width: Math.min(100, it.pct * 100) + "%", background: C(it.status) }} />
                            {elapsed > 0 && elapsed < 1 && <i style={{ position: "absolute", top: "-3px", bottom: "-3px", left: elapsed * 100 + "%", width: "2px", background: "var(--text-2)", borderRadius: "2px" }} />}
                          </div>
                          <div class="row between faint" style={{ fontSize: "11.5px", marginTop: "4px" }}>
                            <span>{it.remaining >= 0 ? `restano ${eur(it.remaining)}` : <span class="bad">oltre di {eur(-it.remaining)}</span>}</span>
                            <span>a fine mese ≈ {eur(it.projected)}{avg ? ` · media ${eur(avg)}` : ""}</span>
                          </div>
                        </>
                      ) : <div class="faint" style={{ fontSize: "11.5px" }}>{avg ? `Nessun budget · media 6 mesi ${eur(avg)}` : "Nessun budget"}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BudgetInput({ value, override, onSave }: { value: number | undefined; override: boolean; onSave: (v: number | null) => void }) {
  const [v, setV] = useState<string | null>(null);
  const shown = v ?? (value != null ? String(value).replace(".", ",") : "");
  const commit = () => {
    if (v == null) return;
    const t = v.trim();
    const n = parseAmount(t);
    onSave(t === "" ? null : Number.isFinite(n) ? n : null);
    setV(null);
  };
  return (
    <div style={{ position: "relative" }}>
      <input class="input" style={{ width: "100%", textAlign: "right", paddingRight: "26px", borderColor: override ? "color-mix(in srgb, var(--accent) 60%, transparent)" : undefined }}
        inputMode="decimal" placeholder="—" value={shown} aria-label="Budget mensile"
        onInput={(e) => setV((e.target as HTMLInputElement).value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
      <span class="faint" style={{ position: "absolute", right: "10px", top: "8px", fontSize: "12.5px" }}>€</span>
    </div>
  );
}
