/* Klipper (edição SyncServ para barbearias) - landing page. JavaScript puro, sem dependências.
   Os dados fictícios (barbearia, barbeiros, serviços, preços, durações e horários) vêm do <script id="demo-data">,
   cópia de landing/data/demo.json gerada pelo scripts/portfolio/fragments.py. Nenhuma data fica fixa no texto: tudo
   sai de rotuloDia(), a partir da data do navegador. */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const DEMO = JSON.parse(($("#demo-data") || { textContent: "{}" }).textContent);
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const money = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const wholeMoney = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const el = (tag, className, text) => Object.assign(document.createElement(tag), { className, textContent: text || "" });
document.documentElement.classList.add("js");

// ---------------------------------------------------------------- datas (função única)
const SEMANA_CURTA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const SEMANA_LONGA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const dd = (n) => String(n).padStart(2, "0");
const minutos = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };

/** Rótulos de um dia em relação a "ref" (hoje, no navegador): curto ("qui 29/10"), rotulo ("Amanhã (qui 29/10)",
 *  como o bot escreve), relativo ("amanhã", "hoje", "na quinta", "no sábado") e se a barbearia abre nesse dia. */
function rotuloDia(d, ref = new Date()) {
  const dia = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const base = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const diff = Math.round((dia - base) / 86400000);
  const wd = dia.getDay();
  const curto = `${SEMANA_CURTA[wd]} ${dd(dia.getDate())}/${dd(dia.getMonth() + 1)}`;
  const rotulo = diff === 0 ? `Hoje (${curto})` : diff === 1 ? `Amanhã (${curto})` : curto[0].toUpperCase() + curto.slice(1);
  const relativo = diff === 0 ? "hoje" : diff === 1 ? "amanhã" : `${wd === 0 || wd === 6 ? "no" : "na"} ${SEMANA_LONGA[wd]}`;
  const faixas = (DEMO.funcionamento || {})[String(wd)] || [];
  return { data: dia, diff, curto, rotulo, relativo, longo: SEMANA_LONGA[wd], aberto: faixas.length > 0, faixas };
}

/** Horários livres de exemplo que cabem no expediente do dia (e, se for hoje, que ainda não passaram). */
function horariosLivres(info, duracao, ref = new Date()) {
  const agora = ref.getHours() * 60 + ref.getMinutes();
  return (DEMO.horarios_livres || []).filter((h) => {
    const ini = minutos(h);
    if (info.diff === 0 && ini < agora + 30) return false;
    return info.faixas.some(([a, b]) => ini >= minutos(a) && ini + duracao <= minutos(b));
  });
}

/** Próximos dias com horário livre para o serviço, a partir de hoje (dias fechados ficam de fora). */
function proximosDias(duracao, quantos = 4, ref = new Date()) {
  const out = [];
  for (let i = 0; out.length < quantos && i < 14; i++) {
    const info = rotuloDia(new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + i), ref);
    if (info.aberto && horariosLivres(info, duracao, ref).length) out.push(info);
  }
  return out;
}

// ---------------------------------------------------------------- mensagens (texto com *negrito*, sem innerHTML)
function rich(node, text) {
  text.split(/(\*[^*\n]+\*)/).forEach((part) => {
    if (/^\*[^*]+\*$/.test(part)) node.appendChild(el("b", "", part.slice(1, -1)));
    else if (part) node.appendChild(document.createTextNode(part));
  });
  return node;
}
const WHO = { client: "Cliente: ", agent: "Atendimento: ", system: "Sistema: ", step: "Etapa interna: " };
/** Uma mensagem num dos quatro estilos: cliente (direita), atendimento (esquerda), sistema (faixa) e etapa interna. */
function message(kind, text, tag = "p") {
  const m = el(tag, `msg msg--${kind}`);
  m.appendChild(el("span", "sr-only", WHO[kind]));
  if (kind === "step") {
    m.insertAdjacentHTML("beforeend", '<svg class="ic" aria-hidden="true"><use href="#i-gear"/></svg>');
    m.appendChild(el("span", "", text));
  } else {
    rich(m, text);
  }
  return m;
}

// ---------------------------------------------------------------- hero: conversa curta com as datas de hoje
function heroChat() {
  const box = $(".js-hero-chat");
  if (!box || !DEMO.servicos) return;
  const corte = DEMO.servicos[0];
  const pro = DEMO.profissionais[0];
  const dia = proximosDias(corte.duracao_min, 2).find((d) => d.diff >= 1) || proximosDias(corte.duracao_min, 1)[0];
  if (!dia) return;
  const livres = horariosLivres(dia, corte.duracao_min).slice(-3);
  const escolhido = livres[livres.length - 1];
  const lista = livres.length > 1 ? `${livres.slice(0, -1).join(", ")} ou ${escolhido}` : escolhido;
  box.replaceChildren(
    message("client", `Oi! Tem horário pra ${corte.nome.toLowerCase()} ${dia.relativo}?`),
    message("agent", `Tem sim, com o ${pro}: ${lista}. Qual fica melhor?`),
    message("client", escolhido),
    message("system", "Agendamento confirmado"),
    message("agent", `*${corte.nome}* com ${pro}\n${dia.rotulo} às ${escolhido}\n${money(corte.preco)}`),
  );
  $$(".msg", box).forEach((m) => m.setAttribute("aria-hidden", "true")); // a figura já tem o texto alternativo
}

// ---------------------------------------------------------------- simulador (menu numerado, como o bot de verdade)
const sim = { log: null, options: null, status: null, token: 0, state: {} };

function scrollLog() {
  requestAnimationFrame(() => { sim.log.scrollTop = sim.log.scrollHeight; });
}
function put(kind, text) {
  sim.log.appendChild(message(kind, text));
  scrollLog();
}
const step = (text) => put("step", text);
const notice = (text) => put("system", text);

// Resposta do atendimento com "digitando..." e um pequeno atraso. token: descarta respostas de uma conversa reiniciada.
function bot(texts, options) {
  const token = sim.token;
  const list = Array.isArray(texts) ? texts : [texts];
  sim.options.replaceChildren();
  let chain = Promise.resolve();
  list.forEach((text) => {
    chain = chain.then(() => new Promise((resolve) => {
      if (token !== sim.token) return;
      sim.status.textContent = "digitando...";
      const typing = el("p", "msg msg--agent msg--typing");
      typing.setAttribute("aria-hidden", "true"); // o "digitando..." já está no status, em texto
      typing.append(el("i"), el("i"), el("i"));
      sim.log.appendChild(typing);
      scrollLog();
      const wait = reduced ? 120 : Math.min(1200, 450 + text.length * 5);
      setTimeout(() => {
        typing.remove();
        if (token !== sim.token) return;
        sim.status.textContent = "online";
        put("agent", text);
        resolve();
      }, wait);
    }));
  });
  chain.then(() => { if (token === sim.token) setOptions(options || []); });
}

function setOptions(options) {
  // Teclado: quem respondeu pelo Tab/Enter continua nas respostas (o botão escolhido some ao trocar as opções)
  const keepFocus = sim.focusNext || sim.options.contains(document.activeElement);
  sim.focusNext = false;
  sim.options.replaceChildren(...options.map((o) => {
    const b = el("button", "btn btn--option", o.label);
    b.type = "button";
    b.addEventListener("click", () => {
      sim.focusNext = sim.options.contains(document.activeElement);
      if (sim.focusNext) sim.log.focus({ preventScroll: true }); // enquanto o atendimento "digita", o foco fica na conversa
      $$("button", sim.options).forEach((x) => { x.disabled = true; });
      put("client", o.reply || o.label);
      o.go();
    });
    return b;
  }));
  if (keepFocus && sim.options.firstElementChild) sim.options.firstElementChild.focus({ preventScroll: true });
}

// Fim do roteiro: a próxima ação ligada ao que a pessoa viu (um botão primário e um secundário)
function endPanel() {
  const panel = el("div", "sim__end");
  panel.appendChild(el("p", "", "Gostou? Veja como fica do lado do dono."));
  const actions = el("div", "actions");
  const screens = el("a", "btn btn--primary btn--sm", "Ver as telas do app");
  screens.href = "#telas";
  const quote = $(".js-quote").cloneNode(true);
  quote.className = "btn btn--secondary btn--sm js-quote";
  actions.append(screens, quote);
  panel.appendChild(actions);
  sim.options.replaceChildren(panel);
  if (sim.focusNext || sim.log.contains(document.activeElement)) screens.focus({ preventScroll: true });
  sim.focusNext = false;
}

function resumo() {
  const s = sim.state;
  return `✂️ *${s.servico.nome}* com ${s.pro}\n📅 ${s.dia.rotulo} às ${s.hora}\n💰 ${money(s.servico.preco)}`;
}
const opcoes = (list) => list.map((label, i) => `*${i + 1}* - ${label}`).join("\n");

const flow = {
  menu() {
    bot([`ℹ️ Este é o atendimento automático da *${DEMO.barbearia}*. Para falar com uma pessoa, mande *atendente*.`,
      `Olá, ${DEMO.cliente}! Bem-vindo à *${DEMO.barbearia}* 💈\n\n${opcoes(["Agendar horário", "Meus agendamentos",
        "Serviços e preços", "Nossos barbeiros", "Horário de funcionamento e endereço", "Pagar agendamento via Pix",
        "Falar com a barbearia", "Pacotes e assinatura"])}\n\nResponda com o número da opção.`], [
      { label: "1 - Agendar horário", reply: "1", go: flow.servico },
      { label: "3 - Serviços e preços", reply: "3", go: flow.precos },
    ]);
  },
  precos() {
    step("Consultou os serviços e os preços cadastrados");
    bot(`*Serviços e preços*\n\n${DEMO.servicos.map((s) => `${s.nome} (${s.duracao_min} min) - ${money(s.preco)}`).join("\n")}`,
      [{ label: "1 - Agendar horário", reply: "1", go: flow.servico }]);
  },
  servico() {
    step("Consultou os serviços e os preços cadastrados");
    bot(`Qual serviço você quer?\n\n${opcoes(DEMO.servicos.map((s) => `${s.nome} (${s.duracao_min} min) - ${money(s.preco)}`))}`,
      DEMO.servicos.map((s, i) => ({ label: `${i + 1} - ${s.nome}`, reply: String(i + 1),
        go: () => { sim.state.servico = s; flow.pro(); } })));
  },
  pro() {
    step(`Consultou quais barbeiros fazem ${sim.state.servico.nome.toLowerCase()}`);
    const pros = DEMO.profissionais;
    const opts = pros.map((p, i) => ({ label: `${i + 1} - ${p}`, reply: String(i + 1), go: () => { sim.state.pro = p; flow.dia(); } }));
    opts.push({ label: `${pros.length + 1} - Tanto faz`, reply: String(pros.length + 1), go: () => { sim.state.pro = pros[0]; flow.dia(); } });
    bot(`Com qual barbeiro?\n\n${opcoes([...pros, "Tanto faz (primeiro disponível)"])}`, opts);
  },
  dia() {
    const dias = proximosDias(sim.state.servico.duracao_min, 4);
    step(`Consultou os dias em que a barbearia abre e a agenda de ${sim.state.pro}`);
    const amanha = rotuloDia(new Date(Date.now() + 86400000));
    const aviso = amanha.aberto ? "" : `Amanhã (${amanha.longo}) a barbearia não abre. `;
    bot(`${aviso}Para qual dia?\n\n${opcoes(dias.map((d) => d.rotulo))}`,
      dias.map((d, i) => ({ label: `${i + 1} - ${d.rotulo}`, reply: String(i + 1), go: () => { sim.state.dia = d; flow.hora(); } })));
  },
  hora() {
    const livres = horariosLivres(sim.state.dia, sim.state.servico.duracao_min);
    step(`Consultou os horários livres de ${sim.state.dia.curto} na agenda de ${sim.state.pro}`);
    bot(`Horários livres em *${sim.state.dia.rotulo}*:\n\n${opcoes(livres)}\n\nResponda com o número do horário.`,
      livres.map((h, i) => ({ label: `${i + 1} - ${h}`, reply: String(i + 1), go: () => { sim.state.hora = h; flow.confirmar(); } })));
  },
  confirmar() {
    step("Montou o resumo para o cliente confirmar (nada foi gravado ainda)");
    bot(`Confirma o agendamento?\n\n${resumo()}\n\n${opcoes(["Confirmar", "Escolher outro horário", "Desistir"])}`, [
      { label: "1 - Confirmar", reply: "1", go: flow.agendado },
      { label: "2 - Outro horário", reply: "2", go: flow.hora },
      { label: "3 - Desistir", reply: "3", go: () => flow.fim("Tudo bem, não marquei nada. Quando quiser, é só chamar!") },
    ]);
  },
  agendado() {
    step("Conferiu as regras da agenda e gravou o agendamento");
    notice("Agendamento confirmado");
    bot(`✅ Agendado!\n\n${resumo()}\n\nQuer adiantar o pagamento?\n\n${opcoes(["Pagar agora via Pix", "Pagar na barbearia"])}`, [
      { label: "1 - Pagar agora via Pix", reply: "1", go: flow.pix },
      { label: "2 - Pagar na barbearia", reply: "2", go: () => bot("Combinado, pagamento na barbearia. Te mando um lembrete antes do horário!",
        [{ label: "Ver o lembrete", go: flow.lembrete }]) },
    ]);
  },
  pix() {
    const valor = sim.state.servico.preco.toFixed(2);
    step("Gerou o Pix copia e cola com a chave da barbearia");
    bot([`💳 *Pagamento via Pix*\n\n${resumo()}\n\nRecebedor: ${DEMO.barbearia}\n\n`
      + "Copie o código da próxima mensagem e cole no app do seu banco em *Pix > Copia e cola*.\n"
      + "Depois de pagar, responda *paguei* (pode mandar o comprovante).",
    `00020126580014BR.GOV.BCB.PIX0136exemplo-de-chave-pix-ficticia52040000530398654${dd(valor.length)}${valor}5802BR5914BARBEARIA DEMO6009EXEMPLO62070503***6304ABCD`],
    [{ label: "paguei", go: flow.pago }]);
  },
  pago() {
    const token = sim.token;
    bot("Obrigado! Avisei a barbearia. Assim que conferirem o recebimento, te mando a confirmação.", []);
    setTimeout(() => {
      if (token !== sim.token) return; // a conversa foi reiniciada
      step("Avisou o dono, que confere o extrato: a confirmação final do Pix é dele");
      notice("Pix confirmado pela barbearia");
      bot(`Recebemos o seu Pix de ${money(sim.state.servico.preco)}! Seu horário de ${sim.state.dia.curto} às ${sim.state.hora} está pago. Até lá!`,
        [{ label: "Ver o lembrete", go: flow.lembrete }]);
    }, reduced ? 200 : 1700);
  },
  lembrete() {
    notice("Antes do horário");
    step("Enviou o lembrete programado para antes do horário");
    bot(`*Lembrete*, ${DEMO.cliente}!\n\n${resumo()}\n\n${opcoes(["Confirmo presença", "Preciso cancelar"])}`, [
      { label: "1 - Confirmo presença", reply: "1", go: () => { step("Marcou a presença como confirmada"); flow.fim("Presença confirmada! Até lá."); } },
      { label: "2 - Preciso cancelar", reply: "2", go: () => {
        step("Cancelou o agendamento e liberou o horário na agenda");
        notice("Horário liberado na agenda");
        flow.fim("Seu horário foi cancelado e ficou livre para outra pessoa. Para marcar outro, mande *menu*.");
      } },
    ]);
  },
  fim(text) {
    const token = sim.token;
    bot(text, []);
    setTimeout(() => { if (token === sim.token) endPanel(); }, reduced ? 200 : Math.min(1200, 450 + text.length * 5) + 100);
  },
};

function restart() {
  sim.token += 1;
  sim.state = {};
  sim.log.replaceChildren();
  sim.options.replaceChildren();
  sim.status.textContent = "online";
  put("client", "Oi");
  flow.menu();
}

// ---------------------------------------------------------------- "Ver o que o sistema fez nesta conversa"
function stepsToggles() {
  $$(".js-steps-toggle").forEach((b) => {
    const target = document.getElementById(b.getAttribute("aria-controls"));
    const label = b.textContent;
    b.addEventListener("click", () => {
      const open = b.getAttribute("aria-expanded") !== "true";
      b.setAttribute("aria-expanded", String(open));
      target.classList.toggle("chat--steps", open);
      b.textContent = open ? "Ocultar o que o sistema fez" : label;
    });
  });
}

// ---------------------------------------------------------------- abas (galeria e conversas com a IA)
// Sem JS, os painéis aparecem todos, empilhados, e a lista de abas fica escondida.
function tabs() {
  $$("[data-tabs]").forEach((group) => {
    const list = $(".tabs__list", group);
    const buttons = $$("[role=tab]", list);
    const panels = buttons.map((b) => document.getElementById(b.getAttribute("aria-controls")));
    panels.forEach((p, i) => {
      p.setAttribute("role", "tabpanel");
      p.setAttribute("aria-labelledby", buttons[i].id);
      p.tabIndex = 0;
    });
    function select(i, focus) {
      buttons.forEach((b, j) => {
        b.setAttribute("aria-selected", String(i === j));
        b.tabIndex = i === j ? 0 : -1;
        panels[j].hidden = i !== j;
      });
      if (focus) buttons[i].focus();
    }
    buttons.forEach((b, i) => {
      b.addEventListener("click", () => select(i, false));
      b.addEventListener("keydown", (e) => {
        const n = buttons.length;
        const to = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
        if (to !== undefined) { e.preventDefault(); select(to, true); }
      });
    });
    list.hidden = false;
    select(0, false);
  });
}

// ---------------------------------------------------------------- calculadora
function calculator() {
  const form = $(".js-calc");
  if (!form) return;
  const weeks = (DEMO.calculadora || {}).semanas_por_mes || 4.3;
  const inputs = $$("input", form);
  const read = (input) => {
    const min = Number(input.min);
    const max = Number(input.max);
    const raw = input.value.trim();
    const v = Number(raw);
    const err = $(`#${input.id}-err`);
    const bad = raw === "" || !Number.isFinite(v) || v < min || v > max;
    err.hidden = !bad;
    err.textContent = bad ? `Use um número entre ${min} e ${max}. A conta usa ${raw === "" || !Number.isFinite(v) ? min : Math.min(max, Math.max(min, v))}.` : "";
    input.setAttribute("aria-invalid", String(bad));
    return Math.min(max, Math.max(min, Number.isFinite(v) && raw !== "" ? v : min));
  };
  const steppers = $$("[data-step]", form);
  function update() {
    const [appts, price, loss, rec] = ["c-appts", "c-price", "c-loss", "c-rec"].map((id) => read($(`#${id}`)));
    const lost = appts * weeks * price * (loss / 100);
    $("#calc-lost").textContent = wholeMoney(lost);
    $("#calc-rec").textContent = wholeMoney(lost * (rec / 100));
    steppers.forEach((b) => {
      const input = $(`#${b.getAttribute("aria-controls")}`);
      const v = read(input);
      b.disabled = Number(b.dataset.step) < 0 ? v <= Number(input.min) : v >= Number(input.max);
    });
  }
  form.addEventListener("submit", (e) => e.preventDefault()); // sem onsubmit no HTML (CSP)
  inputs.forEach((i) => {
    i.addEventListener("input", update);
    i.addEventListener("change", () => { i.value = read(i); update(); }); // ao sair do campo, fica o valor usado na conta
  });
  steppers.forEach((b) => b.addEventListener("click", () => {
    const input = $(`#${b.getAttribute("aria-controls")}`);
    input.value = Math.min(Number(input.max), Math.max(Number(input.min), read(input) + Number(b.dataset.step) * Number(input.step)));
    update();
    if (b.disabled) input.focus(); // chegou ao limite: o botão desabilitado perderia o foco
  }));
  update();
}

// ---------------------------------------------------------------- menu do celular
function menu() {
  const btn = $(".menu-btn");
  const nav = $("#menu");
  if (!btn || !nav) return;
  const toggle = (open) => {
    nav.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", String(open));
    btn.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
  };
  btn.addEventListener("click", () => toggle(btn.getAttribute("aria-expanded") !== "true"));
  $$("a", nav).forEach((a) => a.addEventListener("click", () => toggle(false)));
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || btn.getAttribute("aria-expanded") !== "true") return;
    const inside = nav.contains(document.activeElement);
    toggle(false);
    if (inside) btn.focus(); // o foco não fica num link escondido
  });
}

// ---------------------------------------------------------------- início
document.addEventListener("DOMContentLoaded", () => {
  menu();
  heroChat();
  tabs();
  stepsToggles();
  calculator();
  sim.log = $(".js-sim-log");
  sim.options = $(".js-sim-options");
  sim.status = $(".js-sim-status");
  if (sim.log && DEMO.servicos) {
    $(".js-sim-reset").addEventListener("click", restart);
    restart();
  }
});
