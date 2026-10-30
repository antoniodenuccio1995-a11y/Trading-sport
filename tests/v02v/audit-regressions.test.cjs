"use strict";
const test = require("node:test"), assert = require("node:assert/strict"),
  { execFileSync } = require("node:child_process"),
  V = require("../../ta-v02v-engine");
const date = s => Date.parse(s + "T00:00:00Z"),
  now = Date.parse("2026-10-30T12:00:00Z"),
  row = (d, h = 2, a = 1, o = {}) => ({
    d: date(d), lg: "Serie A", H: "QA A", A: "QA B", h, a,
    up: h == null, ht: null, hth: null, hta: null,
    o: { CsvSeason: +d.slice(0, 4), ClubHomeId: "QA:A", ClubAwayId: "QA:B", ...o },
  });
test("IND-01: last 5/10/all count usable FT first, with independent expected dates", () => {
  const played = Array.from({length:12}, (_, n) => row(`2026-10-${String(n + 1).padStart(2, "0")}`)),
    excluded = [row("2026-10-13", null, null),
      {...row("2026-10-14", null, null), up:false},
      row("2026-10-15", 4, 3, {ScoreScope:"extra-time"}),
      row("2026-10-16", 5, 4, {ScoreScope:"penalties"})],
    records = [...played, ...excluded, row("2026-10-30", 9, 9), row("2026-10-31", 9, 9)],
    before = JSON.stringify(records), index = V.createIndex(records);
  for (const [limit, n, first] of [[5,5,"2026-10-08"],[10,10,"2026-10-03"],["all",12,"2026-10-01"]]) {
    const actual = V.h2h(index, "QA:A", "QA:B", Infinity, limit, null, now);
    assert.equal(actual.n, n); assert.equal(actual.timeline[0].date, first);
    assert.equal(actual.timeline.at(-1).date, "2026-10-12");
    assert.equal(actual.gf, 2*n); assert.equal(actual.ga, n);
    assert.equal(actual.ht.n, 0); assert.equal(actual.quality.missingHT, n);
    assert.equal(actual.quality.availableFT, 12); assert.equal(actual.quality.excludedFT, 4);
  }
  assert.equal(index.entries.length, records.length); assert.equal(JSON.stringify(records), before);
  const short = V.h2h(V.createIndex([...played.slice(0,3),...excluded]), "QA:A", "QA:B", Infinity,5,null,now);
  assert.equal(short.n,3); assert.equal(short.quality.excludedFT,4);
});
const dates = [
  ["2026-10-30T00:30:00+01:00", "2026-10-30"],
  ["2026-07-01T00:30:00+02:00", "2026-07-01"],
  ["2026-03-29T00:30:00+01:00", "2026-03-29"],
  ["2026-03-29T01:59:00+01:00", "2026-03-29"],
  ["2026-03-29T03:01:00+02:00", "2026-03-29"],
  ["2026-10-25T02:30:00+02:00", "2026-10-25"],
  ["2026-10-25T02:30:00+01:00", "2026-10-25"],
  ["2027-01-01T00:30:00+01:00", "2027-01-01"],
  ["2026-12-31T23:30:00-05:00", "2027-01-01"],
  ["2026-10-29T23:30:00+09:00", "2026-10-29"],
];
test("IND-02: one Rome civil-date boundary, winter/summer/DST/month/year and offset instants", () => {
  assert.equal(V.observationZone,"Europe/Rome");
  for (const [instant, expected] of dates) assert.equal(V.day(Date.parse(instant)),date(expected), instant);
});
test("IND-02: select/profile/H2H/signals all include yesterday and exclude today/future", () => {
  for (const [instant, expected] of dates) {
    const time = Date.parse(instant), today = date(expected),
      prev = new Date(today - V.DAY).toISOString().slice(0,10),
      future = new Date(today + V.DAY).toISOString().slice(0,10),
      records = [row(prev),row(expected,9,9),row(future,8,8)],
      index = V.createIndex(records), filter = {club:"QA:A",competition:"Serie A",cutoff:today + 10*V.DAY};
    const p = V.profile(index, filter, time);
    assert.equal(p.n,1,instant); assert.equal(p.gf,2); assert.equal(p.restDays,1);
    assert.deepEqual(V.select(index,filter,time).map(x=>x.r.d),[today-V.DAY]);
    assert.equal(V.h2h(index,"QA:A","QA:B",Infinity,5,null,time).n,1);
    const signals = V.interpret(records,{...row(future,null,null),o:{CsvSeason:+prev.slice(0,4)}},time);
    assert.equal(signals.markets.find(s=>s.market==="o25").league.n,1);
    assert.equal(signals.markets.find(s=>s.market==="o25").h.n,1);
    assert.equal(signals.markets.find(s=>s.market==="o25").a.n,1);
    assert.equal(V.profile(index,{...filter,cutoff:today-V.DAY},time).n,0);
  }
});
test("IND-02: host timezone cannot change the explicit Rome policy", () => {
  const code = `const V=require('./ta-v02v-engine');console.log(JSON.stringify(${JSON.stringify(dates)}.map(([t])=>V.day(Date.parse(t)))))`;
  for (const TZ of ["UTC","America/New_York","Asia/Tokyo","Pacific/Honolulu"])
    assert.deepEqual(JSON.parse(execFileSync(process.execPath,["-e",code],{cwd:require('node:path').resolve(__dirname,'../..'),env:{...process.env,TZ},encoding:"utf8"})), dates.map(([,d])=>date(d)));
});
test("IND-03: Cup/Coppa/Copa/type cannot qualify official status; strict explicit flag can", () => {
  for (const lg of ["Coppa QA da verificare","QA Cup","Copa QA","Coupe QA"]) {
    for (const metadata of [{},{CompetitionType:"cup"},{CompetitionType:"league"},{Official:"true"},{Official:false},{Official:true}]) {
      const r = {...row("2026-10-02",2,1,metadata),lg};
      assert.equal(V.competition(r).official,metadata.Official===true,lg+JSON.stringify(metadata));
      const index = V.createIndex([row("2026-10-01"),r]);
      assert.equal(V.profile(index,{club:"QA:A",scope:"all"},now).n,metadata.Official===true?2:1);
      assert.equal(V.profile(index,{club:"QA:A",competition:lg},now).n,1);
      assert.equal(V.h2h(index,"QA:A","QA:B",Infinity,"all",null,now).n,metadata.Official===true?2:1);
      assert.equal(index.entries.length,2);
    }
  }
});
test("IND-03: registered cup/league, explicit opt-out and friendlies take precedence", () => {
  for (const [lg, o, official] of [["Champions League",{},true],["Serie A",{},true],
    ["Champions League",{Official:false},false],["Serie A",{Official:false},false],
    ["QA Cup",{CompetitionType:"friendly",Official:true},false],
    ["QA Amichevole",{CompetitionType:"cup",Official:true},false]])
    assert.equal(V.competition({...row("2026-10-01",1,0,o),lg}).official,official);
});
