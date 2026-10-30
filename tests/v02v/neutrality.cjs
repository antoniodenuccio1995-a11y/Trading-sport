"use strict";
const fs = require("fs"),
  vm = require("vm"),
  path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const html = fs.readFileSync(
  path.join(ROOT, "Trading_Analytics_v0.2U-rc5_TA-INT-004.html"),
  "utf8",
);
const start = html.indexOf("function reviewerPeriod("),
  end = html.indexOf("function renderMarketReviewer(", start);
const context = {};
vm.createContext(context);
vm.runInContext(html.slice(start, end), context);
const markets = {
  o15: (r) => r.h + r.a > 1,
  o25: (r) => r.h + r.a > 2,
  u25: (r) => r.h + r.a < 3,
  btts: (r) => r.h > 0 && r.a > 0,
  ht: (r) => (r.ht == null ? null : r.ht > 0),
  draw: (r) => r.h === r.a,
  home: (r) => r.h > r.a,
  away: (r) => r.a > r.h,
};
function input() {
  const rows = [];
  for (const code of ["I1", "SP1"])
    for (const year of [2021, 2022, 2023, 2024, 2025]) {
      const f = path.join(ROOT, `histories/stab003/${code}_${year}.json`);
      if (!fs.existsSync(f)) continue;
      for (const x of JSON.parse(fs.readFileSync(f)).records) {
        if (!x[7] && x[8]?.HistProvider === "Football-Data")
          rows.push({
            d: x[0],
            lg: x[1],
            H: x[2],
            A: x[3],
            h: x[4],
            a: x[5],
            ht: x[6],
            up: x[7],
            o: x[8],
          });
      }
    }
  return rows.sort((a, b) => a.d - b.d);
}
function diagnose(engine) {
  const all = input(),
    out = {
      baseline: "bf2f0cc",
      ruleSelectionPeriod: "2024/25",
      heldOutPeriod: "2025/26",
      rulesFrozen: true,
      periods: {},
      observations: [],
    };
  for (const year of [2024, 2025]) {
    const table = {};
    for (const k of Object.keys(markets))
      table[k] = {
        positive: 0,
        negative: 0,
        neutral: 0,
        mixed: 0,
        missing: 0,
        other: 0,
      };
    const modern = {},
      baselineMetrics = {};
    let fixtures = 0;
    for (const r of all.filter((x) => x.o.CsvSeason === year)) {
      fixtures++;
      const prev = all.filter((x) => x.lg === r.lg && x.d < r.d);
      for (const [key, fn] of Object.entries(markets)) {
        const stat = (xs) => {
          const vs = xs.map(fn).filter((v) => v !== null);
          return {
            n: vs.length,
            w: vs.filter(Boolean).length,
            p: vs.length ? (100 * vs.filter(Boolean).length) / vs.length : null,
          };
        };
        const ev = {};
        for (const [phase, tag] of [
          ["old", "o"],
          ["now", "n"],
        ]) {
          const subset = prev.filter((x) =>
            phase === "old" ? x.o.CsvSeason < year : x.o.CsvSeason === year,
          );
          ev[tag + "h"] = stat(subset.filter((x) => x.H === r.H));
          ev[tag + "a"] = stat(subset.filter((x) => x.A === r.A));
          ev["l" + tag] = stat(subset);
        }
        const result = context.reviewerHeadline(
          context.reviewerPeriod(ev, "old"),
          context.reviewerPeriod(ev, "now"),
        );
        table[key][
          Object.hasOwn(table[key], result.kind) ? result.kind : "other"
        ]++;
        baselineMetrics[key] ??= {
          evaluated: 0,
          events: 0,
          selected: 0,
          selectedHit: 0,
          falsePositive: 0,
          unselectedEvent: 0,
        };
        const y = fn(r);
        if (y !== null) {
          const b = baselineMetrics[key];
          b.evaluated++;
          b.events += Number(y);
          if (result.kind === "positive") {
            b.selected++;
            b.selectedHit += Number(y);
            b.falsePositive += Number(!y);
          } else b.unselectedEvent += Number(y);
        }
      }
      if (engine) {
        const result = engine.interpret(prev, {
          H: r.H,
          A: r.A,
          lg: r.lg,
          d: r.d,
          o: r.o,
        });
        for (const s of result.markets) {
          modern[s.market] ??= {
            favorevole: 0,
            contraria: 0,
            contrastante: 0,
            insufficiente: 0,
            selected: 0,
            selectedHit: 0,
            falsePositive: 0,
            unselectedEvent: 0,
          };
          modern[s.market][s.state]++;
          if (result.top.includes(s) && s.state === "favorevole") {
            modern[s.market].selected++;
            if (markets[s.market](r)) modern[s.market].selectedHit++;
            else modern[s.market].falsePositive++;
          } else if (markets[s.market](r)) modern[s.market].unselectedEvent++;
        }
      }
    }
    out.periods[year] = {
      fixtures,
      baseline: table,
      baselineMetrics,
      ...(engine ? { interpretation: modern } : {}),
    };
  }
  out.observations = [
    "Baseline: minimo storico 8 per lato, stagione 5, lega 30; scarti 7/12pp e coerenza spread 35pp; common/uncommon diventano neutral nella headline concorde.",
    "Solo stagione con storico insufficiente viene classificata mixed. Neutro non significa assenza di frequenza alta. HT assente escluso dal denominatore.",
    "Nuovo livello separato: nessun voto modificato; min8 per lato e30 lega, scarti concordi ±10pp, massimo3 evidenze per ampiezza minima, nessuna quota/EV/rendimento predetto.",
    "Split temporale: regole fisse dichiarate prima dei risultati holdout; hit-rate descrittivo, nessuna calibrazione o test di profitto.",
  ];
  return out;
}
if (require.main === module) {
  const engine = fs.existsSync(path.join(ROOT, "ta-v02v-engine.js"))
    ? require("../../ta-v02v-engine")
    : null;
  const report = diagnose(engine);
  fs.writeFileSync(
    path.join(ROOT, "qa/v02v/neutrality.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
module.exports = { diagnose, input };
