/* TA-V02V-001. Pure descriptive engine shared by Match Analysis and Comparator.
   No archive writes, predictions, ratings or inter-league strength coefficients. */
(function (root, factory) {
  const api =
    typeof module === "object" && module.exports
      ? factory(require("./ta-fixture-identity"), require("./ta-clubs-v4"))
      : factory(root.TAFixtures, root.TAClubs);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TAV02V = api;
})(globalThis, function (F, C) {
  "use strict";
  const DAY = 86400000,
    fold = (s) =>
      String(s ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
  const countryNames = {
    ITA: "Italia",
    ENG: "Inghilterra",
    ESP: "Spagna",
    GER: "Germania",
    FRA: "Francia",
    NED: "Olanda",
    PRT: "Portogallo",
    DNK: "Danimarca",
    ROU: "Romania",
    HRV: "Croazia",
    TUR: "Turchia",
    BEL: "Belgio",
    INT: "Internazionali",
    UNSPECIFIED: "Paese da verificare",
  };
  const markets = {
    o15: (r) => r.h + r.a > 1,
    o25: (r) => r.h + r.a > 2,
    u25: (r) => r.h + r.a < 3,
    btts: (r) => r.h > 0 && r.a > 0,
    ht: (r) => (htTotal(r) == null ? null : htTotal(r) > 0),
    draw: (r) => r.h === r.a,
    home: (r) => r.h > r.a,
    away: (r) => r.a > r.h,
  };
  const labels = {
    o15: "Over 1.5",
    o25: "Over 2.5",
    u25: "Under 2.5",
    btts: "Goal",
    ht: "Over 0.5 HT",
    draw: "Pareggio",
    home: "Vittoria casa",
    away: "Vittoria ospite",
  };
  const day = (t) => Math.floor(t / DAY) * DAY;
  const date = (s) => {
    if (!s) return null;
    const t = Date.parse(s + "T00:00:00Z");
    return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s
      ? t
      : null;
  };
  function season(r) {
    return F.season(r);
  }
  function competition(r) {
    const name = F.competition(r.lg),
      o = r.o || {},
      known = Object.hasOwn(C.countries, name),
      country =
        (known ? C.countries[name] : null) ||
        o.CompetitionCountry ||
        "UNSPECIFIED",
      type = fold(o.CompetitionType),
      friendly = /friendly|amichevol|amistos/.test(type + " " + fold(name)),
      cup =
        type === "cup" ||
        /cup|coppa|coupe|copa|champions|europa|conference/i.test(name),
      kind = friendly
        ? "friendly"
        : cup
          ? "cup"
          : known || type === "league"
            ? "league"
            : "unknown",
      official =
        !friendly &&
        o.Official !== false &&
        (known || cup || type === "league" || o.Official === true);
    return { name, country, kind, official };
  }
  function venue(r, side) {
    return /^(?:true|1|yes)$/i.test(
      String(r.o?.NeutralVenue ?? r.o?.IsNeutral ?? ""),
    ) ||
      /^(?:neutral|neutro)$/i.test(String(r.o?.VenueType ?? r.o?.Venue ?? ""))
      ? "neutral"
      : side === "H"
        ? "home"
        : "away";
  }
  function ftKnown(r) {
    return (
      !r.up &&
      Number.isInteger(r.h) &&
      r.h >= 0 &&
      Number.isInteger(r.a) &&
      r.a >= 0 &&
      !/extra|penalt|aet|shootout/i.test(
        String(r.o?.ScoreScope ?? r.o?.ResultScope ?? ""),
      )
    );
  }
  function htTotal(r) {
    if (
      (r.hth != null || r.hta != null) &&
      (!Number.isInteger(r.hth) ||
        !Number.isInteger(r.hta) ||
        r.hth < 0 ||
        r.hta < 0 ||
        r.hth > r.h ||
        r.hta > r.a)
    )
      return null;
    if (
      Number.isInteger(r.hth) &&
      Number.isInteger(r.hta) &&
      r.hth >= 0 &&
      r.hta >= 0 &&
      r.hth <= r.h &&
      r.hta <= r.a
    )
      return r.hth + r.hta;
    return Number.isInteger(r.ht) && r.ht >= 0 && r.ht <= r.h + r.a
      ? r.ht
      : null;
  }
  function clubId(r, side) {
    return (
      r.o?.[side === "H" ? "ClubHomeId" : "ClubAwayId"] ||
      C.resolve(r[side], r.lg, {
        country: r.o?.[side === "H" ? "HomeCountry" : "AwayCountry"],
      }).id
    );
  }
  function fixtureKey(r) {
    return F.key(r, (n, lg) => C.resolve(n, lg));
  }
  function clock(r) {
    const t = F.context(r).kickoffInstant;
    if (!Number.isFinite(t)) return "Orario non verificato";
    const iso = new Date(t).toISOString();
    return (
      (iso.slice(0, 10) !== new Date(r.d).toISOString().slice(0, 10)
        ? iso.slice(0, 10) + " "
        : "") +
      iso.slice(11, 16) +
      " UTC"
    );
  }
  function createIndex(records) {
    return C.isolated(() => {
      const clubs = new Map(),
        competitions = new Map(),
        entries = [];
      for (const r of records) {
        if (!Number.isFinite(r.d) || !r.H || !r.A) continue;
        const comp = competition(r);
        competitions.set(comp.name, comp);
        const ids = {};
        for (const side of ["H", "A"]) {
          const id = clubId(r, side),
            home = side === "H",
            country =
              r.o?.[home ? "ClubHomeCountry" : "ClubAwayCountry"] ||
              r.o?.[home ? "HomeCountry" : "AwayCountry"] ||
              comp.country;
          ids[side] = id;
          let c = clubs.get(id);
          if (!c) {
            const seed = C.seeds.find((x) => x.id === id);
            c = {
              id,
              name: r[side],
              country: seed?.country || country,
              aliases: new Set(seed?.aliases || []),
              competitions: new Set(),
              seasons: new Set(),
            };
            clubs.set(id, c);
          }
          c.aliases.add(r[side]);
          const raw = r.o?.[home ? "ClubHomeRaw" : "ClubAwayRaw"];
          if (raw) c.aliases.add(raw);
          c.competitions.add(comp.name);
          c.seasons.add(season(r));
        }
        entries.push({ r, ids, comp, season: season(r), key: fixtureKey(r) });
      }
      return {
        entries,
        clubs: [...clubs.values()]
          .map((c) => ({
            ...c,
            aliases: [...c.aliases],
            competitions: [...c.competitions],
            seasons: [...c.seasons].sort((a, b) => b - a),
          }))
          .sort((a, b) => a.name.localeCompare(b.name, "it")),
        competitions: [...competitions.values()].sort((a, b) =>
          a.name.localeCompare(b.name, "it"),
        ),
      };
    });
  }
  function select(index, filter = {}, now = Date.now()) {
    const end = date(filter.to),
      from = date(filter.from),
      cutoff = Math.min(
        Number.isFinite(filter.cutoff) ? filter.cutoff : Infinity,
        end == null ? Infinity : end + DAY,
        day(now),
      );
    return index.entries
      .filter((x) => {
        const r = x.r,
          side =
            x.ids.H === filter.club
              ? "H"
              : x.ids.A === filter.club
                ? "A"
                : null;
        if (
          !side ||
          !F.usable(r) ||
          r.d >= cutoff ||
          (from != null && r.d < from)
        )
          return false;
        if (
          filter.season !== "" &&
          filter.season != null &&
          filter.season !== "all" &&
          x.season !== Number(filter.season)
        )
          return false;
        if (filter.scope === "all" && !x.comp.official) return false;
        if (
          (filter.scope || "competition") === "competition" &&
          filter.competition &&
          x.comp.name !== filter.competition
        )
          return false;
        if (
          filter.scope === "domestic" &&
          (x.comp.kind !== "league" || x.comp.country !== filter.country)
        )
          return false;
        if (
          filter.venue &&
          filter.venue !== "all" &&
          venue(r, side) !== filter.venue
        )
          return false;
        return true;
      })
      .map((x) => ({ ...x, side: x.ids.H === filter.club ? "H" : "A" }))
      .sort((a, b) => a.r.d - b.r.d || a.key.localeCompare(b.key));
  }
  const ratio = (w, n) => ({ w, n, p: n ? (100 * w) / n : null });
  function summarize(sample) {
    const games = sample.filter((x) => ftKnown(x.r));
    let w = 0,
      d = 0,
      l = 0,
      gf = 0,
      ga = 0,
      hgf = 0,
      hga = 0,
      splitHT = 0,
      htN = 0,
      htOver = 0;
    const counts = { o15: 0, o25: 0, o35: 0, btts: 0, clean: 0, ng: 0 };
    const timeline = [];
    for (const x of games) {
      const r = x.r,
        home = x.side === "H",
        f = home ? r.h : r.a,
        a = home ? r.a : r.h;
      gf += f;
      ga += a;
      w += f > a;
      d += f === a;
      l += f < a;
      counts.o15 += r.h + r.a > 1;
      counts.o25 += r.h + r.a > 2;
      counts.o35 += r.h + r.a > 3;
      counts.btts += f > 0 && a > 0;
      counts.ng += !(f > 0 && a > 0);
      counts.clean += a === 0;
      const ht = htTotal(r);
      if (ht !== null) {
        htN++;
        htOver += ht > 0;
      }
      if (Number.isInteger(r.hth) && Number.isInteger(r.hta) && ht !== null) {
        splitHT++;
        hgf += home ? r.hth : r.hta;
        hga += home ? r.hta : r.hth;
      }
      timeline.push({
        date: new Date(r.d).toISOString().slice(0, 10),
        competition: r.lg,
        opponent: home ? r.A : r.H,
        venue: venue(r, x.side),
        gf: f,
        ga: a,
        result: f > a ? "V" : f === a ? "P" : "S",
        key: x.key,
      });
    }
    const n = games.length,
      avg = (v) => (n ? v / n : null);
    return {
      n,
      w,
      d,
      l,
      gf,
      ga,
      avgGF: avg(gf),
      avgGA: avg(ga),
      ppg: avg(3 * w + d),
      markets: Object.fromEntries(
        Object.entries(counts).map(([k, v]) => [k, ratio(v, n)]),
      ),
      ht: {
        n: htN,
        over05: ratio(htOver, htN),
        splitN: splitHT,
        gf: splitHT ? hgf / splitHT : null,
        ga: splitHT ? hga / splitHT : null,
      },
      quality: {
        observed: sample.length,
        missingFT: sample.length - n,
        missingHT: n - htN,
        status:
          "parziale o non verificabile: archivio locale, consultare copertura in Area tecnica",
      },
      recent: timeline.slice(-10).reverse(),
      timeline,
    };
  }
  function profile(index, filter = {}, now = Date.now()) {
    const sample = select(index, filter, now),
      played = sample.filter((x) => ftKnown(x.r)),
      summary = summarize(sample),
      last = played.at(-1),
      cutoff = Number.isFinite(filter.cutoff)
        ? filter.cutoff
        : Math.min(
            date(filter.to) == null ? day(now) : date(filter.to) + DAY,
            day(now),
          );
    return {
      ...summary,
      filter: { ...filter },
      recent5: summarize(played.slice(-5)),
      recent10: summarize(played.slice(-10)),
      restDays: last
        ? Math.max(0, Math.floor((cutoff - last.r.d) / DAY))
        : null,
      congestion7: played.filter((x) => x.r.d >= cutoff - 7 * DAY).length,
      congestion14: played.filter((x) => x.r.d >= cutoff - 14 * DAY).length,
      sampleKeys: sample.map((x) => x.key),
    };
  }
  function h2h(
    index,
    a,
    b,
    cutoff = day(Date.now()),
    limit = 10,
    scope,
    now = Date.now(),
  ) {
    const sample = index.entries
      .filter(
        (x) =>
          ((x.ids.H === a && x.ids.A === b) ||
            (x.ids.H === b && x.ids.A === a)) &&
          x.r.d < Math.min(cutoff, day(now)) &&
          F.usable(x.r) &&
          (scope ? x.r.lg === scope : x.comp.official),
      )
      .map((x) => ({ ...x, side: x.ids.H === a ? "H" : "A" }))
      .sort((a, b) => a.r.d - b.r.d);
    return summarize(limit === "all" ? sample : sample.slice(-Number(limit)));
  }
  function eventStat(sample, key) {
    const values = sample
      .filter((x) => ftKnown(x.r))
      .map((x) => markets[key](x.r))
      .filter((v) => v !== null);
    return ratio(values.filter(Boolean).length, values.length);
  }
  function interpret(records, fixture, now = Date.now()) {
    const prev = records.filter(
      (r) =>
        r.lg === fixture.lg &&
        r.d < Math.min(fixture.d, day(now)) &&
        F.usable(r) &&
        ftKnown(r) &&
        season(r) >= season(fixture) - 3,
    );
    prev.sort((a, b) => a.d - b.d);
    const home = prev
        .filter(
          (r) =>
            venue(r, "H") === "home" &&
            (r.o?.ClubHomeId && fixture.o?.ClubHomeId
              ? r.o.ClubHomeId === fixture.o.ClubHomeId
              : r.H === fixture.H),
        )
        .slice(-20),
      away = prev
        .filter(
          (r) =>
            venue(r, "A") === "away" &&
            (r.o?.ClubAwayId && fixture.o?.ClubAwayId
              ? r.o.ClubAwayId === fixture.o.ClubAwayId
              : r.A === fixture.A),
        )
        .slice(-20);
    const as = (xs) => xs.map((r) => ({ r }));
    const result = Object.keys(markets).map((market) => {
      const h = eventStat(as(home), market),
        a = eventStat(as(away), market),
        league = eventStat(as(prev), market),
        dh = h.p == null || league.p == null ? null : h.p - league.p,
        da = a.p == null || league.p == null ? null : a.p - league.p;
      const state =
        h.n < 8 || a.n < 8 || league.n < 30
          ? "insufficiente"
          : dh >= 10 && da >= 10
            ? "favorevole"
            : dh <= -10 && da <= -10
              ? "contraria"
              : "contrastante";
      return {
        market,
        label: labels[market],
        state,
        h,
        a,
        league,
        hRecent: eventStat(as(home.slice(-5)), market),
        aRecent: eventStat(as(away.slice(-5)), market),
        dh,
        da,
        strength: dh == null ? 0 : Math.min(Math.abs(dh), Math.abs(da)),
        counter:
          state === "favorevole"
            ? "Frequenze descrittive; nessuna verifica del valore delle quote."
            : state === "contraria"
              ? "Frequenze contrarie: l’evento resta possibile e la quota non è stata valutata."
              : "Campioni o scarti non sostengono una direzione concorde.",
      };
    });
    return {
      date: new Date(fixture.d).toISOString().slice(0, 10),
      markets: result,
      top: result
        .filter((x) => ["favorevole", "contraria"].includes(x.state))
        .sort((a, b) => b.strength - a.strength)
        .slice(0, 3),
      rules:
        "minimo 8 gare per lato e 30 di lega; scarti concordi di almeno 10 punti percentuali; ultime 20 del contesto, lega massimo tre stagioni precedenti più corrente. Non è una previsione.",
    };
  }
  return {
    DAY,
    fold,
    date,
    day,
    countryNames,
    markets,
    labels,
    season,
    competition,
    venue,
    ftKnown,
    htTotal,
    clubId,
    fixtureKey,
    clock,
    createIndex,
    select,
    summarize,
    profile,
    h2h,
    interpret,
  };
});
