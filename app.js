import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const COLUMNS=[
["entrada","(1) Entrada / Nova Demanda","#71839b","Arraste um card aqui"],
["triagem","(2) Triagem / Organização","#de8500","Arraste um card aqui"],
["briefing","(3) Briefing","#d89a00",""],
["planejamento","(4) Fila de Produção","#3b82f6",""],
["criacao","(5) Criação em Andamento","#1d4ed8","máx. 2 por designer"],
["revisao","(6) Revisão Interna","#7c3aed",""],
["enviado_cliente","(7) Enviado ao Cliente","#64748b",""],
["ajustes","(8) Ajustes Solicitados","#f97316",""],
["aprovado","(9) Aprovado / Preparar Entrega","#16a34a",""],
["entregue","(10) Entregue / Finalizado","#15803d",""],
["bloqueado","(11) Bloqueado / Problemas","#dc2626",""]
].map(([id,title,color,help])=>({id,title,color,help}));
const DEMAND_TYPES=["Identidade visual","Social media","Post avulso","Carrossel","Campanha","Landing page","Site","Apresentação","Impressos","Motion / vídeo","Embalagem","Edição de imagem","Peça urgente","Ajuste simples","Projeto estratégico"];
const STATUS={em_andamento:"Em andamento",revisao_interna:"Em revisão",aguardando_cliente:"Aguardando cliente",bloqueado:"Bloqueado",aprovado:"Aprovado",entregue:"Entregue"};
const PRIORITY={urgente:"Urgente",alta:"Alta",media:"Média",baixa:"Baixa"};
const DEFAULT_CHECKLIST = [
  "Briefing recebido",
  "Referências recebidas",
  "Textos recebidos",
  "Arquivos/materiais recebidos",
  "Prazo definido",
  "Responsável definido",
  "Primeira versão criada",
  "Revisão interna feita",
  "Enviado ao cliente",
  "Ajustes registrados",
  "Aprovado",
  "Arquivos finais entregues",
  "Cliente confirmado"
];
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const dom = {
  filterToggle: $("#filterToggleButton"),
  filterPanel: $("#filterPanel"),
  auth: $("#authScreen"),
  app: $("#app"),
  warning: $("#setupWarning"),
  login: $("#loginForm"),
  signup: $("#signupButton"),
  email: $("#emailInput"),
  pass: $("#passwordInput"),
  toast: $("#toast"),
  week: $("#weekRange"),
  updated: $("#updatedDate"),
  organizer: $("#organizer"),
  quick: $("#quickStats"),
  tabs: $("#tabs"),
  toolbar: $(".toolbar"),
  newBtn: $("#newTaskButton"),
  refresh: $("#refreshButton"),
  logout: $("#logoutButton"),
  quickFilterButtons: $$(".filter-option"),
  search: $("#searchInput"),
  respF: $("#responsavelFilter"),
  prioF: $("#priorityFilter"),
  stageF: $("#stageFilter"),
  board: $("#board"),
  clientBody: $("#clientTableBody"),
  team: $("#teamGrid"),
  weekDead: $("#weekDeadlines"),
  urg: $("#realUrgencies"),
  blockers: $("#blockerGrid"),
  metrics: $("#metricsGrid"),
  archive: $("#archiveGrid"),
  dialog: $("#taskDialog"),
  detailsDialog: $("#detailsDialog"),
  detailsBody: $("#detailsBody"),
  closeDetails: $("#closeDetailsButton"),
  form: $("#taskForm"),
  title: $("#dialogTitle"),
  taskId: $("#taskId"),
  close: $("#closeDialogButton"),
  cancel: $("#cancelTaskButton"),
  del: $("#deleteTaskButton"),
  tipo: $("#tipoDemandaSelect"),
  resp: $("#responsavelSelect"),
  rev: $("#revisorSelect"),
  etapa: $("#etapaSelect"),
  addClient: $("#addClientTaskButton"),
  checkin: $("#checkinGrid"),
  rules: $("#rulesList")
};
if (dom.filterToggle && dom.filterPanel) {
  dom.filterToggle.onclick = (e) => {
    e.stopPropagation();
    dom.filterPanel.classList.toggle("hidden");
  };

  dom.filterPanel.onclick = (e) => {
    e.stopPropagation();
  };

  document.addEventListener("click", () => {
    dom.filterPanel.classList.add("hidden");
  });
}
function hasActiveFilters() {
  return (
    !!dom.respF?.value ||
    !!dom.prioF?.value ||
    !!dom.stageF?.value ||
    !!activeQuickFilter
  );
}

function updateFilterButtonLabel() {
  if (!dom.filterToggle) return;

  dom.filterToggle.innerHTML = hasActiveFilters()
    ? `☷ Filtros ativos <span class="clear-filters-x" title="Limpar filtros">×</span>`
    : `☷ Filtros ▾`;

  dom.filterToggle.classList.toggle("has-active-filters", hasActiveFilters());
}
function clearAllFilters() {
  activeQuickFilter = "";

  if (dom.respF) dom.respF.value = "";
  if (dom.prioF) dom.prioF.value = "";
  if (dom.stageF) dom.stageF.value = "";

  dom.quickFilterButtons?.forEach(btn => {
    btn.classList.remove("active");
  });

  updateFilterButtonLabel();
  renderAll();

  if (dom.filterPanel) {
    dom.filterPanel.classList.add("hidden");
  }
}
if (dom.filterToggle && dom.filterPanel) {
  dom.filterToggle.onclick = (e) => {
    e.stopPropagation();

    if (e.target.closest(".clear-filters-x")) {
      clearAllFilters();
      return;
    }

    dom.filterPanel.classList.toggle("hidden");
  };

  dom.filterPanel.onclick = (e) => {
    e.stopPropagation();
  };

  document.addEventListener("click", () => {
    dom.filterPanel.classList.add("hidden");
  });
}
let supabase=null, session=null, member=null, members=[], tasks=[], channel=null;
let activeQuickFilter = "";
const valid=SUPABASE_URL?.startsWith("https://")&&!SUPABASE_URL.includes("SEU-PROJETO")&&SUPABASE_ANON_KEY&&!SUPABASE_ANON_KEY.includes("SUA_CHAVE");
if(valid) supabase=createClient(SUPABASE_URL,SUPABASE_ANON_KEY); else dom.warning.classList.remove("hidden");

function esc(v=""){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function today(){let d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10)}
function date(v){if(!v)return null;let [y,m,d]=v.split("-").map(Number);return new Date(y,m-1,d)}
function fmt(v){if(!v)return"Sem prazo";return new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric"}).format(date(v))}
function dayName(d){return ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Fim de semana / extra"][d.getDay()]||"Fim de semana / extra"}
function startWeek(d=new Date()){let c=new Date(d),day=c.getDay(),diff=day===0?-6:1-day;c.setDate(c.getDate()+diff);c.setHours(0,0,0,0);return c}
function addDays(d,n){let c=new Date(d);c.setDate(c.getDate()+n);return c}
function memberById(id){return members.find(m=>m.id===id)||null}
function memberName(id){return memberById(id)?.nome||"Sem responsável"}
function memberColor(id){return memberById(id)?.cor||"#2563eb"}
function stageLabel(id){return COLUMNS.find(c=>c.id===id)?.title.replace(/^[A-K]\s/,"")||id}
function isDone(t){return t.etapa==="entregue"||t.status==="entregue"}
function isBlocked(t){return t.bloqueado||t.etapa==="bloqueado"||t.status==="bloqueado"}
function overdue(t){let p=date(t.prazo), n=date(today()); return !!(p&&p<n&&!isDone(t))}
function dueThisWeek(t){let p=date(t.prazo); if(!p)return false; let s=startWeek(), e=addDays(s,6); return p>=s&&p<=e}
function statusFromStage(s){return ({revisao:"revisao_interna",enviado_cliente:"aguardando_cliente",bloqueado:"bloqueado",aprovado:"aprovado",entregue:"entregue"})[s]||"em_andamento"}
function toast(msg,type=""){dom.toast.textContent=msg;dom.toast.style.background=type==="error"?"#991b1b":"#111827";dom.toast.classList.add("show");setTimeout(()=>dom.toast.classList.remove("show"),3000)}
function filtered() {
  const q = dom.search.value.toLowerCase().trim();
  const r = dom.respF.value;
  const p = dom.prioF.value;
  const s = dom.stageF.value;

  return tasks.filter(t => {
    const searchText = [
      t.cliente,
      t.titulo,
      t.proxima_acao,
      t.tipo_demanda,
      t.observacoes,
      memberName(t.responsavel_id)
    ].join(" ").toLowerCase();

    const matchesSearch = !q || searchText.includes(q);
    const matchesResponsible = !r || t.responsavel_id === r;
    const matchesPriority = !p || t.prioridade === p;
    const matchesStage = !s || t.etapa === s;

    let matchesQuick = true;

    if (activeQuickFilter === "today") {
      matchesQuick = t.prazo === today();
    }

    if (activeQuickFilter === "overdue") {
      matchesQuick = overdue(t);
    }

    return (
      matchesSearch &&
      matchesResponsible &&
      matchesPriority &&
      matchesStage &&
      matchesQuick
    );
  });
}
function fillSelects(){dom.tipo.innerHTML="<option value=''>Selecione</option>"+DEMAND_TYPES.map(x=>`<option>${esc(x)}</option>`).join(""); let stages=COLUMNS.map(c=>`<option value="${c.id}">${esc(c.title)}</option>`).join(""); dom.etapa.innerHTML=stages; dom.stageF.innerHTML="<option value=''>Todas etapas</option>"+stages}
function fillMembers(){let opts="<option value=''>Sem responsável</option>"+members.map(m=>`<option value="${m.id}">${esc(m.nome)}</option>`).join(""); dom.resp.innerHTML=opts;dom.rev.innerHTML=opts.replace("Sem responsável","Sem revisor");dom.respF.innerHTML="<option value=''>Todos responsáveis</option>"+members.map(m=>`<option value="${m.id}">${esc(m.nome)}</option>`).join("")}
function showAuth(){dom.auth.classList.remove("hidden");dom.app.classList.add("hidden")}
function showApp(){dom.auth.classList.add("hidden");dom.app.classList.remove("hidden")}
async function ensureMember(s){let email=s.user.email;let {data,error}=await supabase.from("team_members").select("*").eq("email",email).eq("ativo",true).maybeSingle();if(error)throw error;if(!data)throw new Error("Seu e-mail não está cadastrado como membro ativo em team_members.");member=data;return data}
async function loadMembers(){let {data,error}=await supabase.from("team_members").select("*").eq("ativo",true).order("nome");if(error)throw error;members=data||[];fillMembers()}
async function loadTasks(){let {data,error}=await supabase.from("tasks").select("*").order("prazo",{ascending:true,nullsFirst:false}).order("created_at",{ascending:false});if(error)throw error;tasks=data||[];renderAll()}
async function start(s){try{session=s;let m=await ensureMember(s);showApp();await loadMembers();dom.organizer.textContent=m.nome;const currentUserName = document.querySelector("#currentUserName");

if (currentUserName) {
  currentUserName.textContent = `👤 ${m.nome}`;
}
await loadTasks();subscribe()}catch(e){console.error(e);showAuth();toast(e.message,"error")}}
function subscribe(){if(channel)supabase.removeChannel(channel);channel=supabase.channel("tasks").on("postgres_changes",{event:"*",schema:"public",table:"tasks"},()=>loadTasks()).subscribe()}
function renderAll(){renderDates();renderQuick();renderBoard();renderClients();renderTeam();renderDeadlines();renderBlockers();renderMetrics();renderArchive();renderStatic()}
function renderDates(){let s=startWeek(),e=addDays(s,4),f=new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit"});dom.week.textContent=`${f.format(s)} – ${f.format(e)}/${e.getFullYear()}`;dom.updated.textContent=new Intl.DateTimeFormat("pt-BR").format(new Date())}
function renderQuick(){let active=tasks.filter(t=>!isDone(t)).length, creation=tasks.filter(t=>t.etapa==="criacao").length, blocked=tasks.filter(isBlocked).length, wait=tasks.filter(t=>t.status==="aguardando_cliente"||t.etapa==="enviado_cliente").length;dom.quick.innerHTML=[["mini-blue",active,"Cards ativos"],["mini-purple",creation,"Em criação"],["mini-red",blocked,"Bloqueados"],["mini-grey",wait,"Aguard. cliente"]].map(([c,n,l])=>`<div class="mini-stat ${c}"><strong>${n}</strong>${l}</div>`).join("")}
function enableBoardMouseScroll() {
  const board = document.querySelector(".board");

  if (!board) return;

  board.addEventListener(
    "wheel",
    (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      if (board.scrollWidth <= board.clientWidth) return;

      e.preventDefault();
      e.stopPropagation();

      board.scrollLeft += e.deltaY;
    },
    { passive: false }
  );
}
function renderBoard(){
  let fs = filtered();

  dom.board.innerHTML = COLUMNS.map(c => {
    let list = fs.filter(t => t.etapa === c.id);

    return `<section class="column" data-stage="${c.id}">
      <header class="column-head" style="background:${c.color}">
        <span>${esc(c.title)}</span>
        <span class="count">${list.length}</span>
      </header>

      <div class="column-body">
        ${
          list.length
            ? list.map(card).join("")
            : `<div class="empty-drop">${esc(c.help || "Arraste um card aqui")}</div>`
        }
      </div>

      <button class="add-card-btn" data-add-stage="${c.id}">
        ＋ Adicionar card
      </button>
    </section>`;
  }).join("");

  attachDrag();
  enableBoardMouseScroll();
}
function card(t){let chk=Array.isArray(t.checklist)?t.checklist:[],done=chk.filter(i=>i.done||i.concluido).length,total=chk.length||13,doneN=chk.length?done:Math.min(6,total), pct=Math.round(doneN/total*100);let m=memberById(t.responsavel_id);return `<article class="task-card priority-${esc(t.prioridade||"media")} ${overdue(t)?"overdue":""} ${isBlocked(t)?"blocked":""}" draggable="true" data-id="${t.id}">
<div class="card-top"><div><span class="tag ${esc(t.prioridade||"media")}">● ${PRIORITY[t.prioridade]||"Média"}</span></div><button class="card-menu" data-edit="${t.id}">✎</button></div>
<p class="client-name">${esc(t.cliente)}</p><h3 class="task-title">${esc(t.titulo)}</h3>
<div class="tags">${t.tipo_demanda?`<span class="tag">${esc(t.tipo_demanda)}</span>`:""}${m?`<span class="tag" style="background:#eef6ff;color:#0754e7">${esc(m.nome)}</span>`:""}</div>
<div class="tags"><span class="tag status-${esc(t.status||"em_andamento")}">${STATUS[t.status]||"Em andamento"}</span><span class="due-line">🗓️ ${fmt(t.prazo)}</span></div>
<div class="progress"><span style="width:${pct}%"></span></div><div class="muted">${doneN}/${total} itens</div>
${t.proxima_acao?`<div class="next-action">→ ${esc(t.proxima_acao)}</div>`:""}</article>`}
function attachDrag() {

  $$(".task-card").forEach(el => {

    el.addEventListener("dragstart", e => {
      el.classList.add("dragging");
      e.dataTransfer.setData("text/plain", el.dataset.id);
    });

    el.addEventListener("dragend", () => {
      el.classList.remove("dragging");
    });

  });

  $$(".task-card").forEach(cardEl => {

    cardEl.onclick = e => {

      if (e.target.closest("[data-edit]")) return;

      openDetails(
        tasks.find(t => t.id === cardEl.dataset.id)
      );
    };

  });

  $$("[data-edit]").forEach(btn => {

    btn.onclick = e => {

      e.stopPropagation();

      openTask(
        tasks.find(t => t.id === btn.dataset.edit)
      );

    };

  });

  $$(".column").forEach(col => {

    col.ondragover = e => e.preventDefault();

    col.ondrop = async e => {

      e.preventDefault();

      let id = e.dataTransfer.getData("text/plain");

      let etapa = col.dataset.stage;

      await moveTask(id, etapa);

    };

  });

  $$("[data-add-stage]").forEach(btn => {

    btn.onclick = () => {

      openTask();

      setTimeout(() => {

        if (dom.form?.elements?.etapa) {
          dom.form.elements.etapa.value =
            btn.dataset.addStage;
        }

      }, 50);

    };

  });

}
async function moveTask(id,etapa){let patch={etapa,status:statusFromStage(etapa),updated_by:session?.user?.email||null,bloqueado:etapa==="bloqueado"};let {error}=await supabase.from("tasks").update(patch).eq("id",id);if(error)return toast(error.message,"error");tasks=tasks.map(t=>t.id===id?{...t,...patch}:t);renderAll()}
function renderClients(){dom.clientBody.innerHTML=filtered().filter(t=>!isDone(t)).map(t=>`<tr><td>${esc(t.cliente)}</td><td>${esc(t.titulo)}</td><td><span class="pill blue">${esc(memberName(t.responsavel_id))}</span></td><td>${esc(stageLabel(t.etapa))}</td><td>🗓️ ${fmt(t.prazo)}</td><td><span class="pill ${esc(t.prioridade||"media")}">● ${PRIORITY[t.prioridade]||"Média"}</span></td><td><span class="pill ${t.status==="revisao_interna"?"purple":t.status==="aguardando_cliente"?"grey":t.status==="bloqueado"?"red":t.status==="aprovado"?"green":"blue"}">${STATUS[t.status]||"Em andamento"}</span></td><td>→ ${esc(t.proxima_acao||"—")}</td><td><button class="card-menu" data-edit="${t.id}">✎</button></td></tr>`).join("");$$("[data-edit]").forEach(b=>b.onclick=()=>openTask(tasks.find(t=>t.id===b.dataset.edit)))}
function renderTeam(){dom.team.innerHTML=members.map(m=>{let mine=tasks.filter(t=>t.responsavel_id===m.id&&!isDone(t)),doing=mine.filter(t=>["criacao","revisao","ajustes"].includes(t.etapa)).length,cap=Math.min(100,doing/4*100);return `<div class="team-card" style="--member:${esc(m.cor||"#2563eb")}"><div class="team-avatar">♙</div><h3>${esc(m.nome)}</h3><p class="muted">${esc(m.funcao||"Designer")}</p><div class="team-row"><span>Demandas ativas</span><span class="pill blue">${mine.length}</span></div><div class="team-row"><span>Cards em andamento</span><span class="pill grey">${doing}/4</span></div><p class="muted">Capacidade da semana</p><div class="capacity"><span style="width:${cap}%"></span></div><p class="muted">Observações<br>—</p></div>`}).join("")}
function renderDeadlines(){let days=[0,1,2,3,4,5].map(i=>addDays(startWeek(),i));dom.weekDead.innerHTML=days.map(d=>{let dayTasks=tasks.filter(t=>t.prazo===d.toISOString().slice(0,10)&&!isDone(t));return `<div class="deadline-card"><h3>🗓️ ${dayName(d)}</h3>${dayTasks.length?dayTasks.map(t=>`<div class="deadline-item"><span class="dot"></span><div>${esc(t.titulo)}<br><span class="muted">${esc(t.cliente)}</span></div></div>`).join(""):`<p class="muted" style="text-align:center;margin-top:30px">Sem vencimentos</p>`}</div>`}).join("");let urg=tasks.filter(t=>(t.prioridade==="urgente"||overdue(t))&&!isDone(t));dom.urg.innerHTML=urg.length?urg.map(t=>`<div class="deadline-item"><span class="dot"></span><div>${esc(t.titulo)} — ${esc(t.cliente)}<br><span>${esc(t.proxima_acao||"resolver prioridade")}</span></div></div>`).join(""):"<p>Nenhuma urgência real no momento.</p>"}
function renderBlockers(){let list=tasks.filter(t=>isBlocked(t)&&!isDone(t));dom.blockers.innerHTML=list.length?list.map(t=>`<div class="block-card"><h3>${esc(t.titulo)}</h3><p class="muted">${esc(t.cliente)} • ${esc(memberName(t.responsavel_id))}</p><p><strong>Por que está bloqueado?</strong><br>${esc(t.motivo_bloqueio||"Sem motivo registrado")}</p><p><strong>Próxima ação:</strong> ${esc(t.proxima_acao||"Definir destrave")}</p></div>`).join(""):"<div class='info-card'>Nenhum bloqueio registrado.</div>"}
function renderMetrics(){let newWeek=tasks.filter(t=>date(t.data_entrada)>=startWeek()).length, delivered=tasks.filter(t=>isDone(t)&&dueThisWeek(t)).length, late=tasks.filter(overdue).length, blocked=tasks.filter(isBlocked).length, waiting=tasks.filter(t=>t.status==="aguardando_cliente"||t.etapa==="enviado_cliente").length;let counts=Object.fromEntries(members.map(m=>[m.id,tasks.filter(t=>t.responsavel_id===m.id&&!isDone(t)).length]));let top=members.sort((a,b)=>(counts[b.id]||0)-(counts[a.id]||0))[0];let cards=[["📥",newWeek,"Demandas novas na semana"],["📦",delivered,"Demandas entregues"],["⚠️",late,"Demandas atrasadas"],["🔒",blocked,"Cards bloqueados"],["⏳",waiting,"Cards aguardando cliente"]];dom.metrics.innerHTML=cards.map(([i,n,l])=>`<div class="metric-card"><div class="icon">${i}</div><strong>${n}</strong><span>${l}</span></div>`).join("")+`<div class="metric-card" style="grid-column:span 2"><span>👤 Pessoa com mais demandas</span><p>${esc(top?.nome||"—")} (${top?counts[top.id]:0} demandas)</p></div><div class="metric-card" style="grid-column:span 3"><span>🚧 Principal gargalo da semana</span><p>${waiting?"Aguardando retorno de clientes":blocked?"Bloqueios internos":"Fluxo sem gargalo crítico"}</p></div>`}
function renderArchive(){let done=tasks.filter(isDone);dom.archive.innerHTML=done.length?done.map(t=>`<div class="archive-card"><h3>${esc(t.titulo)}</h3><p>${esc(t.cliente)} • ${esc(memberName(t.responsavel_id))}</p><span class="pill green">Entregue</span></div>`).join(""):"<div class='info-card'>Nenhum card entregue ainda.</div>"}
function renderStatic(){dom.checkin.innerHTML=["O que entrou de novo?","O que está atrasado ou em risco?","O que está bloqueado?","Quem está sobrecarregado?","O que precisa ser entregue hoje?","Quais cards precisam mudar de etapa?"].map((x,i)=>`<div class="info-card"><h3>${i+1}. ${x}</h3><p class="muted">Atualize o quadro durante a reunião, não depois.</p></div>`).join("");let rules=["Nenhuma demanda deve ficar apenas na conversa; toda demanda vira card.","Todo card precisa ter responsável, prazo e próxima ação.","Se não tem briefing suficiente, não vai para criação.","Se está aguardando cliente, registrar a data do envio.","Se está bloqueado, precisa ter motivo e responsável por destravar.","Não iniciar novas tarefas se há muitas tarefas paradas em revisão, ajustes ou entrega.","Toda alteração solicitada pelo cliente deve ser registrada no card.","Cards atrasados devem ser marcados com alerta visual.","Ao final da semana, revisar cards concluídos e arquivar.","O quadro deve ser atualizado diariamente pela equipe."];dom.rules.innerHTML=rules.map(r=>`<li>${esc(r)}</li>`).join("")}
function renderChecklist(list = []) {
  const box = $("#checklistContainer");

  if (!box) return;

  const items = list.length
    ? list
    : DEFAULT_CHECKLIST.map(text => ({
        text,
        done: false
      }));

  box.innerHTML = items.map((item, index) => `
    <label class="check-item ${item.done ? "done" : ""}">
      <input
        type="checkbox"
        data-check="${index}"
        ${item.done ? "checked" : ""}
      />

      <span>${esc(item.text)}</span>
    </label>
  `).join("");
}
function openDetails(t) {
  if (!t || !dom.detailsDialog || !dom.detailsBody) return;

  const chk = Array.isArray(t.checklist) ? t.checklist : DEFAULT_CHECKLIST.map(text => ({ text, done: false }));
  const done = chk.filter(i => i.done || i.concluido).length;
  const total = chk.length || 13;

  dom.detailsBody.innerHTML = `
    <div class="details-hero">
      <div class="details-tags">
        <span class="tag ${esc(t.prioridade || "media")}">● ${PRIORITY[t.prioridade] || "Média"}</span>
        <span class="tag status-${esc(t.status || "em_andamento")}">${STATUS[t.status] || "Em andamento"}</span>
      </div>
      <p class="client-name">${esc(t.cliente)}</p>
      <h2>${esc(t.titulo)}</h2>
    </div>

    <div class="details-grid">
      <div class="details-info">
        <div class="details-field">
          <span>Cliente</span>
          <strong>${esc(t.cliente || "—")}</strong>
        </div>

        <div class="details-field">
          <span>Tipo de peça</span>
          <strong>${esc(t.tipo_demanda || "—")}</strong>
        </div>

        <div class="details-field">
          <span>Responsável principal</span>
          <strong>${esc(memberName(t.responsavel_id))}</strong>
        </div>

        <div class="details-field">
          <span>Apoio / Revisor</span>
          <strong>${esc(memberName(t.revisor_id))}</strong>
        </div>

        <div class="details-field">
          <span>Prazo final</span>
          <strong>${fmt(t.prazo)}</strong>
        </div>

        <div class="details-field">
          <span>Data de entrada</span>
          <strong>${fmt(t.data_entrada)}</strong>
        </div>

        <div class="details-field">
          <span>Canal de solicitação</span>
          <strong>${esc(t.canal_solicitacao || "—")}</strong>
        </div>

        <div class="details-field">
          <span>Próxima ação</span>
          <strong>${esc(t.proxima_acao || "—")}</strong>
        </div>

        <div class="details-field">
          <span>Observações importantes</span>
          <strong>${esc(t.observacoes || "—")}</strong>
        </div>

        <div class="details-field">
          <span>Etapa atual</span>
          <strong>${esc(stageLabel(t.etapa))}</strong>
        </div>

        <div class="details-field">
          <span>Link do briefing</span>
          ${t.link_briefing ? `<a href="${esc(t.link_briefing)}" target="_blank">Abrir briefing</a>` : "<strong>—</strong>"}
        </div>

        <div class="details-field">
          <span>Link dos arquivos</span>
          ${t.link_arquivos ? `<a href="${esc(t.link_arquivos)}" target="_blank">Abrir arquivos</a>` : "<strong>—</strong>"}
        </div>

        <div class="details-field">
          <span>Link Figma/Drive</span>
          ${t.link_figma_drive ? `<a href="${esc(t.link_figma_drive)}" target="_blank">Abrir link</a>` : "<strong>—</strong>"}
        </div>
      </div>

      <div>
        <div class="details-check-head">
          <span>▦ Checklist</span>
          <span>${done}/${total}</span>
        </div>

        <div class="progress">
          <span style="width:${Math.round((done / total) * 100)}%"></span>
        </div>

        <div class="details-checklist">
          ${chk.map((item, index) => `
            <label class="details-check-item">
              <input type="checkbox" data-detail-check="${index}" ${item.done || item.concluido ? "checked" : ""}>
              <span>${esc(item.text)}</span>
            </label>
          `).join("")}
        </div>
      </div>
    </div>

    <div class="details-footer">
      <button class="btn danger" type="button" id="detailsDelete">🗑️ Excluir</button>
      <button class="btn primary" type="button" id="detailsEdit">✎ Editar</button>
    </div>
  `;

  $("#detailsEdit").onclick = () => {
    dom.detailsDialog.close();
    openTask(t);
  };

  $("#detailsDelete").onclick = async () => {
    dom.detailsDialog.close();
    dom.taskId.value = t.id;
    await deleteTask();
  };

  dom.detailsBody.querySelectorAll("[data-detail-check]").forEach(input => {
    input.addEventListener("change", async () => {
      const index = Number(input.dataset.detailCheck);
      const updatedChecklist = chk.map((item, i) => ({
        ...item,
        done: i === index ? input.checked : !!(item.done || item.concluido)
      }));

      const { error } = await supabase
        .from("tasks")
        .update({
          checklist: updatedChecklist,
          updated_by: session?.user?.email || null
        })
        .eq("id", t.id);

      if (error) {
        toast(error.message, "error");
        return;
      }

      t.checklist = updatedChecklist;
      tasks = tasks.map(item => item.id === t.id ? { ...item, checklist: updatedChecklist } : item);
      renderAll();
      openDetails(t);
    });
  });

  dom.detailsDialog.showModal();
}
function openTask(t=null){dom.form.reset();dom.del.style.display=t?"inline-flex":"none";dom.title.textContent=t?"Editar card":"Novo card";dom.taskId.value=t?.id||"";if(t){Object.entries(t).forEach(([k,v])=>{let f=dom.form.elements[k];if(!f)return;if(f.type==="checkbox")f.checked=!!v;else f.value=v??""})}else{dom.form.elements.data_entrada.value=today();dom.form.elements.etapa.value="entrada"}renderChecklist(t?.checklist || []);dom.dialog.showModal()}
async function saveTask(e){
  e.preventDefault();

  let fd = new FormData(dom.form);
  let id = fd.get("id");

  const checklist = [...document.querySelectorAll("[data-check]")]
    .map((el, index) => ({
      text: DEFAULT_CHECKLIST[index],
      done: el.checked
    }));

  let payload = {
    cliente: fd.get("cliente"),
    titulo: fd.get("titulo"),
    tipo_demanda: fd.get("tipo_demanda") || null,
    responsavel_id: fd.get("responsavel_id") || null,
    revisor_id: fd.get("revisor_id") || null,
    prioridade: fd.get("prioridade") || "media",
    prazo: fd.get("prazo") || null,
    data_entrada: fd.get("data_entrada") || today(),
    etapa: fd.get("etapa") || "entrada",
    status: fd.get("status") || "em_andamento",
    canal_solicitacao: fd.get("canal_solicitacao") || null,
    proxima_acao: fd.get("proxima_acao") || null,
    link_briefing: fd.get("link_briefing") || null,
    link_arquivos: fd.get("link_arquivos") || null,
    link_figma_drive: fd.get("link_figma_drive") || null,
    bloqueado: fd.get("bloqueado") === "on",
    motivo_bloqueio: fd.get("motivo_bloqueio") || null,
    observacoes: fd.get("observacoes") || null,
    checklist: checklist,
    updated_by: session?.user?.email || null
  };

  let res = id
    ? await supabase.from("tasks").update(payload).eq("id", id)
    : await supabase.from("tasks").insert(payload);

  if (res.error) return toast(res.error.message, "error");

  dom.dialog.close();
  await loadTasks();
  toast("Card salvo.");
}
async function deleteTask(){let id=dom.taskId.value;if(!id||!confirm("Excluir este card?"))return;let {error}=await supabase.from("tasks").delete().eq("id",id);if(error)return toast(error.message,"error");dom.dialog.close();await loadTasks()}
dom.tabs.onclick=e=>{let b=e.target.closest(".tab");if(!b)return;$$(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");$$(".view").forEach(v=>v.classList.remove("active"));$(`#view-${b.dataset.tab}`).classList.add("active");dom.toolbar.style.display=b.dataset.tab==="kanban"||b.dataset.tab==="clientes"?"flex":"none"}
dom.newBtn.onclick=()=>openTask();dom.addClient.onclick=()=>openTask();dom.close.onclick=()=>dom.dialog.close();dom.cancel.onclick=()=>dom.dialog.close();dom.del.onclick=deleteTask;dom.form.onsubmit=saveTask;[dom.search, dom.respF, dom.prioF, dom.stageF].forEach(el => {
  el.oninput = () => {
    updateFilterButtonLabel();
    renderAll();

    if (el !== dom.search) {
      dom.filterPanel.classList.add("hidden");
    }
  };
});dom.quickFilterButtons.forEach(button => {
  button.onclick = () => {
    activeQuickFilter = button.dataset.quickFilter || "";

    dom.quickFilterButtons.forEach(btn => {
      btn.classList.remove("active");
    });

    button.classList.add("active");

    if (dom.filterPanel) {
      dom.filterPanel.classList.add("hidden");
    }

    renderAll();
  };
});dom.refresh.onclick=()=>loadTasks();dom.logout.onclick=async()=>{await supabase.auth.signOut();showAuth()}
dom.login.onsubmit=async e=>{e.preventDefault();if(!supabase)return toast("Configure o Supabase primeiro.","error");let {data,error}=await supabase.auth.signInWithPassword({email:dom.email.value,password:dom.pass.value});if(error)return toast(error.message,"error");start(data.session)}
dom.signup.onclick=async()=>{if(!supabase)return toast("Configure o Supabase primeiro.","error");let {error}=await supabase.auth.signUp({email:dom.email.value,password:dom.pass.value});toast(error?error.message:"Acesso criado. Confirme o e-mail se o Supabase solicitar.",error?"error":"")}
fillSelects(); if(valid){supabase.auth.getSession().then(({data})=>data.session?start(data.session):showAuth());supabase.auth.onAuthStateChange((_e,s)=>{if(s&&!session)start(s)})}else showAuth();
const miniLogoutButton = document.querySelector("#miniLogoutButton");

if (miniLogoutButton) {
  miniLogoutButton.addEventListener("click", async () => {
    if (!supabase) return;

    await supabase.auth.signOut();

    session = null;
    member = null;

    showAuth();
  });
}
