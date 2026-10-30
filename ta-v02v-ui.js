/* Match Center presentation. Archive mutations remain exclusively in rc5. */
"use strict";
(function () {
  const V = TAV02V,
    $v = (s) => document.querySelector(s),
    esc = (s) =>
      String(s ?? "").replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      );
  const PREF = "ta_v02v_ui_v1";
  let pref = {};
  try {
    pref = JSON.parse(localStorage.getItem(PREF) || "{}") || {};
  } catch (_) {}
  if (!pref || typeof pref !== "object" || Array.isArray(pref)) pref = {};
  for (const k of ["watch", "pins", "countryOrder", "openCountries"])
    if (!Array.isArray(pref[k])) pref[k] = [];
  function save() {
    try {
      localStorage.setItem(PREF, JSON.stringify(pref));
      $v("#vPreferenceError")?.remove();
    } catch (_) {
      if (!$v("#vPreferenceError"))
        $v("h1").insertAdjacentHTML(
          "afterend",
          '<p id="vPreferenceError" role="alert">Preferenze non salvate: memoria locale indisponibile. Esporta il backup prima di chiudere.</p>',
        );
    }
  }
  let cachedRows,
    cachedMan,
    cachedRules,
    index,
    activeFixture = null,
    calendarPage = 0,
    searchTimer;
  function idx() {
    const rules = JSON.stringify(TAClubs.rules()),
      manualKey = JSON.stringify(man);
    if (
      !index ||
      cachedRows !== rows ||
      cachedMan !== manualKey ||
      cachedRules !== rules
    ) {
      const real = taStatRows();
      const all = man.length
        ? TARecovery.reconcile([...real, ...man]).usableRecords
        : real;
      index = V.createIndex(all);
      cachedRows = rows;
      cachedMan = manualKey;
      cachedRules = rules;
    }
    return index;
  }
  const today = () => new Date(V.day(Date.now())).toISOString().slice(0, 10),
    iso = (t) => new Date(t).toISOString().slice(0, 10),
    seasonLabel = (y) => `${y}/${String((+y + 1) % 100).padStart(2, "0")}`;
  const venueLabel = {
      home: "Casa",
      away: "Trasferta",
      neutral: "Neutro",
      all: "Totale",
    },
    scopeLabel = {
      competition: "Sola competizione",
      domestic: "Campionato nazionale",
      all: "Tutte le competizioni ufficiali disponibili",
    },
    phaseLabel = {
      regular: "Stagione regolare",
      unknown: "Fase non specificata",
      unresolved: "Fase da verificare",
      playoff: "Playoff",
      playout: "Playout",
      knockout: "Eliminazione diretta",
      "group-stage": "Gironi",
      "league-phase": "Fase campionato",
      qualifying: "Qualificazioni",
      "relegation-group": "Gruppo retrocessione",
      "championship-group": "Gruppo campionato",
    };
  const nameCountry = (c) => V.countryNames[c] || c,
    pct = (s) =>
      s.p == null ? `— (${s.w}/${s.n})` : `${s.p.toFixed(1)}% (${s.w}/${s.n})`,
    num = (v) => (v == null ? "—" : v.toFixed(2)),
    opt = (v, l) => `<option value="${esc(v)}">${esc(l ?? v)}</option>`;
  function options(el, items, current, empty) {
    el.innerHTML =
      (empty != null ? opt("", empty) : "") +
      items.map((x) => (Array.isArray(x) ? opt(...x) : opt(x))).join("");
    el.value = [...el.options].some((o) => o.value === String(current))
      ? current
      : el.options[0]?.value || "";
  }
  function watched(key) {
    return (pref.watch || []).includes(key);
  }
  function watchButton(key) {
    return `<button type="button" class="v-small v-fav" data-v-watch="${esc(key)}" aria-label="Preferito" aria-pressed="${watched(key)}">${watched(key) ? "★" : "☆"}</button>`;
  }
  function row(x) {
    const r = x.r,
      c = TAFixtures.context(r),
      ht = V.htTotal(r);
    return `<tr><td>${iso(r.d)}<br><small>${esc(V.clock(r))}</small></td><td><button type="button" class="v-small" data-v-match="${esc(x.key)}">${esc(r.H)} – ${esc(r.A)}</button></td><td>${V.ftKnown(r) ? r.h + "–" + r.a + (r.d > V.date(today()) ? " · data futura, verificare" : "") : r.up ? "In programma" : "FT non noto"}<br><small>HT ${ht == null ? "non noto" : Number.isInteger(r.hth) && Number.isInteger(r.hta) ? r.hth + "–" + r.hta : ht + " gol totali"}</small></td><td>${esc(r.lg)}<br><small>${seasonLabel(x.season)} · ${esc(phaseLabel[c.phase] || c.phase)}${c.matchday ? " · " + c.matchday : ""}</small></td><td>${esc(V.venue(r, "H") === "neutral" ? "Neutra" : r.o?.VenueName || r.o?.Stadium || "Sede non specificata")}<br><small>${esc(r.o?.HistProvider || r.o?.Source || "Fonte importata")} · ${ht == null ? "HT mancante" : "FT/HT disponibili"}</small></td><td>${watchButton(x.key)}</td></tr>`;
  }
  function table(xs) {
    return xs.length
      ? `<div class="v-scroll"><table><thead><tr><th>Data / orario verificato</th><th>Partita</th><th>FT / HT</th><th>Competizione</th><th>Sede / copertura</th><th>★</th></tr></thead><tbody>${xs.map(row).join("")}</tbody></table></div>`
      : '<p class="v-empty">Nessun incontro presente per questi filtri. L’archivio può essere parziale.</p>';
  }
  const sections = [
    ["dashboard", "Dashboard", "Il tuo archivio, prossimi incontri e ricerche"],
    [
      "calendario",
      "Calendario generale",
      "Tutte le competizioni realmente importate",
    ],
    [
      "comparatore",
      "Comparatore squadre",
      "Confronto storico descrittivo, senza partita ipotetica",
    ],
  ];
  for (const [id, label, desc] of sections) {
    WORKSPACES.push({ id, label, desc });
    const s = document.createElement("section");
    s.id = id;
    $v("main").append(s);
  }
  $v("#dashboard").innerHTML =
    `<h2>Il tuo Match Center</h2><p class="v-note">Dati del tuo archivio locale. Nessun servizio live e nessun segnale calcolato automaticamente all’avvio.</p><div class="v-grid"><button class="v-hero" data-open-workspace="calendario">Calendario generale<small>Filtra incontri, risultati e fasi</small></button><button class="v-hero" data-open-workspace="analisi">Centro Analisi<small>Analisi partita e Comparatore squadre</small></button><button class="v-hero" data-open-workspace="scanner">Scanner e segnali<small>Esamina i mercati con dati verificabili</small></button><button class="v-hero" data-open-workspace="strategie">Strategie e Backtest<small>Verifica ipotesi sullo storico</small></button></div><div class="v-card" style="margin:18px 0"><label for="vSearch"><b>Ricerca universale</b></label><input class="v-search" id="vSearch" type="search" placeholder="Club, alias, nazione, competizione o partita"><div id="vSearchResults" aria-live="polite"></div></div><div class="v-grid"><div class="v-card"><h3>Oggi e prossimi sette giorni</h3><div id="vDashboardUpcoming"></div></div><div class="v-card"><h3>Watchlist e continuità</h3><div id="vWatchlist"></div><button id="vResume" type="button">Riprendi ultima analisi</button><p id="vQuality" class="v-note"></p></div></div>`;
  $v("#calendario").innerHTML =
    `<h2>Calendario generale</h2><p class="v-note">Solo incontri importati, nessuna gara ricostruita per riempire calendari incompleti. Gli orari senza fuso e provenienza coerenti restano non verificati.</p><div class="v-filters" id="vCalendarFilters"><label>Paese<select id="vCalCountry"></select></label><label>Campionato / coppa<select id="vCalCompetition"></select></label><label>Stagione<select id="vCalSeason"></select></label><label>Giornata / fase<select id="vCalPhase"></select></label><label>Dal giorno<input type="date" id="vCalFrom"></label><label>Al giorno<input type="date" id="vCalTo"></label><label>Squadra o alias<input type="search" id="vCalTeam"></label><label>Stato<select id="vCalStatus"><option value="">Tutti</option><option value="played">Con FT</option><option value="scheduled">In programma</option><option value="unknown">FT non noto / stato da verificare</option></select></label><label>Preferiti<select id="vCalFavorite"><option value="">Tutti</option><option value="yes">Solo watchlist</option></select></label><label>Ordine<select id="vCalSort"><option value="asc">Data crescente</option><option value="desc">Data decrescente</option><option value="club">Squadra di casa</option></select></label></div><div class="v-actions"><button id="vCalToday">Oggi</button><button id="vCalWeek">Prossimi 7 giorni</button><button id="vCalReset">Reset filtri</button><button id="vCalExport">Esporta CSV filtrato</button></div><p id="vCalCount" role="status"></p><div id="vCalendarRows"></div><div class="v-actions"><button id="vCalPrev">Precedenti</button><span id="vCalPage"></span><button id="vCalNext">Successive</button></div><details><summary>Calendario e inserimento manuale rc5</summary><button data-open-workspace="partite">Apri calendario originale e inserimento manuale</button></details>`;
  function sideMarkup(side) {
    return `<div class="v-card"><h3>Squadra ${side.toUpperCase()}</h3><div class="v-filters" data-v-side="${side}"><label>Paese<select id="v${side}Country"></select></label><label>Lega / serie / coppa<select id="v${side}Competition"></select></label><label>Ricerca nome o alias<input type="search" id="v${side}Search"></label><label>Squadra<select id="v${side}Club"></select></label><label>Stagione<select id="v${side}Season"></select></label><label>Perimetro<select id="v${side}Scope"><option value="competition">Sola competizione</option><option value="domestic">Campionato nazionale nella stagione</option><option value="all">Tutte le competizioni ufficiali disponibili</option></select></label><label>Rendimento<select id="v${side}Venue"><option value="all">Totale</option><option value="home">Casa</option><option value="away">Trasferta</option><option value="neutral">Neutro</option></select></label><label>Dal giorno<input type="date" id="v${side}From"></label><label>Al giorno<input type="date" id="v${side}To"></label></div><div id="v${side}Stats"></div></div>`;
  }
  $v("#comparatore").innerHTML =
    `<h2>Comparatore squadre storico</h2><div class="v-section-tabs"><button data-open-workspace="analisi">Analisi partita</button><button data-open-workspace="comparatore" aria-pressed="true">Comparatore squadre</button></div><p class="v-note">Percorso indipendente da una gara: confronti descrittivi, anche tra stagioni o leghe diverse. Nessun pronostico, coefficiente intercampionato o consiglio pre-partita. Dati fino a ieri; gare del giorno escluse prudenzialmente.</p><div class="v-actions"><button id="vCmpSwap">Inverti squadre e filtri</button><button id="vCmpReset">Reset filtri</button><button id="vCmpRun" class="p">Aggiorna confronto</button></div><div class="v-grid">${sideMarkup("a")}${sideMarkup("b")}</div>`;
  $v("#analisi").insertAdjacentHTML(
    "afterbegin",
    '<div class="v-section-tabs"><button data-open-workspace="analisi">Analisi partita</button><button data-open-workspace="comparatore">Comparatore squadre</button></div>',
  );
  $v("#comparison").insertAdjacentHTML(
    "beforebegin",
    '<div id="vMatchPanel"></div>',
  );
  // Explicit updates only in v0.2V. Timers and initialization resolve these shared names.
  maybeAutoRefreshLeague = function () {};
  // Actual name used by the second baseline refresh hook is overridden below if present.
  if (typeof maybeRefreshFixtureBoard === "function")
    maybeRefreshFixtureBoard = function () {};
  function controls(side) {
    const m = {};
    for (const key of [
      "Country",
      "Competition",
      "Search",
      "Club",
      "Season",
      "Scope",
      "Venue",
      "From",
      "To",
    ])
      m[key] = $v("#v" + side + key);
    return m;
  }
  function sideValues(side) {
    return Object.fromEntries(
      Object.entries(controls(side)).map(([k, el]) => [k, el.value]),
    );
  }
  function populateSide(side, changed, values) {
    const c = controls(side),
      v = values || sideValues(side),
      i = idx();
    options(
      c.Country,
      [...new Set(i.competitions.map((x) => x.country))]
        .sort()
        .map((x) => [x, nameCountry(x)]),
      v.Country,
    );
    const comps = i.competitions.filter((x) => x.country === c.Country.value);
    options(
      c.Competition,
      comps.map((x) => x.name),
      v.Competition,
    );
    const clublist = i.clubs.filter(
      (x) =>
        x.competitions.includes(c.Competition.value) &&
        (!c.Search.value ||
          x.aliases.some((a) => V.fold(a).includes(V.fold(c.Search.value)))),
    );
    options(
      c.Club,
      clublist.map((x) => [x.id, x.name]),
      v.Club,
      "Seleziona squadra",
    );
    const club = i.clubs.find((x) => x.id === c.Club.value),
      years =
        club?.seasons ||
        [
          ...new Set(
            i.entries
              .filter((x) => x.comp.name === c.Competition.value)
              .map((x) => x.season),
          ),
        ].sort((a, b) => b - a);
    const observed = new Date(V.day(Date.now())),
      current = observed.getUTCFullYear() - (observed.getUTCMonth() < 6 ? 1 : 0);
    options(
      c.Season,
      [["all", "Tutto lo storico"], ...new Set([current, ...years])].map((x) =>
        Array.isArray(x)
          ? x
          : [x, seasonLabel(x) + (x === current ? " · attuale" : "")],
      ),
      v.Season ?? String(current),
    );
    for (const k of ["Scope", "Venue", "From", "To"])
      if (v[k] != null) c[k].value = v[k];
  }
  function filterSide(side) {
    const v = sideValues(side);
    return {
      club: v.Club,
      country: v.Country,
      competition: v.Competition,
      season: v.Season,
      scope: v.Scope,
      venue: v.Venue,
      from: v.From,
      to: v.To,
    };
  }
  function statsMarkup(p, title) {
    if (!p.n)
      return `<p class="v-empty">${esc(title)}: nessun risultato FT utilizzabile. ${p.quality.observed} osservazioni, ${p.quality.missingFT} senza FT.</p>`;
    const metrics = [
      ["Gare", p.n],
      ["V / P / S", `${p.w} / ${p.d} / ${p.l}`],
      ["Gol fatti / subiti", `${p.gf} / ${p.ga}`],
      ["GF / GA per gara", num(p.avgGF) + " / " + num(p.avgGA)],
      ["Punti per gara", num(p.ppg)],
      ["HT noti", `${p.ht.n}/${p.n}`],
    ];
    return `<div class="v-metrics">${metrics.map(([k, v]) => `<div class="v-metric"><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join("")}</div>${Object.entries(
      p.markets,
    )
      .map(
        ([k, v]) =>
          `<div class="v-statrow"><span>${esc({ o15: "Over 1.5", o25: "Over 2.5", o35: "Over 3.5", btts: "Goal", ng: "No Goal", clean: "Clean sheet" }[k])}</span><strong>${pct(v)}</strong></div>`,
      )
      .join(
        "",
      )}<div class="v-statrow"><span>Over 0.5 HT</span><strong>${pct(p.ht.over05)}</strong></div><div class="v-statrow"><span>Gol HT fatti / subiti</span><strong>${num(p.ht.gf)} / ${num(p.ht.ga)} (${p.ht.splitN} gare)</strong></div><p class="v-note">${esc(title)} · ${p.quality.observed} incontri osservati, ${p.quality.missingFT} senza FT, ${p.quality.missingHT} FT senza HT. ${esc(p.quality.status)}.</p><div class="v-timeline">${p.recent.map((t) => `<span class="v-point" title="${esc(t.date + " · " + t.competition + " · " + t.opponent + " · " + t.venue)}">${t.result} ${t.gf}–${t.ga}</span>`).join("")}</div><details><summary>Andamento e avversari (${p.timeline.length} gare)</summary><div class="v-scroll"><table><thead><tr><th>Data</th><th>Avversario / competizione</th><th>Sede</th><th>GF / GA</th></tr></thead><tbody>${p.timeline
      .slice()
      .reverse()
      .map(
        (t) =>
          `<tr><td>${t.date}</td><td>${esc(t.opponent)} · ${esc(t.competition)}</td><td>${esc(venueLabel[t.venue] || t.venue)}</td><td>${t.gf} / ${t.ga}</td></tr>`,
      )
      .join("")}</tbody></table></div></details>`;
  }
  function renderComparator() {
    window.taVComparator = {};
    for (const side of ["a", "b"]) {
      const f = filterSide(side),
        p = V.profile(idx(), f);
      window.taVComparator[side] = p;
      const club = idx().clubs.find((c) => c.id === f.club),
        title = `${club?.name || "Seleziona squadra"} · ${f.competition || "—"} · ${f.season === "all" ? "tutto storico" : seasonLabel(f.season)} · ${scopeLabel[f.scope]} · ${venueLabel[f.venue]} · ${f.from || "inizio"} / ${f.to || "ieri"}`;
      $v("#v" + side + "Stats").innerHTML =
        statsMarkup(p, title) + leagueContext(p, f);
      pref["side" + side] = sideValues(side);
    }
    if (["a", "b"].some((s) => filterSide(s).club))
      pref.lastAnalysis = { kind: "comparator" };
    save();
  }
  function leagueContext(p, f) {
    if (f.scope !== "competition" || f.season === "all" || !f.club)
      return '<p class="v-note">Posizione e media di lega non aggregabili tra competizioni o stagioni diverse.</p>';
    const comp = idx().competitions.find((x) => x.name === f.competition);
    if (comp?.kind !== "league")
      return '<p class="v-note">Competizione senza classifica di lega applicabile.</p>';
    const league = idx().entries.filter(
      (x) =>
        x.comp.name === f.competition &&
        x.season === +f.season &&
        x.r.d <
          Math.min(
            f.cutoff ?? Infinity,
            V.date(f.to) == null ? Infinity : V.date(f.to) + V.DAY,
            V.day(Date.now()),
          ) &&
        V.ftKnown(x.r) &&
        TAFixtures.phase(x.r).stage === "regular" &&
        TAFixtures.usable(x.r),
    );
    const ids = new Set(league.flatMap((x) => [x.ids.H, x.ids.A]));
    const totals = [...ids]
      .map((id) => {
        const ss = V.summarize(
          league
            .filter((x) => x.ids.H === id || x.ids.A === id)
            .map((x) => ({ ...x, side: x.ids.H === id ? "H" : "A" })),
        );
        return { id, pts: ss.w * 3 + ss.d, n: ss.n };
      })
      .sort((a, b) => b.pts - a.pts);
    const rank = totals.find((x) => x.id === f.club);
    const avgGames = league.filter(
      (x) => !V.date(f.from) || x.r.d >= V.date(f.from),
    );
    const pos = rank ? 1 + totals.filter((x) => x.pts > rank.pts).length : null,
      avg = avgGames.length
        ? avgGames.reduce((n, x) => n + x.r.h + x.r.a, 0) / avgGames.length
        : null;
    return `<p class="v-note">Media gol ${esc(f.competition)}: ${num(avg)} (${avgGames.length} gare regolari nel periodo). Posizione stagionale ricostruita per soli punti: ${pos ?? "non ricostruibile"}${rank ? " · " + rank.pts + " punti / " + rank.n + " gare" : ""}. Pari punti a pari posizione; spareggi regolamentari non applicati. Nessun confronto di forza tra leghe.</p>`;
  }
  const calIDs = [
    "Country",
    "Competition",
    "Season",
    "Phase",
    "From",
    "To",
    "Team",
    "Status",
    "Favorite",
    "Sort",
  ];
  function calValues() {
    return Object.fromEntries(calIDs.map((k) => [k, $v("#vCal" + k).value]));
  }
  function fillCalendar() {
    const v = { ...calValues(), ...(pref.calendar || {}) },
      i = idx();
    options(
      $v("#vCalCountry"),
      [
        ...new Set([
          ...i.competitions.map((c) => c.country),
          ...(v.Country ? [v.Country] : []),
        ]),
      ]
        .sort()
        .map((c) => [c, nameCountry(c)]),
      v.Country,
      "Tutti",
    );
    const competitions = i.competitions
      .filter(
        (c) =>
          !$v("#vCalCountry").value || c.country === $v("#vCalCountry").value,
      )
      .map((c) => c.name);
    // A persisted or sidebar-selected empty competition remains an explicit zero,
    // never an implicit fallback to all competitions in that country.
    if (v.Competition && !competitions.includes(v.Competition))
      competitions.push(v.Competition);
    options(
      $v("#vCalCompetition"),
      competitions.map((name) => [
        name,
        i.competitions.some((c) => c.name === name)
          ? name
          : name + " · nessun incontro importato",
      ]),
      v.Competition,
      "Tutte",
    );
    options(
      $v("#vCalSeason"),
      [
        ...new Set([
          ...i.entries.map((x) => x.season),
          ...(Number.isInteger(+v.Season) &&
          +v.Season >= 1900 &&
          +v.Season <= 2099
            ? [+v.Season]
            : []),
        ]),
      ]
        .sort((a, b) => b - a)
        .map((y) => [y, seasonLabel(y)]),
      v.Season,
      "Tutte",
    );
    const phases = new Set(
      i.entries.flatMap((x) => {
        const c = TAFixtures.context(x.r);
        return [
          c.phase,
          ...(c.matchday != null ? ["Giornata " + c.matchday] : []),
        ];
      }),
    );
    if (v.Phase) phases.add(v.Phase);
    options(
      $v("#vCalPhase"),
      [...phases].sort().map((p) => [p, phaseLabel[p] || p]),
      v.Phase,
      "Tutte",
    );
    for (const k of calIDs.filter(
      (k) => !["Country", "Competition", "Season", "Phase"].includes(k),
    ))
      $v("#vCal" + k).value = v[k] || (k === "Sort" ? "asc" : "");
  }
  function calendarEntries() {
    const f = calValues(),
      q = V.fold(f.Team),
      from = V.date(f.From),
      to = V.date(f.To),
      aliases = new Set(
        idx()
          .clubs.filter((c) => c.aliases.some((a) => V.fold(a).includes(q)))
          .map((c) => c.id),
      );
    let xs = idx().entries.filter((x) => {
      const c = TAFixtures.context(x.r),
        phase = f.Phase.startsWith("Giornata ")
          ? "Giornata " + c.matchday
          : c.phase;
      return (
        (!f.Country || f.Country === x.comp.country) &&
        (!f.Competition || f.Competition === x.comp.name) &&
        (!f.Season || +f.Season === x.season) &&
        (!f.Phase || f.Phase === phase) &&
        (from == null || x.r.d >= from) &&
        (to == null || x.r.d <= to) &&
        (!q || aliases.has(x.ids.H) || aliases.has(x.ids.A)) &&
        (!f.Favorite ||
          watched(x.key) ||
          watched(x.ids.H) ||
          watched(x.ids.A)) &&
        (!f.Status ||
          (f.Status === "played"
            ? V.ftKnown(x.r)
            : f.Status === "scheduled"
              ? x.r.up
              : !V.ftKnown(x.r) && !x.r.up))
      );
    });
    return xs.sort((a, b) =>
      f.Sort === "club"
        ? a.r.H.localeCompare(b.r.H, "it") || a.r.d - b.r.d
        : (f.Sort === "desc" ? -1 : 1) * (a.r.d - b.r.d) ||
          a.key.localeCompare(b.key),
    );
  }
  function renderCalendar() {
    const xs = calendarEntries();
    calendarPage = Math.max(
      0,
      Math.min(calendarPage, Math.ceil(xs.length / 50) - 1),
    );
    $v("#vCalendarRows").innerHTML = table(
      xs.slice(calendarPage * 50, calendarPage * 50 + 50),
    );
    $v("#vCalCount").textContent =
      `${xs.length} incontri presenti · archivio locale, copertura non garantita`;
    $v("#vCalPage").textContent =
      `Pagina ${calendarPage + 1} / ${Math.max(1, Math.ceil(xs.length / 50))}`;
    $v("#vCalPrev").disabled = calendarPage === 0;
    $v("#vCalNext").disabled = (calendarPage + 1) * 50 >= xs.length;
    pref.calendar = calValues();
    save();
  }
  function renderDashboard() {
    const i = idx(),
      d = V.date(today()),
      xs = i.entries
        .filter((x) => x.r.d >= d && x.r.d < d + 7 * V.DAY)
        .sort((a, b) => a.r.d - b.r.d);
    $v("#vDashboardUpcoming").innerHTML =
      `<p class="v-note">${xs.filter((x) => x.r.d === d).length} oggi · ${xs.length} nei sette giorni (oggi incluso). Orari/stati importati da verificare.</p>` +
      table(xs.slice(0, 8));
    const fav = i.entries
      .filter((x) => watched(x.key) || watched(x.ids.H) || watched(x.ids.A))
      .sort((a, b) => b.r.d - a.r.d);
    const clubs = i.clubs.filter((c) => watched(c.id));
    $v("#vWatchlist").innerHTML =
      clubs.map((c) => `<p>${watchButton(c.id)} ${esc(c.name)}</p>`).join("") +
      table(fav.slice(0, 5));
    $v("#vResume").disabled = !pref.lastAnalysis;
    $v("#vQuality").textContent =
      `${i.entries.length} incontri utilizzabili; ${window.taProjectionReport?.preservedUnresolved || 0} osservazioni irrisolte escluse dalle statistiche. FT mancanti: ${i.entries.filter((x) => !x.r.up && !V.ftKnown(x.r)).length}; HT mancanti nei risultati: ${i.entries.filter((x) => V.ftKnown(x.r) && V.htTotal(x.r) == null).length}. Risultati con data futura: ${i.entries.filter((x) => V.ftKnown(x.r) && x.r.d > V.date(today())).length}, esclusi dalle statistiche. Verifica completezza per stagione nell’Area tecnica.`;
  }
  function search() {
    const q = V.fold($v("#vSearch").value),
      host = $v("#vSearchResults");
    if (!q) {
      host.innerHTML = "";
      return;
    }
    const i = idx(),
      cs = i.clubs
        .filter((c) => c.aliases.some((a) => V.fold(a).includes(q)))
        .slice(0, 10),
      ids = new Set(cs.map((c) => c.id));
    const comps = i.competitions.filter((c) =>
      V.fold(c.name + " " + nameCountry(c.country) + " " + c.country).includes(
        q,
      ),
    );
    const xs = i.entries
      .filter(
        (x) =>
          ids.has(x.ids.H) ||
          ids.has(x.ids.A) ||
          V.fold(x.r.H + " " + x.r.A + " " + iso(x.r.d)).includes(q),
      )
      .slice(0, 10);
    host.innerHTML =
      cs
        .map(
          (c) =>
            `<button type="button" data-v-club="${esc(c.id)}">Club: ${esc(c.name)} · ${esc(nameCountry(c.country))}</button>`,
        )
        .join("") +
      comps
        .map(
          (c) =>
            `<button type="button" data-v-comp="${esc(c.name)}">${esc(nameCountry(c.country))} → ${esc(c.name)}</button>`,
        )
        .join("") +
      table(xs);
  }
  function renderCountries() {
    const box = $v("#sideLeagues"),
      loaded = idx().competitions,
      available = new Map([
        ...SUPPORTED_LEAGUES.map((c) => [
          c.name,
          { name: c.name, country: TAClubs.countries[c.name] || "UNSPECIFIED" },
        ]),
        ...loaded.map((c) => [c.name, c]),
      ]);
    const countries = [
        ...new Set([...available.values()].map((c) => c.country)),
      ],
      pins = pref.pins || [],
      order = pref.countryOrder || [];
    countries.sort(
      (a, b) =>
        Number(pins.includes(b)) - Number(pins.includes(a)) ||
        (order.includes(a) ? order.indexOf(a) : 999) -
          (order.includes(b) ? order.indexOf(b) : 999) ||
        nameCountry(a).localeCompare(nameCountry(b), "it"),
    );
    const counts = new Map();
    for (const x of idx().entries)
      counts.set(x.comp.name, (counts.get(x.comp.name) || 0) + 1);
    box.innerHTML = countries
      .map(
        (country, n) =>
          `<details class="v-country" data-v-country="${esc(country)}" ${pref.openCountries?.includes(country) ? "open" : ""}><summary><span>${esc(nameCountry(country))}</span><span class="v-country-controls"><button type="button" data-v-pin="${esc(country)}" aria-label="Fissa ${esc(nameCountry(country))}" aria-pressed="${pins.includes(country)}">${pins.includes(country) ? "★" : "☆"}</button><button type="button" data-v-up="${esc(country)}" aria-label="Sposta su ${esc(nameCountry(country))}" ${n === 0 || pins.includes(country) !== pins.includes(countries[n - 1]) ? "disabled" : ""}>↑</button><button type="button" data-v-down="${esc(country)}" aria-label="Sposta giù ${esc(nameCountry(country))}" ${n === countries.length - 1 || pins.includes(country) !== pins.includes(countries[n + 1]) ? "disabled" : ""}>↓</button></span></summary>${[
            ...available.values(),
          ]
            .filter((c) => c.country === country)
            .sort((a, b) => a.name.localeCompare(b.name, "it"))
            .map(
              (c) =>
                `<button type="button" class="side-league ${c.name === selectedLeague() ? "active" : ""}" aria-pressed="${c.name === selectedLeague()}" data-v-comp="${esc(c.name)}"><span>${esc(c.name)}</span><small>${counts.get(c.name) || 0} gare</small></button>`,
            )
            .join("")}</details>`,
      )
      .join("");
    box.querySelectorAll("details").forEach((el) =>
      el.addEventListener("toggle", () => {
        pref.openCountries = [...box.querySelectorAll("details[open]")].map(
          (x) => x.dataset.vCountry,
        );
        save();
      }),
    );
    return countries;
  }
  function renderMatch() {
    const host = $v("#vMatchPanel");
    if (!activeFixture) {
      host.innerHTML =
        '<p class="v-note">Apri una gara dal Calendario generale per le nuove statistiche contestuali, H2H e segnali. L’analisi rc5 sottostante resta disponibile anche per selezione manuale.</p>';
      return;
    }
    const x = activeFixture,
      r = x.r,
      scope = $v("#vMatchScope")?.value || pref.matchScope || "competition",
      limit = $v("#vH2HLimit")?.value || "5",
      cutoff = Math.min(r.d, V.day(Date.now()));
    pref.matchScope = scope;
    const base = {
      country: x.comp.country,
      competition: r.lg,
      season: "all",
      scope,
      cutoff: r.d,
    };
    const home = V.profile(idx(), { ...base, club: x.ids.H, venue: "home" }),
      away = V.profile(idx(), { ...base, club: x.ids.A, venue: "away" }),
      ht = V.profile(idx(), { ...base, club: x.ids.H, venue: "all" }),
      at = V.profile(idx(), { ...base, club: x.ids.A, venue: "all" }),
      h2 = V.h2h(
        idx(),
        x.ids.H,
        x.ids.A,
        cutoff,
        limit,
        scope === "competition" ? r.lg : null,
      );
    window.taVMatch = {
      key: x.key,
      home,
      away,
      homeTotal: ht,
      awayTotal: at,
      h2h: h2,
    };
    const signals = V.interpret(
      idx()
        .entries.map((x) => x.r)
        .sort((a, b) => a.d - b.d),
      r,
    );
    window.taVSignals = signals;
    host.innerHTML = `<div class="v-card"><h3>${esc(r.H)} – ${esc(r.A)}</h3><p class="v-note">${iso(r.d)} · ${esc(r.lg)} · ${esc(V.clock(r))} · ${esc(phaseLabel[TAFixtures.context(r).phase] || TAFixtures.context(r).phase)}. Statistiche prima del ${iso(cutoff)}: giorno della gara e risultati futuri esclusi.</p><div class="v-filters"><label>Perimetro nuove statistiche<select id="vMatchScope"><option value="competition">Solo campionato / competizione</option><option value="all">Tutte le competizioni ufficiali disponibili</option></select></label><label>H2H<select id="vH2HLimit"><option value="5">Ultimi 5</option><option value="10">Ultimi 10</option><option value="all">Tutto lo storico disponibile</option></select></label></div><div class="v-grid"><div><h3>${esc(r.H)} · ultime 5 in casa</h3>${statsMarkup(home.recent5, "Ultime 5 gare effettive in casa")}<details><summary>Ultime 10 totali · ${esc(r.H)}</summary>${statsMarkup(ht.recent10, "Ultime 10 totali")}</details><p class="v-note">Riposo ${ht.restDays ?? "non noto"} giorni · ${ht.congestion7} gare / 7gg · ${ht.congestion14} / 14gg. ${watchButton(x.ids.H)}</p></div><div><h3>${esc(r.A)} · ultime 5 in trasferta</h3>${statsMarkup(away.recent5, "Ultime 5 gare effettive in trasferta")}<details><summary>Ultime 10 totali · ${esc(r.A)}</summary>${statsMarkup(at.recent10, "Ultime 10 totali")}</details><p class="v-note">Riposo ${at.restDays ?? "non noto"} giorni · ${at.congestion7} gare / 7gg · ${at.congestion14} / 14gg. ${watchButton(x.ids.A)}</p></div></div><details open><summary>Confronti diretti · ${h2.n} risultati disponibili</summary>${statsMarkup(h2, "H2H dal punto di vista di " + r.H)}</details><details><summary>Campioni completi del motore comune</summary><div class="v-grid">${statsMarkup(home, "Casa · campione completo")}${statsMarkup(away, "Trasferta · campione completo")}</div></details><h3>Lettura descrittiva dei mercati</h3><p class="v-note">${esc(signals.rules)} Le formule e i voti rc5 sottostanti non cambiano. Perimetro segnali: solo ${esc(r.lg)}.</p>${signals.top.length ? signals.top.map((s) => `<article class="v-signal ${s.state}"><strong>${esc(s.label)} — evidenza ${s.state}</strong><p>Casa ${pct(s.h)}, ospite ${pct(s.a)}, lega ${pct(s.league)}. Scarti ${num(s.dh)} / ${num(s.da)} punti percentuali.</p><small>${esc(s.counter)} Ultime 5: casa ${pct(s.hRecent)}, ospite ${pct(s.aRecent)}; possono contraddire il campione più ampio. Data ${signals.date}; copertura dell’archivio da verificare, selezione incompleta possibile.</small></article>`).join("") : "<p>Nessun mercato con evidenza concorde sufficiente.</p>"}<details><summary>Tutti gli otto mercati e dati insufficienti</summary>${signals.markets.map((s) => `<p>${esc(s.label)}: ${s.state} · casa ${pct(s.h)} · ospite ${pct(s.a)} · lega ${pct(s.league)}</p>`).join("")}</details></div>`;
    $v("#vMatchScope").value = scope;
    $v("#vH2HLimit").value = limit;
    $v("#vMatchScope").onchange = renderMatch;
    $v("#vH2HLimit").onchange = renderMatch;
    save();
  }
  function openMatch(key) {
    const x = idx().entries.find((x) => x.key === key);
    if (!x) {
      $v("#vSearchResults").textContent =
        "Gara non più disponibile: aggiorna il calendario.";
      return;
    }
    activeFixture = x;
    pref.lastAnalysis = { kind: "match", key };
    save();
    if (![...$v("#lg").options].some((o) => o.value === x.r.lg))
      $v("#lg").add(new Option(x.r.lg, x.r.lg));
    $v("#lg").value = x.r.lg;
    onLeagueSelectionChanged(true);
    comparisonOptions();
    $v("#ch").value = x.r.H;
    $v("#ca").value = x.r.A;
    compareMatch(x.r.H, x.r.A, x.r.d);
    openWorkspace("analisi");
    $v("#analysisDate").value = iso(x.r.d);
    renderMatch();
  }
  const previousCompare = compareMatch;
  compareMatch = function (H, A, cutoff) {
    if (
      activeFixture &&
      (activeFixture.r.H !== H ||
        activeFixture.r.A !== A ||
        activeFixture.r.d !== cutoff ||
        activeFixture.r.lg !== selectedLeague())
    )
      activeFixture = null;
    const out = previousCompare(H, A, cutoff);
    renderMatch();
    return out;
  };
  const previousOpen = openWorkspace;
  openWorkspace = function (id, opt = {}) {
    previousOpen(id, opt);
    if (id === "dati" && coverageDirty && $v("#taCoverage")?.open)
      taRenderCoverage();
    if (id === "dashboard") renderDashboard();
    if (id === "calendario") {
      fillCalendar();
      renderCalendar();
    }
    if (id === "comparatore") {
      for (const s of ["a", "b"]) populateSide(s);
      renderComparator();
    }
    if (id === "analisi") {
      if (activeFixture) $v("#analysisDate").value = iso(activeFixture.r.d);
      renderMatch();
    }
  };
  // The complete 138-season coverage audit is deliberately lazy; its controls are unchanged.
  const originalCoverage = taRenderCoverage;
  let coverageDirty = true;
  taRenderCoverage = function (...args) {
    coverageDirty = true;
    if (document.body.dataset.workspace === "dati" && $v("#taCoverage")?.open) {
      const value = originalCoverage(...args);
      coverageDirty = false;
      return value;
    }
    if ($v("#taCoverageSummary"))
      $v("#taCoverageSummary").textContent =
        "Apri questo prospetto per calcolare la copertura dell’archivio. Nessun confronto completo viene eseguito all’avvio.";
  };
  $v("#taCoverage")?.addEventListener("toggle", () => {
    if ($v("#taCoverage").open && coverageDirty) taRenderCoverage();
  });
  // rc5 stores an empty snapshot at startup. v0.2V does not: compare a missing
  // IDB key as undefined (the transaction's raw value), never as a fabricated row.
  // A concurrent writer still fails the unchanged transaction/fingerprint checks.
  const previousAtomicCommit = taAtomicCommit;
  taAtomicCommit = async function (pending, ...args) {
    if (pending.diskToken === TARecovery.stable(null)) {
      const raw = await taStoreGet("matches");
      if (raw === undefined) pending.diskToken = TARecovery.stable(undefined);
    }
    return previousAtomicCommit(pending, ...args);
  };
  const previousSidebar = refreshSidebar;
  refreshSidebar = function () {
    if (window.taVReady) renderCountries();
    else previousSidebar();
  };
  const nav = [
    ["dashboard", "Dashboard"],
    ["calendario", "Calendario generale"],
    ["analisi", "Centro Analisi"],
    ["scanner", "Scanner e segnali"],
    ["strategie", "Strategie e Backtest"],
    ["classifiche", "Classifiche"],
    ["squadre", "Squadre"],
    ["validazione", "Validazione"],
  ];
  $v(".workspace-nav").innerHTML =
    nav
      .map(
        ([id, l]) =>
          `<button type="button" data-open-workspace="${id}">${esc(l)}</button>`,
      )
      .join("") + '<button data-open-workspace="dati">Area tecnica</button>';
  $v("#appSidebar nav").insertAdjacentHTML(
    "afterbegin",
    '<a href="#dashboard" class="side-nav-link" data-workspace-link="dashboard">Dashboard</a><a href="#calendario" class="side-nav-link" data-workspace-link="calendario">Calendario generale</a><a href="#comparatore" class="side-nav-link" data-workspace-link="comparatore">Comparatore squadre</a>',
  );
  for (const side of ["a", "b"]) {
    const c = controls(side);
    for (const k of [
      "Country",
      "Competition",
      "Club",
      "Season",
      "Scope",
      "Venue",
      "From",
      "To",
    ])
      c[k].onchange = () => {
        populateSide(side, k);
        renderComparator();
      };
    c.Search.oninput = () => {
      populateSide(side, "Search");
      renderComparator();
    };
  }
  $v("#vCmpRun").onclick = renderComparator;
  $v("#vCmpSwap").onclick = () => {
    const a = sideValues("a"),
      b = sideValues("b");
    controls("a").Search.value = b.Search;
    controls("b").Search.value = a.Search;
    populateSide("a", null, b);
    populateSide("b", null, a);
    renderComparator();
  };
  $v("#vCmpReset").onclick = () => {
    for (const s of ["a", "b"]) {
      controls(s).Search.value = "";
      populateSide(s, null, {
        Country: "",
        Competition: "",
        Club: "",
        Season: "all",
        Scope: "competition",
        Venue: "all",
        From: "",
        To: "",
      });
    }
    renderComparator();
  };
  $v("#vCalendarFilters").onchange = (ev) => {
    if (ev.target.id === "vCalCountry") $v("#vCalCompetition").value = "";
    if (JSON.stringify(calValues()) === JSON.stringify(pref.calendar)) return;
    calendarPage = 0;
    pref.calendar = calValues();
    fillCalendar();
    renderCalendar();
  };
  $v("#vCalTeam").oninput = () => {
    calendarPage = 0;
    renderCalendar();
  };
  $v("#vCalPrev").onclick = () => {
    calendarPage--;
    renderCalendar();
  };
  $v("#vCalNext").onclick = () => {
    calendarPage++;
    renderCalendar();
  };
  $v("#vCalReset").onclick = () => {
    pref.calendar = {};
    for (const k of calIDs) $v("#vCal" + k).value = "";
    calendarPage = 0;
    fillCalendar();
    renderCalendar();
  };
  function setRange(week) {
    $v("#vCalFrom").value = today();
    $v("#vCalTo").value = iso(V.date(today()) + (week ? 6 : 0) * V.DAY);
    calendarPage = 0;
    renderCalendar();
  }
  $v("#vCalToday").onclick = () => setRange(false);
  $v("#vCalWeek").onclick = () => setRange(true);
  $v("#vCalExport").onclick = () => {
    const csvCell = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"',
      data = [
        [
          "Date",
          "VerifiedTime",
          "HomeTeam",
          "AwayTeam",
          "Competition",
          "Season",
          "FTHG",
          "FTAG",
          "HTGoals",
          "CanonicalIdentity",
        ],
        ...calendarEntries().map((x) => [
          iso(x.r.d),
          V.clock(x.r),
          x.r.H,
          x.r.A,
          x.r.lg,
          x.season,
          V.ftKnown(x.r) ? x.r.h : "",
          V.ftKnown(x.r) ? x.r.a : "",
          V.htTotal(x.r),
          x.key,
        ]),
      ]
        .map((r) => r.map(csvCell).join(","))
        .join("\r\n");
    const a = document.createElement("a"),
      u = URL.createObjectURL(
        new Blob(["\uFEFF" + data], { type: "text/csv;charset=utf-8" }),
      );
    a.href = u;
    a.download = "TA_v02V_calendario_filtrato.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  };
  $v("#vSearch").oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(search, 150);
  };
  $v("#vResume").onclick = () => {
    if (!pref.lastAnalysis) return;
    if (pref.lastAnalysis.kind === "comparator") openWorkspace("comparatore");
    else openMatch(pref.lastAnalysis.key);
  };
  document.addEventListener(
    "click",
    (ev) => {
      let b = ev.target.closest("[data-v-match]");
      if (b) {
        openMatch(b.dataset.vMatch);
        return;
      }
      b = ev.target.closest("[data-v-watch]");
      if (b) {
        pref.watch = pref.watch || [];
        const k = b.dataset.vWatch;
        pref.watch = watched(k)
          ? pref.watch.filter((x) => x !== k)
          : [...pref.watch, k];
        save();
        if (document.body.dataset.workspace === "dashboard") renderDashboard();
        if (document.body.dataset.workspace === "calendario") renderCalendar();
        if (document.body.dataset.workspace === "analisi") renderMatch();
        return;
      }
      b = ev.target.closest("[data-v-comp]");
      if (b) {
        const comp = idx().competitions.find((c) => c.name === b.dataset.vComp);
        const name = b.dataset.vComp;
        if (activeFixture && activeFixture.r.lg !== name) activeFixture = null;
        if (![...$v("#lg").options].some((o) => o.value === name))
          $v("#lg").add(new Option(name, name));
        $v("#lg").value = name;
        onLeagueSelectionChanged();
        pref.calendar = {
          ...pref.calendar,
          Competition: b.dataset.vComp,
          Country: comp?.country || TAClubs.countries[b.dataset.vComp] || "",
        };
        openWorkspace("calendario");
        closeSide();
        return;
      }
      b = ev.target.closest("[data-v-club]");
      if (b) {
        const club = idx().clubs.find((c) => c.id === b.dataset.vClub),
          comp = idx().competitions.find(
            (c) => c.name === club.competitions[0],
          );
        openWorkspace("comparatore");
        controls("a").Search.value = "";
        populateSide("a", null, {
          Country: comp.country,
          Competition: comp.name,
          Club: club.id,
          Season: "all",
          Scope: "all",
          Venue: "all",
        });
        renderComparator();
        return;
      }
      b = ev.target.closest("[data-v-pin],[data-v-up],[data-v-down]");
      if (b) {
        ev.preventDefault();
        ev.stopPropagation();
        const countries = [
          ...$v("#sideLeagues").querySelectorAll("details"),
        ].map((x) => x.dataset.vCountry);
        if (b.dataset.vPin) {
          const k = b.dataset.vPin;
          pref.pins = (pref.pins || []).includes(k)
            ? pref.pins.filter((x) => x !== k)
            : [...(pref.pins || []), k];
        } else {
          const k = b.dataset.vUp || b.dataset.vDown,
            n = countries.indexOf(k),
            to = n + (b.dataset.vUp ? -1 : 1);
          if (to >= 0 && to < countries.length) {
            [countries[n], countries[to]] = [countries[to], countries[n]];
            pref.countryOrder = countries;
          }
        }
        save();
        renderCountries();
      }
    },
    false,
  );
  window.taVOpenMatch = openMatch;
  window.taVIndex = idx;
  window.taVRenderComparator = renderComparator;
  window.taVFilterSide = filterSide;
  window.taVInitialized = Promise.all([
    window.taAppInitialized,
    window.taStabAreaReady,
  ]).then(() => {
    window.taVReady = true;
    for (const s of ["a", "b"]) {
      const v = pref["side" + s] || {};
      controls(s).Search.value = v.Search || "";
      populateSide(s, null, v);
    }
    fillCalendar();
    renderCountries();
    openWorkspace("dashboard", { scroll: false });
    return true;
  });
})();
