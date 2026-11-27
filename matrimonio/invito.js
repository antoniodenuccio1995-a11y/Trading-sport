// Partecipazione digitale di Antonio e Giulia.
// Due ante in carta goffrata chiuse da un fiocco: al tocco il nastro si scioglie, le ante si aprono,
// parte la musica e i nomi si scrivono a mano. Scorrendo, il cartoncino si dispiega, le foto si
// sviluppano, i biglietti si posano. Animazioni con GSAP e ScrollTrigger (cartella vendor/).
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
  const G = window.gsap, ST = window.ScrollTrigger;
  const effetti = !!(G && ST) && !riduci;
  if (effetti) G.registerPlugin(ST);
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
      const nx = -dy / L, ny = dx / L;
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

  // ---------- nome dell'invitato dal link: ...?per=Famiglia%20Rossi ----------
  const per = (new URLSearchParams(location.search).get("per") || "").trim().slice(0, 60);
  if (per) {
    $$("[data-per]").forEach((p) => { p.textContent = `per ${per}`; p.hidden = false; });
    fiocco.setAttribute("aria-label", `Sciogli il fiocco e apri l'invito per ${per}`);
  }

  // ---------- scrittura a mano: una maschera che segue il tratto della penna ----------
  function scrittura(contenitore) {
    const tl = G.timeline({ paused: true });
    const parole = $$(".parola", contenitore);
    parole.forEach((svg, i) => {
      const tratti = $$(".penna path", svg);
      const lun = tratti.map((p) => p.getTotalLength());
      const tot = lun.reduce((a, b) => a + b, 0) || 1;
      const durata = svg.classList.contains("p-e") ? .45 : 1.25;
      tratti.forEach((p, k) => {
        const L = lun[k];
        G.set(p, { strokeDasharray: `${L} ${L * 2 + 60}`, strokeDashoffset: L + 8 }); // nascosto, senza puntini
        tl.to(p, { strokeDashoffset: 0, duration: Math.max(.03, durata * L / tot), ease: "none" });
      });
      if (i < parole.length - 1) tl.to({}, { duration: .1 });
    });
    return tl;
  }
  const scrittaCopertina = effetti ? scrittura($(".copertina [data-scritta]")) : null;
  const scrittaFirma = effetti ? scrittura($(".piede [data-scritta]")) : null;

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
  function mostraPulsanteMusica() { dopo(400, () => { if (musicaPronta) { aggiornaPulsante(); pulsanteMusica.hidden = false; } }); }
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
  const blocca = (si) => html.classList.toggle("bloccato", si);
  const copertinaParti = [".c-intro", ".c-data", ".c-luogo", ".c-scorri"];
  let avviata = false;

  function finale() {
    // stato aperto senza animazioni (seconda visita nella stessa sessione, o movimento ridotto)
    scena.hidden = true;
    blocca(false);
    if (scrittaCopertina) scrittaCopertina.progress(1);
    if (effetti) attivaScorrimento();
  }

  let giaAperto = false;
  try { giaAperto = sessionStorage.getItem("invito-aperto") === "1"; } catch (e) { /* niente */ }
  if (giaAperto) finale();
  else {
    blocca(true);
    if (effetti) {
      G.set(fiocco, { xPercent: -48.5, yPercent: -43 });
      G.set(".mazzo.basso", { rotation: 180 });
      G.set(copertinaParti, { autoAlpha: 0, y: 14 });
      G.set(".mazzo", { autoAlpha: 0 });
      G.set(".cielo", { scale: 1.06 });
    }
  }

  fiocco.addEventListener("click", apri);

  function apri() {
    if (avviata) return;
    avviata = true;
    try { sessionStorage.setItem("invito-aperto", "1"); } catch (e) { /* niente */ }
    window.scrollTo(0, 0);
    if (navigator.vibrate) navigator.vibrate(12);
    if (musicaVoluta) suona();
    if (!effetti) { finale(); mostraPulsanteMusica(); return; }

    scena.classList.add("slega");
    const tl = G.timeline({ defaults: { ease: "power2.out" } });
    tl.to(".a-tocca", { autoAlpha: 0, duration: .3 }, 0)
      // il fiocco viene tirato, si scioglie e scivola via
      .to(".fiocco svg", { scale: 1.07, duration: .2, ease: "power1.out", transformOrigin: "48.5% 43%" }, 0)
      .to(".fiocco svg", { scale: .92, duration: .5, ease: "power2.in" }, .2)
      .to(fiocco, { y: () => innerHeight * .75, rotation: -18, duration: 1.05, ease: "power2.in" }, .22)
      .to(fiocco, { autoAlpha: 0, duration: .45, ease: "none" }, .75)
      .to(".f-sx", { xPercent: -104, duration: .95, ease: "power3.in" }, .12)
      .to(".f-dx", { xPercent: 104, duration: .95, ease: "power3.in" }, .12)
      .to(".fascia span", { autoAlpha: 0, duration: .45, ease: "none" }, .6)
      // le ante si aprono verso chi guarda
      .addLabel("ante", .62)
      .to(".anta.sx", { rotationY: -112, duration: 2.1, ease: "power3.inOut" }, "ante")
      .to(".anta.dx", { rotationY: 112, duration: 2.1, ease: "power3.inOut" }, "ante")
      .to(".anta-ombra", { backgroundColor: "rgba(96, 82, 68, .14)", duration: 1.6, ease: "none" }, "ante")
      .to(scena, { "--velo": 0, duration: 1.3, ease: "power1.out" }, "ante+=.7")
      .to(".cielo", { scale: 1, duration: 3.2, ease: "power2.out" }, "ante+=.3")
      // copertina: fiori dagli angoli, poi i nomi scritti a mano
      .fromTo(".mazzo.alto", { autoAlpha: 0, x: -70, y: -60, rotation: -10 }, { autoAlpha: 1, x: 0, y: 0, rotation: 0, duration: 2, ease: "power3.out" }, "ante+=.95")
      .fromTo(".mazzo.basso", { autoAlpha: 0, x: 70, y: 60, rotation: 190 }, { autoAlpha: 1, x: 0, y: 0, rotation: 180, duration: 2, ease: "power3.out" }, "ante+=.95")
      .to(".c-intro", { autoAlpha: 1, y: 0, duration: 1.2 }, "ante+=1.15")
      .add(() => scrittaCopertina.play(), "ante+=1.55")
      .to(".c-data", { autoAlpha: 1, y: 0, duration: 1.1 }, `ante+=${1.55 + scrittaCopertina.duration() - .2}`)
      .to(".c-luogo", { autoAlpha: 1, y: 0, duration: 1.1 }, "<+.25")
      .to(".c-scorri", { autoAlpha: 1, y: 0, duration: 1 }, "<+.5")
      .add(() => { scena.hidden = true; blocca(false); mostraPulsanteMusica(); }, "ante+=2.2")
      .add(attivaScorrimento);
  }

  $("#rivedi").addEventListener("click", () => {
    try { sessionStorage.removeItem("invito-aperto"); } catch (e) { /* niente */ }
    brano.pause();
    window.scrollTo(0, 0);
    location.reload();
  });

  // ---------- effetti allo scorrimento ----------
  let scorrimentoAttivo = false;
  function attivaScorrimento() {
    if (!effetti || scorrimentoAttivo) return;
    scorrimentoAttivo = true;

    // copertina: i fiori scorrono più veloci dei nomi, i nomi sfumano
    G.timeline({ scrollTrigger: { trigger: copertina, start: "top top", end: "bottom top", scrub: true } })
      .to(".c-testo", { y: -80, autoAlpha: .2, ease: "none" }, 0)
      .to(".mazzo.alto", { y: -150, rotation: -8, ease: "none" }, 0)
      .to(".mazzo.basso", { y: 110, ease: "none" }, 0)
      .to(".c-scorri", { autoAlpha: 0, ease: "none", duration: .3 }, 0);

    // il cartoncino si dispiega seguendo il dito
    G.fromTo(".p-centro", { rotationX: -92 }, { rotationX: 0, ease: "power1.out",
      scrollTrigger: { trigger: ".faccia-centro", start: "top 92%", end: "top 38%", scrub: .7 } });
    G.fromTo(".p-basso", { rotationX: -150 }, { rotationX: 0, ease: "power1.out",
      scrollTrigger: { trigger: ".p-basso", start: "top 96%", end: "top 48%", scrub: .7 } });

    // titoli in corsivo: si scrivono da sinistra a destra
    $$(".a-mano").forEach((h) => G.fromTo(h, { "--p": "-15%" }, { "--p": "120%", duration: 1.6, ease: "power2.inOut",
      scrollTrigger: { trigger: h, start: "top 86%", once: true } }));

    // foto: le colonne scorrono a velocità diverse, ogni stampa si posa e si sviluppa
    $$(".colonna").forEach((col) => {
      const v = +col.dataset.velocita || 0;
      G.fromTo(col, { y: -v }, { y: v, ease: "none", scrollTrigger: { trigger: ".collage", start: "top bottom", end: "bottom top", scrub: true } });
    });
    $$(".stampa").forEach((fig) => {
      const r = parseFloat(getComputedStyle(fig).getPropertyValue("--r")) || 0;
      const img = $("img", fig);
      const tl = G.timeline({ scrollTrigger: { trigger: fig, start: "top 88%", once: true } });
      tl.fromTo(fig, { autoAlpha: 0, y: 50, rotation: r + (r > 0 ? 6 : -6) }, { autoAlpha: 1, y: 0, rotation: r, duration: 1.1, ease: "power3.out" })
        .fromTo(img, { filter: "brightness(1.8) contrast(.55) saturate(0) blur(3px)" }, { filter: "brightness(1) contrast(1) saturate(1) blur(0px)", duration: 2.4, ease: "power2.out" }, .2);
    });

    // biglietti: si posano come carta sul tavolo
    $$(".biglietto").forEach((b) => G.fromTo(b, { autoAlpha: 0, y: 70, rotation: -2.5 }, { autoAlpha: 1, y: 0, rotation: 0, duration: 1.2, ease: "power3.out",
      scrollTrigger: { trigger: b, start: "top 90%", once: true } }));

    // conto alla rovescia: le cifre salgono fino al valore vero
    ST.create({ trigger: "#conto", start: "top 88%", once: true, onEnter: () => {
      contoAnimato = true;
      const vero = tempoMancante(), o = { g: 0, h: 0, m: 0, s: 0 };
      G.to(o, { g: vero.g, h: vero.h, m: vero.m, s: vero.s, duration: 1.8, ease: "power3.out",
        onUpdate: () => scriviConto({ g: Math.round(o.g), h: Math.round(o.h), m: Math.round(o.m), s: Math.round(o.s) }),
        onComplete: () => { contoAnimato = false; conta(); } });
    } });

    // firma in fondo: Antonio & Giulia si scrivono di nuovo
    ST.create({ trigger: ".piede", start: "top 90%", once: true, onEnter: () => scrittaFirma.play() });

    ST.refresh();
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { sagome.forEach(sfrangia); if (scorrimentoAttivo) ST.refresh(); });

  // ---------- conto alla rovescia ----------
  const cifre = { g: $("#c-giorni"), o: $("#c-ore"), m: $("#c-minuti"), s: $("#c-secondi") };
  const due = (n) => String(n).padStart(2, "0");
  let contoAnimato = false;
  function tempoMancante() {
    let r = Math.max(0, Math.floor((DATI.inizio - Date.now()) / 1000));
    const g = Math.floor(r / 86400); r -= g * 86400;
    const h = Math.floor(r / 3600); r -= h * 3600;
    const m = Math.floor(r / 60);
    return { g, h, m, s: r - m * 60 };
  }
  function scriviConto(t) { cifre.g.textContent = String(t.g); cifre.o.textContent = due(t.h); cifre.m.textContent = due(t.m); cifre.s.textContent = due(t.s); }
  function conta() { if (!contoAnimato) scriviConto(tempoMancante()); }
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
    if (effetti && !giaInviata) G.fromTo(grazie, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: .9, ease: "power2.out" });
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
