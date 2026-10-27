/* SyncServ - versão de portfólio: troca das capturas pelo nicho, link de cotação no WhatsApp e ampliação das capturas.
   Roda depois do main.js (os dois com defer). */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const LABELS = { barbershop: "Barbearia", beauty: "Salão de beleza" };

  // ------------------------------------------------------------ nicho: capturas, abas da galeria e cotação
  function applyNiche(key) {
    if (!LABELS[key]) return;
    document.documentElement.dataset.niche = key;
    $$(".pf-theme-tab").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.niche === key)));
    const text = `Olá! Vi o SyncServ e quero uma cotação. Meu negócio é: ${LABELS[key]}`;
    $$(".js-quote-wa").forEach((wa) => { wa.href = `https://wa.me/${wa.dataset.number}?text=${encodeURIComponent(text)}`; });
  }
  $$(".niche").forEach((b) => b.addEventListener("click", () => applyNiche(b.dataset.niche)));
  $$(".pf-theme-tab").forEach((b) => b.addEventListener("click", () => {
    if (typeof window.setNiche === "function") window.setNiche(b.dataset.niche); // hero, simulador e cores juntos
    applyNiche(b.dataset.niche);
  }));
  applyNiche(($(".niche[aria-pressed='true']") || {}).dataset?.niche || "barbershop");

  // ------------------------------------------------------------ atendimento com IA: abas no celular e entrada das mensagens
  // Sem JS as três conversas aparecem completas e empilhadas.
  const ai = $(".pf-ai");
  if (ai) {
    const cards = $$(".pf-ai__card", ai);
    const tabs = $$(".pf-ai__tab");
    const wide = window.matchMedia("(min-width: 1000px)");
    const played = new Set();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function play(card) {
      if (played.has(card)) return;
      played.add(card);
      $$(".pf-ai__log > li", card).forEach((li, i) => setTimeout(() => li.classList.add("is-in"), reduce ? 0 : 120 + i * 260));
    }
    function select(i, focus, user) {
      tabs.forEach((t, j) => {
        t.setAttribute("aria-selected", String(i === j));
        t.tabIndex = i === j ? 0 : -1;
        if (i === j) cards[j].removeAttribute("data-off"); else cards[j].setAttribute("data-off", "");
      });
      if (focus) tabs[i].focus();
      if (user) play(cards[i]); // a aba fica logo acima da conversa: ela já está na tela

    }
    cards.forEach((c, i) => { c.setAttribute("role", "tabpanel"); c.setAttribute("aria-labelledby", tabs[i].id); });
    $(".pf-ai__tabs").hidden = false;
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(i, false, true));
      t.addEventListener("keydown", (e) => {
        const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (k) { e.preventDefault(); select((i + k + tabs.length) % tabs.length, true, true); }
      });
    });
    select(0, false, false);
    if (!reduce && "IntersectionObserver" in window) {
      ai.classList.add("pf-ai--anim");
      const io = new IntersectionObserver((entries) => entries.forEach((en) => {
        if (en.isIntersecting && (wide.matches || !en.target.hasAttribute("data-off"))) { play(en.target); io.unobserve(en.target); }
      }), { threshold: 0.15 });
      cards.forEach((c) => io.observe(c));
    } else {
      cards.forEach((c) => $$(".pf-ai__log > li", c).forEach((li) => li.classList.add("is-in")));
    }
  }

  // ------------------------------------------------------------ ampliação (dialog modal: Esc fecha, foco preso)
  const box = $(".pf-lightbox");
  if (!box) return;
  const img = $(".pf-lightbox__img img", box);
  const srcA = $(".pf-lightbox__img source[type='image/avif']", box);
  const srcW = $(".pf-lightbox__img source[type='image/webp']", box);
  const cap = $(".pf-lightbox__cap", box);
  const count = $(".pf-lightbox__count", box);
  let list = [];
  let at = 0;
  let opener = null;

  const visible = () => $$(".pf-shot").filter((b) => b.offsetParent !== null);
  function show(i) {
    at = (i + list.length) % list.length;
    const b = list[at];
    srcA.srcset = b.dataset.avif;
    srcW.srcset = b.dataset.webp;
    img.src = b.dataset.jpg;
    img.width = Number(b.dataset.w);
    img.height = Number(b.dataset.h);
    img.alt = b.dataset.alt;
    cap.textContent = b.dataset.caption;
    count.textContent = `${at + 1} de ${list.length}`;
  }
  function open(b) {
    list = visible();
    opener = b;
    show(list.indexOf(b));
    box.showModal();
    $(".js-lb-close", box).focus();
  }
  $$(".pf-shot").forEach((b) => b.addEventListener("click", () => open(b)));
  $(".js-lb-close", box).addEventListener("click", () => box.close());
  $(".js-lb-prev", box).addEventListener("click", () => show(at - 1));
  $(".js-lb-next", box).addEventListener("click", () => show(at + 1));
  box.addEventListener("close", () => { if (opener) opener.focus(); });
  box.addEventListener("click", (e) => { if (e.target === box) box.close(); }); // clique fora da imagem
  box.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); show(at + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); show(at - 1); }
    else if (e.key === "Tab") { // o foco fica nos botões da ampliação
      const f = $$("button", box);
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
})();
