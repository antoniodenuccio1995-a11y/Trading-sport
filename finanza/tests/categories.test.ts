import { afterEach, describe, expect, it } from "vitest";
import type { Line, MovementType, Snapshot } from "../src/domain/types.ts";
import {
  categoryGroupId, configureCategories, defaultCategories, defaultGroupId, DEFAULT_GROUP_LABELS, GROUPS, groupOf, isDefaultCategory,
} from "../src/domain/categories.ts";
import { budgetStatus, cashflowSankey, categoryBreakdown } from "../src/analytics/index.ts";
import { categoryLookup, groupLookup } from "../src/analytics/common.ts";
import { emptySnapshot } from "../src/state/defaults.ts";
import { makeMovement } from "../src/domain/movement.ts";
import {
  addCategory, applyCategoryPatch, cleanIcon, mergeCategoryInto, mergeImpact, newCategoryId, setGroupLabel, slugOf,
} from "../src/state/categoryActions.ts";

let seq = 0;
function mk(date: string, amount: number, categoryId: string, type?: MovementType): Line {
  const id = "q" + ++seq;
  return {
    id, parentId: id, account: "Banca", date, month: date.slice(0, 7), amount, type: type ?? (amount < 0 ? "expense" : "income"),
    categoryId, counterparty: "", description: "X", merchant: "X", isSplit: false, unbalanced: false, deferredWallet: false,
  };
}
/** Categorie predefinite con Ristorazione spostata dal titolare in "cibo" e Viaggi in "mobilita". */
const moved = () => defaultCategories().map((c) =>
  c.id === "exp.dining" ? { ...c, group: "cibo" } : c.id === "exp.travel" ? { ...c, group: "mobilita" } : c);
const october = [
  mk("2026-10-27", 2000, "inc.salary"),
  mk("2026-10-03", -300, "exp.groceries"), mk("2026-10-04", -100, "exp.dining"), mk("2026-10-05", -250, "exp.travel"),
  mk("2026-10-06", -50, "exp.leisure"),
];

afterEach(() => configureCategories([], {}));

describe("gruppi predefiniti", () => {
  it("Ristorazione è svago; 7 gruppi con nomi leggibili e colori fissi", () => {
    expect(groupOf("exp.dining").id).toBe("svago");
    expect(groupOf("exp.groceries").id).toBe("cibo");
    expect(groupOf("exp.u_qualcosa").id).toBe("altro");
    expect(GROUPS.map((g) => g.id)).toEqual(["casa", "cibo", "svago", "persona", "crescita", "mobilita", "altro"]);
    expect(GROUPS.find((g) => g.id === "cibo")!.label).toBe("Spesa alimentare");
    expect(GROUPS.find((g) => g.id === "svago")!.label).toBe("Svago e uscite");
    expect(new Set(GROUPS.map((g) => g.slot)).size).toBe(7);
    expect(GROUPS.every((g) => g.slot !== 3 && g.slot !== 8)).toBe(true);
  });
});

describe("registro configureCategories", () => {
  it("groupOf segue Category.group; un gruppo non valido viene ignorato", () => {
    configureCategories([...moved(), { id: "exp.other", group: "inesistente" }], {});
    expect(groupOf("exp.dining").id).toBe("cibo");
    expect(groupOf("exp.travel").id).toBe("mobilita");
    expect(groupOf("exp.other").id).toBe("altro");
    configureCategories(defaultCategories(), {});
    expect(groupOf("exp.dining").id).toBe("svago"); // senza scelta torna al predefinito
  });

  it("nomi dei gruppi da Settings.groupLabels, vuoto = predefinito", () => {
    configureCategories([], { svago: "  Uscite e divertimento ", cibo: "  " });
    expect(GROUPS.find((g) => g.id === "svago")!.label).toBe("Uscite e divertimento");
    expect(GROUPS.find((g) => g.id === "cibo")!.label).toBe(DEFAULT_GROUP_LABELS.cibo);
    expect(groupOf("exp.dining").label).toBe("Uscite e divertimento");
    configureCategories([], {});
    expect(GROUPS.find((g) => g.id === "svago")!.label).toBe(DEFAULT_GROUP_LABELS.svago);
  });

  it("categoryGroupId e lookup delle analisi usano le categorie passate", () => {
    const cats = moved();
    expect(categoryGroupId(cats.find((c) => c.id === "exp.dining")!)).toBe("cibo");
    expect(categoryLookup(cats)("exp.dining").groupId).toBe("cibo");
    expect(groupLookup(cats)("exp.travel").id).toBe("mobilita");
    expect(groupLookup()("exp.travel").id).toBe("svago"); // registro non configurato: predefinito
    configureCategories(cats, {});
    expect(groupLookup()("exp.travel").id).toBe("mobilita");
  });
});

describe("le analisi contano la categoria nel gruppo scelto", () => {
  it("categoryBreakdown", () => {
    const base = categoryBreakdown(october, "2026-10", defaultCategories());
    expect(base.groups.find((g) => g.id === "svago")).toMatchObject({ total: 400, categoryIds: ["exp.travel", "exp.dining", "exp.leisure"] });
    expect(base.groups.find((g) => g.id === "cibo")!.total).toBe(300);
    const b = categoryBreakdown(october, "2026-10", moved());
    expect(b.groups.find((g) => g.id === "cibo")).toMatchObject({ total: 400, categoryIds: ["exp.groceries", "exp.dining"] });
    expect(b.groups.find((g) => g.id === "mobilita")).toMatchObject({ total: 250, categoryIds: ["exp.travel"] });
    expect(b.groups.find((g) => g.id === "svago")).toMatchObject({ total: 50, categoryIds: ["exp.leisure"] });
    expect(b.categories.find((c) => c.id === "exp.dining")!.groupId).toBe("cibo");
    expect(b.groups.reduce((s, g) => s + g.total, 0)).toBeCloseTo(b.total);
  });

  it("categoryBreakdown usa i nomi dei gruppi del titolare", () => {
    configureCategories(moved(), { mobilita: "Spostamenti" });
    const b = categoryBreakdown(october, "2026-10", moved());
    expect(b.groups.find((g) => g.id === "mobilita")!.label).toBe("Spostamenti");
  });

  it("cashflowSankey", () => {
    const s = cashflowSankey(october, "2026-10", moved(), { categoriesPerGroup: 3 });
    expect(s.nodes.find((n) => n.id === "grp:cibo")!.value).toBe(400);
    expect(s.nodes.find((n) => n.id === "grp:mobilita")!.value).toBe(250);
    expect(s.nodes.find((n) => n.id === "grp:svago")!.value).toBe(50);
    expect(s.links.find((l) => l.target === "cat:exp.dining")!.source).toBe("grp:cibo");
    const slot = GROUPS.find((g) => g.id === "cibo")!.slot;
    expect(s.nodes.find((n) => n.id === "cat:exp.dining")!.slot).toBe(slot);
  });

  it("budgetStatus: gruppo della voce e categorie nascoste fuori dal budget", () => {
    const budgets = { default: { "exp.dining": 150, "exp.leisure": 80 }, months: {} };
    const cats = moved().map((c) => (c.id === "exp.leisure" ? { ...c, status: "inactive" as const } : c));
    const b = budgetStatus(october, budgets, "2026-10", "2026-10-31", cats);
    expect(b.items.map((i) => [i.categoryId, i.groupId])).toEqual([["exp.dining", "cibo"]]);
    expect(b.unbudgetedSpent).toBe(600); // spesa, viaggi e svago nascosto
  });
});

describe("azioni sulle categorie", () => {
  const snap = (): Snapshot => {
    const s = emptySnapshot();
    s.movements = [
      makeMovement({ id: "m1", account: "Banca", date: "2026-10-01", description: "PIZZERIA", amount: -30, type: "expense", categoryId: "exp.dining" }),
      makeMovement({ id: "m2", account: "Banca", date: "2026-10-02", description: "MISTO", amount: -50, type: "expense", categoryId: "",
        splits: [
          { id: "p1", amount: -20, type: "expense", categoryId: "exp.dining", counterparty: "", description: "" },
          { id: "p2", amount: -30, type: "expense", categoryId: "exp.groceries", counterparty: "", description: "" },
        ] }),
      makeMovement({ id: "m3", account: "Banca", date: "2026-10-03", description: "VECCHIO", amount: -10, type: "expense", categoryId: "exp.dining", deletedAt: "2026-10-04" }),
      makeMovement({ id: "m4", account: "Banca", date: "2026-10-04", description: "CONAD", amount: -40, type: "expense", categoryId: "exp.groceries" }),
    ];
    s.budgets = { default: { "exp.dining": 130, "exp.leisure": 40 }, months: { "2026-10": { "exp.dining": 200 }, "2026-11": { "exp.leisure": 60 } } };
    return s;
  };

  it("id nuovi unici, icona di un solo simbolo", () => {
    const s = emptySnapshot();
    expect(slugOf("Caffè & Bar")).toBe("caffe_bar");
    expect(newCategoryId(s, "expense", "Caffè & Bar")).toBe("exp.u_caffe_bar");
    const a = addCategory(s, { direction: "expense", label: "Caffè & Bar", icon: "☕ tazza", group: "svago" });
    const b = addCategory(s, { direction: "expense", label: "Caffe bar" });
    const c = addCategory(s, { direction: "income", label: "Affitti incassati" });
    expect([a, b, c]).toEqual(["exp.u_caffe_bar", "exp.u_caffe_bar_2", "inc.u_affitti_incassati"]);
    expect(addCategory(s, { direction: "expense", label: "   " })).toBe("");
    const ca = s.categories.find((x) => x.id === a)!;
    expect(ca).toMatchObject({ icon: "☕", group: "svago", status: "active", budgetEligible: true, direction: "expense" });
    expect(s.categories.find((x) => x.id === b)!.group).toBeUndefined(); // "altro" è già il predefinito
    expect(s.categories.find((x) => x.id === c)!.budgetEligible).toBe(false);
    expect(cleanIcon("🧑‍💻x")).toBe("🧑‍💻");
    expect(isDefaultCategory("exp.dining")).toBe(true);
    expect(isDefaultCategory(a)).toBe(false);
  });

  it("modifiche: nome, icona, gruppo (predefinito = nessuna scelta), nascosta e ripristino dello stato", () => {
    const s = emptySnapshot();
    expect(applyCategoryPatch(s, "exp.dining", { label: "  Uscite a cena ", icon: "🍕", group: "cibo", budgetEligible: false })).toBe(true);
    const d = s.categories.find((c) => c.id === "exp.dining")!;
    expect(d).toMatchObject({ label: "Uscite a cena", icon: "🍕", group: "cibo", budgetEligible: false });
    applyCategoryPatch(s, "exp.dining", { group: defaultGroupId("exp.dining"), label: "" });
    expect(d.group).toBeUndefined();
    expect(d.label).toBe("Uscite a cena"); // nome vuoto ignorato
    applyCategoryPatch(s, "exp.betting", { active: false });
    const bet = s.categories.find((c) => c.id === "exp.betting")!;
    expect(bet.status).toBe("inactive");
    applyCategoryPatch(s, "exp.betting", { active: true });
    expect(bet.status).toBe("conditional");
    applyCategoryPatch(s, "inc.salary", { group: "casa", budgetEligible: true });
    expect(s.categories.find((c) => c.id === "inc.salary")).toMatchObject({ budgetEligible: false });
    expect(s.categories.find((c) => c.id === "inc.salary")!.group).toBeUndefined();
    expect(applyCategoryPatch(s, "exp.nessuna", { label: "x" })).toBe(false);
  });

  it("unione: movimenti, quote, regole e budget passano alla destinazione; la predefinita resta nascosta", () => {
    const s = snap();
    s.rules.push({ id: "r1", account: "", contains: "PIZZERIA", sign: "-", type: "expense", categoryId: "exp.dining", counterparty: "", priority: 50, active: true });
    const rulesBefore = s.rules.filter((r) => r.categoryId === "exp.dining").length;
    expect(mergeImpact(s, "exp.dining")).toEqual({ movements: 2, splits: 1, rules: rulesBefore, budgets: 2 });
    const r = mergeCategoryInto(s, "exp.dining", "exp.leisure")!;
    expect(r).toMatchObject({ movements: 2, splits: 1, removed: false });
    expect(s.movements.map((m) => m.categoryId)).toEqual(["exp.leisure", "", "exp.leisure", "exp.groceries"]);
    expect(s.movements[1].splits.map((p) => p.categoryId)).toEqual(["exp.leisure", "exp.groceries"]);
    expect(s.rules.some((x) => x.categoryId === "exp.dining")).toBe(false);
    expect(s.rules.find((x) => x.id === "r1")!.categoryId).toBe("exp.leisure");
    // predefinito 130 + 40; ottobre 200 + 40 (predefinito di Svago); novembre 130 (predefinito di Ristorazione) + 60
    expect(s.budgets).toEqual({ default: { "exp.leisure": 170 }, months: { "2026-10": { "exp.leisure": 240 }, "2026-11": { "exp.leisure": 190 } } });
    expect(s.categories.find((c) => c.id === "exp.dining")!.status).toBe("inactive");
  });

  it("unione: una categoria creata dal titolare viene eliminata; direzioni diverse rifiutate", () => {
    const s = snap();
    const id = addCategory(s, { direction: "expense", label: "Pizza" });
    s.movements[3].categoryId = id;
    const r = mergeCategoryInto(s, id, "exp.dining")!;
    expect(r.removed).toBe(true);
    expect(s.categories.some((c) => c.id === id)).toBe(false);
    expect(s.movements[3].categoryId).toBe("exp.dining");
    expect(mergeCategoryInto(s, "exp.dining", "inc.salary")).toBeNull();
    expect(mergeCategoryInto(s, "exp.dining", "exp.dining")).toBeNull();
  });

  it("nomi dei gruppi: salvati, ripristinati con vuoto o nome predefinito", () => {
    const s = emptySnapshot();
    setGroupLabel(s, "svago", " Divertimento ");
    setGroupLabel(s, "nessuno", "x");
    expect(s.settings.groupLabels).toEqual({ svago: "Divertimento" });
    setGroupLabel(s, "svago", DEFAULT_GROUP_LABELS.svago);
    expect(s.settings.groupLabels).toEqual({});
  });
});
