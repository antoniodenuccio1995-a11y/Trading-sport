// Partecipazione digitale di Antonio e Giulia.
// Apre la busta (fiocco, lembo, biglietto), dispiega il cartoncino e gestisce conferma, IBAN e calendario.
(() => {
  "use strict";

  const DATI = {
    data: "2027-05-27",
    dataTesto: "27 maggio 2027",
    whatsapp: { antonio: { nome: "Antonio", numero: "393203142984" }, giulia: { nome: "Giulia", numero: "393209549565" } },
  };

  const $ = (s, r = document) => r.querySelector(s);
  const html = document.documentElement;
  const scena = $("#scena"), busta = $("#busta"), biglietto = $("#biglietto");
  const invito = $("#invito"), partecipazione = $("#partecipazione"), pAlto = $("#p-alto");
  const riduci = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dopo = (ms, fn) => setTimeout(fn, ms);

  // ---------- bordi sfrangiati: poligono calcolato sulle misure reali ----------
  const forme = {
    pentagono: (w, h) => [[[0, h], [0, .48 * h], [.30 * w, 0], [.88 * w, .36 * h], [w, .86 * h], [w, h]], [1, 1, 1, 1, 1, 0]],
    centro: (w, h) => [[[0, 0], [w, 0], [w, h], [0, h]], [0, 1, 0, 1]],
    basso: (w, h) => [[[0, 0], [w, 0], [w, h], [0, h]], [0, 1, 1, 1]],
    biglietto: (w, h) => [[[0, 0], [w, 0], [w, h], [0, h]], [1, 1, 1, 1]],
    dietro: (w, h) => [[[0, 0], [w, 0], [w, h], [0, h]], [0, 1, 0, 1]],
    tasca: (w, h) => [[[0, 0], [.41 * w, .6 * h], [w, 0], [w, h], [0, h]], [0, 0, 1, 0, 1]],
    lembo: (w, h) => [[[0, 0], [w, 0], [.41 * w, .6 * h]], [0, 1, 1]],
  };

  function casuale(seme) {
    let s = (seme * 9301 + 49297) % 233280 || 1;
    return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  }

  function sfrangia(el) {
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h) return;
    const nome = el.dataset.forma, specchio = nome === "lembo-dentro";
    const [punti, ruvidi] = forme[specchio ? "lembo" : nome](w, h);
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
    const poli = "polygon(" + out.map(([x, y]) => `${x.toFixed(1)}px ${(specchio ? h - y : y).toFixed(1)}px`).join(",") + ")";
    el.style.clipPath = poli;
    el.style.webkitClipPath = poli;
  }

  const sagome = [...document.querySelectorAll("[data-forma]")];
  const osserva = "ResizeObserver" in window ? new ResizeObserver((voci) => voci.forEach((v) => sfrangia(v.target))) : null;
  sagome.forEach((el) => { sfrangia(el); osserva && osserva.observe(el); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => sagome.forEach(sfrangia));

  // ---------- destinatario dal link: ...?per=Famiglia%20Rossi ----------
  const per = (new URLSearchParams(location.search).get("per") || "").trim().slice(0, 60);
  if (per) {
    const d = $("#destinatario");
    d.textContent = per;
    d.hidden = false;
    busta.setAttribute("aria-label", `Apri la busta per ${per} e leggi l'invito`);
  }

  // ---------- apertura ----------
  let avviata = false;

  function blocca(si) { html.classList.toggle("bloccato", si); }

  function preparaScena() {
    blocca(true);
    scena.hidden = false;
    invito.classList.remove("visibile", "mostra");
    partecipazione.classList.add("piegata");
    partecipazione.classList.remove("dispiega");
    requestAnimationFrame(() => requestAnimationFrame(() => scena.classList.add("pronta")));
  }

  function mostraSubito() {
    scena.hidden = true;
    blocca(false);
    partecipazione.classList.remove("piegata");
    invito.classList.add("visibile", "mostra");
  }

  let giaAperta = false;
  try { giaAperta = sessionStorage.getItem("invito-aperto") === "1"; } catch (e) { /* navigazione privata */ }
  if (giaAperta) mostraSubito(); else preparaScena();

  busta.addEventListener("click", apri);

  function apri() {
    if (avviata) return;
    avviata = true;
    try { sessionStorage.setItem("invito-aperto", "1"); } catch (e) { /* niente */ }
    window.scrollTo(0, 0);
    if (riduci) { mostraSubito(); return; }
    scena.classList.add("slega");
    dopo(620, () => scena.classList.add("apri"));
    dopo(1450, () => scena.classList.add("estrai"));
    dopo(2600, porgiBiglietto);
  }

  // il biglietto uscito dalla busta vola al suo posto in cima all'invito
  function porgiBiglietto() {
    const da = biglietto.getBoundingClientRect();
    const a = pAlto.getBoundingClientRect();
    const copia = pAlto.cloneNode(true);
    copia.removeAttribute("id");
    Object.assign(copia.style, {
      position: "fixed", left: a.left + "px", top: a.top + "px", width: a.width + "px", height: a.height + "px",
      margin: "0", zIndex: "20", transformOrigin: "0 0", pointerEvents: "none",
    });
    document.body.appendChild(copia);
    scena.classList.add("congeda");
    const s = da.width / a.width;
    const volo = copia.animate(
      [{ transform: `translate(${da.left - a.left}px, ${da.top - a.top}px) scale(${s})` }, { transform: "none" }],
      { duration: 1000, easing: "cubic-bezier(.5, 0, .2, 1)", fill: "forwards" },
    );
    volo.onfinish = () => {
      invito.classList.add("visibile");
      requestAnimationFrame(() => {
        copia.remove();
        scena.hidden = true;
        blocca(false);
        partecipazione.classList.add("dispiega");
        requestAnimationFrame(() => partecipazione.classList.remove("piegata"));
        dopo(1500, () => invito.classList.add("mostra"));
      });
    };
  }

  $("#rivedi").addEventListener("click", () => {
    scena.classList.add("senza-transizioni");
    scena.classList.remove("pronta", "slega", "apri", "estrai", "congeda");
    void scena.offsetWidth;
    scena.classList.remove("senza-transizioni");
    avviata = false;
    window.scrollTo(0, 0);
    preparaScena();
  });

  // ---------- giorni che mancano ----------
  const conto = $("#conto");
  if (conto) {
    const oggi = new Date(), giorno = new Date(DATI.data + "T00:00:00");
    const diff = Math.round((giorno - new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate())) / 864e5);
    if (diff > 1) conto.textContent = `Mancano ${diff} giorni`;
    else if (diff === 1) conto.textContent = "Manca un giorno";
    else if (diff === 0) conto.textContent = "È oggi";
  }

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

  // ---------- conferma su WhatsApp ----------
  const form = $("#rsvp"), soloSi = $("#solo-si"), persone = $("#persone"), stato = $("#stato-rsvp");
  const nome = $("#rsvp-nome");
  if (per) nome.value = per;
  let n = 1;
  const aggiornaPersone = () => { persone.textContent = String(n); };
  $(".meno", form).addEventListener("click", () => { n = Math.max(1, n - 1); aggiornaPersone(); });
  $(".piu", form).addEventListener("click", () => { n = Math.min(12, n + 1); aggiornaPersone(); });
  form.addEventListener("change", (e) => {
    if (e.target.name === "presenza") {
      soloSi.hidden = e.target.value === "no";
      $("#errore-presenza").hidden = true;
    }
  });
  nome.addEventListener("input", () => { $("#errore-nome").hidden = true; });

  let destinatario = "antonio";
  form.querySelectorAll('button[name="a"]').forEach((b) => b.addEventListener("click", () => { destinatario = b.value; }));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (e.submitter && e.submitter.value) destinatario = e.submitter.value;
    const chi = nome.value.trim();
    const scelta = form.querySelector('input[name="presenza"]:checked');
    $("#errore-nome").hidden = !!chi;
    $("#errore-presenza").hidden = !!scelta;
    if (!chi) { nome.focus(); return; }
    if (!scelta) { form.querySelector('input[name="presenza"]').focus(); return; }

    const sposo = DATI.whatsapp[destinatario];
    const allergie = $("#rsvp-allergie").value.trim();
    const pensiero = $("#rsvp-messaggio").value.trim();
    let testo;
    if (scelta.value === "si") {
      testo = `Ciao ${sposo.nome}! Sono ${chi} e confermo la mia presenza al vostro matrimonio del ${DATI.dataTesto}.`;
      if (n > 1) testo += ` Saremo in ${n}.`;
      testo += allergie ? ` Allergie o intolleranze: ${allergie}.` : " Nessuna allergia o intolleranza.";
    } else {
      testo = `Ciao ${sposo.nome}! Sono ${chi}: purtroppo non potrò essere presente al vostro matrimonio del ${DATI.dataTesto}.`;
    }
    if (pensiero) testo += `\n\n${pensiero}`;
    stato.textContent = "Si è aperto WhatsApp con la risposta già scritta: premi invio per mandarla.";
    location.href = `https://wa.me/${sposo.numero}?text=${encodeURIComponent(testo)}`;
  });
})();
