// Partecipazione digitale di Antonio e Giulia.
// Due ante in carta goffrata chiuse da un fiocco: al tocco il fiocco si scioglie, le ante si aprono,
// parte la musica e compare il cielo ad acquerello con i nomi. Poi il cartoncino si dispiega,
// le conferme finiscono nel database degli sposi, il conto alla rovescia scorre.
(() => {
  "use strict";

  const DATI = {
    dataTesto: "27 maggio 2027",
    inizio: Date.UTC(2027, 4, 27, 8, 0, 0), // 10:00 ora italiana
    whatsapp: { antonio: { nome: "Antonio", numero: "393203142984" }, giulia: { nome: "Giulia", numero: "393209549565" } },
  };
  // chiave pubblica ("publishable"): fatta per stare nel browser; il database accetta solo nozze_conferma()
  const SUPABASE = { url: "https://cqfxjvrpspvycocvxghv.supabase.co", chiave: "sb_publishable_VQS48ywRaUafRirZIyo5EQ_8KMjSDfm" };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const html = document.documentElement;
  const scena = $("#scena"), fiocco = $("#fiocco"), copertina = $("#copertina"), partecipazione = $("#partecipazione");
  const riduci = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dopo = (ms, fn) => setTimeout(fn, ms);
  const memoria = {
    leggi(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    scrivi(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* navigazione privata */ } },
    togli(k) { try { localStorage.removeItem(k); } catch (e) { /* niente */ } },
  };

  // ---------- bordi sfrangiati: poligono calcolato sulle misure reali ----------
  const forme = {
    pentagono: (w, h) => [[[0, h], [0, .48 * h], [.30 * w, 0], [.88 * w, .36 * h], [w, .86 * h], [w, h]], [1, 1, 1, 1, 1, 0]],
    centro: (w, h) => [[[0, 0], [w, 0], [w, h], [0, h]], [0, 1, 0, 1]],
    basso: (w, h) => [[[0, 0], [w, 0], [w, h], [0, h]], [0, 1, 1, 1]],
    biglietto: (w, h) => [[[0, 0], [w, 0], [w, h], [0, h]], [1, 1, 1, 1]],
    "anta-sx": (w, h) => [[[0, 0], [w, 0], [w, h], [0, h]], [0, 1, 0, 0]],
    "anta-dx": (w, h) => [[[0, 0], [w, 0], [w, h], [0, h]], [0, 0, 0, 1]],
  };

  function casuale(seme) {
    let s = (seme * 9301 + 49297) % 233280 || 1;
    return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  }

  function sfrangia(el) {
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h) return;
    const [punti, ruvidi] = forme[el.dataset.forma](w, h);
    const rnd = casuale(+el.dataset.seme || 1);
    const amp = Math.min(2.6, Math.max(1.3, w / 200));
    const out = [];
    for (let i = 0; i < punti.length; i++) {
      const [ax, ay] = punti[i], [bx, by] = punti[(i + 1) % punti.length];
      out.push([ax, ay]);
      if (!ruvidi[i]) continue;
      const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy), n = Math.max(2, Math.round(L / 2.6));
      const nx = -dy / L, ny = dx / L; // verso l'interno (poligoni in senso orario)
      let o = 0;
      for (let k = 1; k < n; k++) {
        o += (rnd() - .5) * amp * .9;
        if (rnd() < .04) o += amp * .8;
        o = Math.min(amp, Math.max(0, o));
        const t = k / n, fine = Math.min(1, k, n - k);
        out.push([ax + dx * t + nx * o * fine, ay + dy * t + ny * o * fine]);
      }
    }
    const poli = "polygon(" + out.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(",") + ")";
    el.style.clipPath = poli;
    el.style.webkitClipPath = poli;
  }

  const sagome = $$("[data-forma]");
  const osserva = "ResizeObserver" in window ? new ResizeObserver((voci) => voci.forEach((v) => sfrangia(v.target))) : null;
  sagome.forEach((el) => { sfrangia(el); osserva && osserva.observe(el); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => sagome.forEach(sfrangia));

  // ---------- nome dell'invitato dal link: ...?per=Famiglia%20Rossi ----------
  const per = (new URLSearchParams(location.search).get("per") || "").trim().slice(0, 60);
  if (per) {
    $$("[data-per]").forEach((p) => { p.textContent = `per ${per}`; p.hidden = false; });
    fiocco.setAttribute("aria-label", `Sciogli il fiocco e apri l'invito per ${per}`);
  }

  // ---------- musica (musica/brano.mp3): parte al tocco del fiocco ----------
  const brano = $("#brano"), pulsanteMusica = $("#musica");
  let musicaVoluta = true, musicaPronta = false;
  function sfuma(da, a, ms) {
    const t0 = performance.now();
    const passo = (t) => { const k = Math.min(1, (t - t0) / ms); brano.volume = da + (a - da) * k; if (k < 1) requestAnimationFrame(passo); };
    requestAnimationFrame(passo);
  }
  function suona() {
    brano.volume = 0;
    const p = brano.play();
    if (p && p.then) p.then(() => { musicaPronta = true; sfuma(0, .6, 2500); }).catch(() => { musicaPronta = false; });
  }
  function aggiornaPulsante() {
    pulsanteMusica.setAttribute("aria-pressed", String(musicaVoluta));
    pulsanteMusica.setAttribute("aria-label", musicaVoluta ? "Spegni la musica" : "Accendi la musica");
  }
  pulsanteMusica.addEventListener("click", () => {
    musicaVoluta = !musicaVoluta;
    if (musicaVoluta) suona(); else brano.pause();
    aggiornaPulsante();
  });
  brano.addEventListener("error", () => { musicaPronta = false; pulsanteMusica.hidden = true; });
  document.addEventListener("visibilitychange", () => {
    if (!musicaPronta) return;
    if (document.hidden) brano.pause(); else if (musicaVoluta) brano.play().catch(() => {});
  });

  // ---------- apertura ----------
  let avviata = false;
  const blocca = (si) => html.classList.toggle("bloccato", si);

  function chiudi() {
    blocca(true);
    scena.hidden = false;
    scena.classList.add("senza-transizioni");
    scena.classList.remove("slega", "apri");
    html.classList.remove("aperto");
    copertina.classList.remove("rivelata");
    void scena.offsetWidth;
    scena.classList.remove("senza-transizioni");
    avviata = false;
  }

  function mostraSubito() {
    scena.hidden = true;
    blocca(false);
    html.classList.add("aperto");
    copertina.classList.add("rivelata");
  }

  let giaAperto = false;
  try { giaAperto = sessionStorage.getItem("invito-aperto") === "1"; } catch (e) { /* niente */ }
  if (giaAperto) mostraSubito(); else blocca(true);

  fiocco.addEventListener("click", apri);

  function apri() {
    if (avviata) return;
    avviata = true;
    try { sessionStorage.setItem("invito-aperto", "1"); } catch (e) { /* niente */ }
    window.scrollTo(0, 0);
    if (musicaVoluta) suona();
    if (riduci) { mostraSubito(); mostraPulsanteMusica(); return; }
    scena.classList.add("slega");
    dopo(650, () => { scena.classList.add("apri"); html.classList.add("aperto"); });
    dopo(1700, () => copertina.classList.add("rivelata"));
    dopo(3000, () => { scena.hidden = true; blocca(false); mostraPulsanteMusica(); });
  }
  function mostraPulsanteMusica() {
    // il pulsante compare solo se il brano esiste ed è partito
    dopo(400, () => { if (musicaPronta) { aggiornaPulsante(); pulsanteMusica.hidden = false; } });
  }

  $("#rivedi").addEventListener("click", () => { window.scrollTo(0, 0); brano.pause(); chiudi(); });

  // ---------- il cartoncino si dispiega quando arriva sullo schermo ----------
  if (!riduci && "IntersectionObserver" in window) {
    partecipazione.classList.add("piegata");
    const io = new IntersectionObserver((voci) => {
      if (!voci.some((v) => v.isIntersecting)) return;
      io.disconnect();
      partecipazione.classList.add("dispiega");
      requestAnimationFrame(() => partecipazione.classList.remove("piegata"));
    }, { rootMargin: "0px 0px -30% 0px" });
    io.observe(partecipazione);
  }

  // ---------- conto alla rovescia ----------
  const cifre = { g: $("#c-giorni"), o: $("#c-ore"), m: $("#c-minuti"), s: $("#c-secondi") };
  const due = (n) => String(n).padStart(2, "0");
  function conta() {
    let r = Math.max(0, Math.floor((DATI.inizio - Date.now()) / 1000));
    const g = Math.floor(r / 86400); r -= g * 86400;
    const o = Math.floor(r / 3600); r -= o * 3600;
    const m = Math.floor(r / 60), s = r - m * 60;
    cifre.g.textContent = String(g); cifre.o.textContent = due(o); cifre.m.textContent = due(m); cifre.s.textContent = due(s);
  }
  conta();
  setInterval(conta, 1000);

  // ---------- copia IBAN ----------
  const copiaIban = $("#copia-iban");
  copiaIban.addEventListener("click", async () => {
    const iban = $("#iban").textContent.replace(/\s+/g, "");
    let fatto = false;
    try { await navigator.clipboard.writeText(iban); fatto = true; } catch (e) {
      const t = document.createElement("textarea");
      t.value = iban; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select();
      try { fatto = document.execCommand("copy"); } catch (e2) { fatto = false; }
      t.remove();
    }
    copiaIban.textContent = fatto ? "IBAN copiato" : "Tieni premuto sull'IBAN per copiarlo";
    dopo(2600, () => { copiaIban.textContent = "Copia IBAN"; });
  });

  // ---------- conferma della presenza ----------
  const form = $("#rsvp"), soloSi = $("#solo-si"), persone = $("#persone"), stato = $("#stato-rsvp");
  const nome = $("#rsvp-nome"), invia = $("#invia-risposta"), ripiego = $("#ripiego"), grazie = $("#grazie");
  if (per) nome.value = per;
  let n = 1;
  const aggiornaPersone = () => { persone.textContent = String(n); };
  $(".meno", form).addEventListener("click", () => { n = Math.max(1, n - 1); aggiornaPersone(); });
  $(".piu", form).addEventListener("click", () => { n = Math.min(12, n + 1); aggiornaPersone(); });
  form.addEventListener("change", (e) => {
    if (e.target.name === "presenza") { soloSi.hidden = e.target.value === "no"; $("#errore-presenza").hidden = true; }
  });
  nome.addEventListener("input", () => { $("#errore-nome").hidden = true; });

  function testoWhatsapp(r, sposo) {
    let t;
    if (r.presenza) {
      t = `Ciao ${sposo.nome}! Sono ${r.nome} e confermo la mia presenza al vostro matrimonio del ${DATI.dataTesto}.`;
      if (r.persone > 1) t += ` Saremo in ${r.persone}.`;
      t += r.allergie ? ` Allergie o intolleranze: ${r.allergie}.` : " Nessuna allergia o intolleranza.";
    } else {
      t = `Ciao ${sposo.nome}! Sono ${r.nome}: purtroppo non potrò essere presente al vostro matrimonio del ${DATI.dataTesto}.`;
    }
    if (r.messaggio) t += `\n\n${r.messaggio}`;
    return t;
  }
  function collegaWhatsapp(r, contenitore) {
    $$("[data-wa]", contenitore).forEach((a) => {
      const sposo = DATI.whatsapp[a.dataset.wa];
      a.href = `https://wa.me/${sposo.numero}?text=${encodeURIComponent(testoWhatsapp(r, sposo))}`;
    });
  }
  function mostraGrazie(r, giaInviata) {
    $("#grazie-titolo").textContent = `Grazie, ${r.nome}!`;
    $("#grazie-testo").textContent = r.presenza
      ? `${giaInviata ? "Hai già confermato" : "Abbiamo ricevuto la tua conferma"}${r.persone > 1 ? ` per ${r.persone} persone` : ""}. Ci vediamo il 27 maggio!`
      : `${giaInviata ? "Ci hai già fatto sapere" : "Abbiamo ricevuto la tua risposta"}: ci mancherai, grazie per avercelo detto.`;
    collegaWhatsapp(r, grazie);
    form.hidden = true;
    grazie.hidden = false;
  }
  $("#cambia-risposta").addEventListener("click", () => {
    grazie.hidden = true; form.hidden = false; stato.textContent = ""; ripiego.hidden = true;
    memoria.togli("invito-risposta");
    nome.focus();
  });

  const salvata = memoria.leggi("invito-risposta");
  if (salvata) { try { mostraGrazie(JSON.parse(salvata), true); } catch (e) { memoria.togli("invito-risposta"); } }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const chi = nome.value.trim();
    const scelta = form.querySelector('input[name="presenza"]:checked');
    $("#errore-nome").hidden = !!chi;
    $("#errore-presenza").hidden = !!scelta;
    if (!chi) { nome.focus(); return; }
    if (!scelta) { form.querySelector('input[name="presenza"]').focus(); return; }

    const r = {
      nome: chi, presenza: scelta.value === "si", persone: scelta.value === "si" ? n : 0,
      allergie: scelta.value === "si" ? $("#rsvp-allergie").value.trim() : "", messaggio: $("#rsvp-messaggio").value.trim(),
    };
    invia.disabled = true; invia.textContent = "Invio in corso…";
    stato.classList.remove("errore-invio"); stato.textContent = ""; ripiego.hidden = true;
    const ctrl = new AbortController();
    const scade = setTimeout(() => ctrl.abort(), 12000);
    try {
      const risposta = await fetch(`${SUPABASE.url}/rest/v1/rpc/nozze_conferma`, {
        method: "POST", signal: ctrl.signal,
        headers: { "Content-Type": "application/json", apikey: SUPABASE.chiave },
        body: JSON.stringify({
          p_nome: r.nome, p_presenza: r.presenza, p_persone: r.persone || 1,
          p_allergie: r.allergie || null, p_messaggio: r.messaggio || null, p_per: per || null,
        }),
      });
      if (!risposta.ok) throw new Error(String(risposta.status));
      memoria.scrivi("invito-risposta", JSON.stringify(r));
      mostraGrazie(r, false);
      grazie.focus();
    } catch (err) {
      stato.classList.add("errore-invio");
      stato.textContent = "Non siamo riusciti a registrare la risposta. Mandala direttamente agli sposi su WhatsApp:";
      collegaWhatsapp(r, ripiego);
      ripiego.hidden = false;
    } finally {
      clearTimeout(scade);
      invia.disabled = false; invia.textContent = "Invia la risposta";
    }
  });
})();
