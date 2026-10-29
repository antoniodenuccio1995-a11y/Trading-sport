"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict"),
  V = require("../../ta-v02v-engine"),
  C = require("../../ta-clubs-v4");
const now = Date.UTC(2026, 9, 29, 12),
  mk = (day, H, A, h, a, o = {}) => ({
    d: Date.parse(day + "T00:00:00Z"),
    lg: o.lg || "Serie A",
    H,
    A,
    h,
    a,
    ht: o.ht ?? null,
    hth: o.hth ?? null,
    hta: o.hta ?? null,
    up: h == null,
    o: { CsvSeason: 2026, ClubHomeId: H, ClubAwayId: A, ...o },
  });
const data = [
  mk("2026-10-01", "A", "B", 2, 1, { ht: 1, hth: 1, hta: 0 }),
  mk("2026-10-03", "B", "A", 0, 0),
  mk("2026-10-05", "A", "C", 4, 2, { ht: 0, hth: 0, hta: 0 }),
  mk("2026-10-06", "A", "B", 0, 1, {
    lg: "Coppa Italia",
    CompetitionCountry: "ITA",
    CompetitionType: "cup",
    NeutralVenue: true,
  }),
  mk("2026-10-10", "A", "B", 3, 2, { ScoreScope: "extra-time" }),
  mk("2026-10-29", "A", "B", 9, 9),
  mk("2026-10-30", "A", "B", 8, 8),
  mk("2026-10-08", "A", "B", null, null),
];
const idx = () => V.createIndex(data),
  f = { club: "A", competition: "Serie A", country: "ITA", season: 2026 };
test("Independent exact counts, percentages and missing denominators", () => {
  const p = V.profile(idx(), f, now);
  assert.equal(p.n, 3);
  assert.equal(p.w, 2);
  assert.equal(p.d, 1);
  assert.equal(p.l, 0);
  assert.equal(p.gf, 6);
  assert.equal(p.ga, 3);
  assert.equal(p.avgGF, 2);
  assert.equal(p.avgGA, 1);
  assert.equal(p.markets.o15.w, 2);
  assert.equal(p.markets.o25.w, 2);
  assert.equal(p.markets.o35.w, 1);
  assert.equal(p.markets.btts.w, 2);
  assert.equal(p.markets.clean.w, 1);
  assert.equal(p.ht.n, 2);
  assert.equal(p.ht.over05.w, 1);
  assert.equal(p.ht.over05.p, 50);
  assert.equal(p.ht.gf, 0.5);
  assert.equal(p.quality.missingFT, 2);
  assert.equal(p.quality.missingHT, 1);
});
test("Temporal cutoffs exclude same day, later dates, and bogus future scores", () => {
  for (const cutoff of [Date.UTC(2026, 9, 29), Date.UTC(2030, 1, 1)])
    assert.equal(V.profile(idx(), { ...f, cutoff }, now).n, 3);
  assert.equal(
    V.profile(idx(), { ...f, cutoff: Date.UTC(2026, 9, 5) }, now).n,
    2,
  );
});
test("Date interval includes endpoints and composes with historical season", () => {
  assert.equal(
    V.profile(idx(), { ...f, from: "2026-10-03", to: "2026-10-05" }, now).n,
    2,
  );
  assert.equal(V.profile(idx(), { ...f, season: 2025 }, now).n, 0);
  assert.equal(V.date("2026-02-30"), null);
});
test("Actual home, away, total and neutral scopes differ without manufacturing home venue", () => {
  const i = idx();
  assert.equal(V.profile(i, { ...f, venue: "home" }, now).n, 2);
  assert.equal(V.profile(i, { ...f, venue: "away" }, now).n, 1);
  assert.equal(
    V.profile(i, { ...f, scope: "all", venue: "neutral" }, now).n,
    1,
  );
  assert.equal(V.profile(i, { ...f, scope: "all" }, now).n, 4);
  assert.equal(V.profile(i, { ...f, scope: "domestic" }, now).n, 3);
});
test("HT zero is known, absent HT remains null and extra-time FT excluded", () => {
  assert.equal(V.htTotal(data[1]), null);
  assert.equal(V.htTotal(data[2]), 0);
  assert.equal(V.ftKnown(data[4]), false);
  assert.equal(V.htTotal({ ...data[0], ht: null, hth: 8, hta: 0 }), null);
});
test("Shared profile equal for both consumers and inputs never mutated", () => {
  const before = JSON.stringify(data),
    i = idx();
  assert.deepEqual(V.profile(i, f, now), V.profile(i, { ...f }, now));
  assert.equal(JSON.stringify(data), before);
});
test("H2H counts actual meetings in each venue, capped before selected date", () => {
  const p = V.h2h(idx(), "A", "B", Date.UTC(2026, 9, 29), "all");
  assert.equal(p.n, 3);
  assert.equal(p.gf, 2);
  assert.equal(p.ga, 2);
  assert.equal(p.timeline.filter((t) => t.venue === "neutral").length, 1);
  assert.equal(p.ht.n, 1);
});
test("Rest and congestion use dates preceding cutoff", () => {
  const p = V.profile(idx(), { ...f, cutoff: Date.UTC(2026, 9, 9) }, now);
  assert.equal(p.restDays, 4);
  assert.equal(p.congestion7, 2);
  assert.equal(p.congestion14, 3);
  assert.equal(p.recent5.n, 3);
});
test("Clock requires coherent original time/fuso, no unzoned confidence", () => {
  assert.equal(
    V.clock(mk("2026-10-01", "A", "B", null, null, { Time: "18:30" })),
    "Orario non verificato",
  );
  assert.equal(
    V.clock(
      mk("2026-10-01", "A", "B", null, null, {
        KickoffUTC: "2026-10-01T18:30:00Z",
      }),
    ),
    "18:30 UTC",
  );
});
function scenario(mode) {
  const rs = [];
  for (let n = 0; n < 20; n++) {
    rs.push(
      mk(
        "2026-09-" + String(n + 1).padStart(2, "0"),
        "A",
        "X",
        mode === "low" ? 0 : 2,
        0,
        { ht: null },
      ),
    );
    rs.push(
      mk(
        "2026-09-" + String(n + 1).padStart(2, "0"),
        "X",
        "B",
        mode === "high" ? 2 : 0,
        0,
        { ht: null },
      ),
    );
  }
  for (let n = 0; n < 80; n++)
    rs.push(
      mk(
        "2026-08-" + String((n % 28) + 1).padStart(2, "0"),
        "X",
        "Y",
        mode === "low" ? 3 : 0,
        0,
        { ht: null },
      ),
    );
  return rs;
}
const fixture = mk("2026-10-01", "A", "B", null, null);
test("Interpretation false-positive guard, numerical supportive evidence and max3", () => {
  const s = V.interpret(scenario("high"), fixture);
  assert.equal(s.markets.find((x) => x.market === "o15").state, "favorevole");
  assert(s.top.length <= 3);
  assert(s.top.every((x) => x.h.n >= 8 && x.a.n >= 8 && x.league.n >= 30));
  assert.equal(s.markets.find((x) => x.market === "ht").state, "insufficiente");
});
test("Contrary evidence is not promoted to positive, mixed contexts yield no Over signal", () => {
  assert.equal(
    V.interpret(scenario("low"), fixture).markets.find(
      (x) => x.market === "o15",
    ).state,
    "contraria",
  );
  assert.equal(
    V.interpret(scenario("mixed"), fixture).markets.find(
      (x) => x.market === "o15",
    ).state,
    "contrastante",
  );
  assert.equal(V.interpret([], fixture).top.length, 0);
});
test("Signal input at same/later day cannot change output or leak outcomes", () => {
  const rs = scenario("high"),
    s = V.interpret(rs, fixture);
  assert.deepEqual(
    V.interpret(
      [
        ...rs,
        { ...fixture, h: 9, a: 9, up: false },
        mk("2026-10-02", "A", "B", 9, 9),
      ],
      fixture,
    ),
    s,
  );
});
test("Canonical promoted clubs and aliases retained as one identity", () => {
  const x = C.isolated(() => [
    C.canonicalMatch(
      mk("2025-05-01", "Leeds", "Burnley", 1, 0, {
        lg: "Championship",
        ClubHomeId: undefined,
        ClubAwayId: undefined,
      }),
    ),
    C.canonicalMatch(
      mk("2025-09-01", "Leeds United", "Chelsea", 1, 0, {
        lg: "Premier League",
        ClubHomeId: undefined,
        ClubAwayId: undefined,
      }),
    ),
  ]);
  const i = V.createIndex(x);
  assert.equal(i.clubs.filter((c) => c.name.includes("Leeds")).length, 1);
});

test("Future fixture cannot consume already scored records dated after the observation day", () => {
  const fixture = mk("2026-11-10", "A", "B", null, null),
    past = scenario("high"),
    future = [];
  for (let n = 0; n < 20; n++)
    future.push(mk("2026-11-01", "A", "B", 9, 9, { ht: 9 }));
  assert.deepEqual(
    V.interpret([...past, ...future], fixture, now),
    V.interpret(past, fixture, now),
  );
  assert.equal(
    V.h2h(
      V.createIndex([...data, ...future]),
      "A",
      "B",
      fixture.d,
      "all",
      null,
      now,
    ).n,
    3,
  );
});

test("All-official scope excludes declared friendlies and unqualified competitions, without deleting rows", () => {
  const extra = [
    mk("2026-10-07", "A", "B", 9, 9, {
      lg: "Amichevoli",
      CompetitionCountry: "ITA",
      CompetitionType: "friendly",
    }),
    mk("2026-10-08", "A", "B", 8, 8, {
      lg: "Competizione da verificare",
      CompetitionCountry: "ITA",
    }),
  ];
  const i = V.createIndex([...data, ...extra]);
  assert.equal(i.entries.length, data.length + 2);
  assert.equal(V.profile(i, { ...f, scope: "all" }, now).n, 4);
  assert.equal(
    V.profile(i, { ...f, scope: "competition", competition: "Amichevoli" }, now)
      .n,
    1,
  );
  assert.equal(
    V.h2h(i, "A", "B", Date.UTC(2026, 9, 29), "all", null, now).n,
    3,
  );
});
