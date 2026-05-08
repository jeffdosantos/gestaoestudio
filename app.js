import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const COLUMNS = [
  { id: "entrada", title: "Entrada / Nova demanda", help: "Tudo que chegou por WhatsApp, e-mail, reunião ou pedido interno entra primeiro aqui." },
  { id: "triagem", title: "Triagem / Organização", help: "Definir prioridade, prazo, responsável, escopo e informações necessárias." },
  { id: "briefing", title: "Briefing / Informações pendentes", help: "Coletar briefing, referências, textos, arquivos e objetivos." },
  { id: "planejamento", title: "Planejamento / Fila de produção", help: "Pronto para produzir, aguardando ordem de execução." },
  { id: "criacao", title: "Criação / Design em andamento", help: "Designer executando. Evitar excesso de cards por pessoa.", wip: 10 },
  { id: "revisao", title: "Revisão interna", help: "Checar qualidade, ortografia, briefing e padrão visual.", wip: 5 },
  { id: "enviado_cliente", title: "Enviado ao cliente / Aguardando retorno", help: "Registrar envio e acompanhar cobrança de retorno." },
  { id: "ajustes", title: "Ajustes solicitados", help: "Descrever exatamente o que precisa ser alterado." },
  { id: "aprovado", title: "Aprovado / Preparar entrega", help: "Exportar arquivos, organizar links, mockups e pacote final." },
  { id: "entregue", title: "Entregue / Finalizado", help: "Confirmar entrega e arquivar ao fim da semana." },
  { id: "bloqueado", title: "Bloqueado / Problemas", help: "Falta informação, aprovação, material, decisão ou há conflito de prioridade.", wip: 3 }
];

const DEMAND_TYPES = [
  "Identidade visual",
  "Social media",
  "Post avulso",
  "Carrossel",
  "Campanha",
  "Landing page",
  "Site",
  "Apresentação",
  "Impressos",
  "Motion / vídeo",
  "Embalagem",
  "Edição de imagem",
  "Peça urgente",
  "Ajuste simples",
  "Projeto estratégico"
];

const STATUS_LABELS = {
  em_andamento: "Em andamento",
  revisao_interna: "Revisão interna",
  aguardando_cliente: "Aguardando cliente",
  bloqueado: "Bloqueado",
  aprovado: "Aprovado",
  entregue: "Entregue"
};

const PRIORITY_LABELS = {
  urgente: "Urgente",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa"
};

const stageById = Object.fromEntries(COLUMNS.map((column) => [column.id, column]));

const dom = {
  authScreen: document.querySelector("#authScreen"),
  app: document.querySelector("#app"),
  setupWarning: document.querySelector("#setupWarning"),
  loginForm: document.querySelector("#loginForm"),
  signupButton: document.querySelector("#signupButton"),
  emailInput: document.querySelector("#emailInput"),
  passwordInput: document.querySelector("#passwordInput"),
  currentUser: document.querySelector("#currentUser"),
  logoutButton: document.querySelector("#logoutButton"),
  refreshButton: document.querySelector("#refreshButton"),
  newTaskButton: document.querySelector("#newTaskButton"),
  board: document.querySelector("#board"),
  searchInput: document.querySelector("#searchInput"),
  responsavelFilter: document.querySelector("#responsavelFilter"),
  priorityFilter: document.querySelector("#priorityFilter"),
  stageFilter: document.querySelector("#stageFilter"),
  overdueFilter: document.querySelector("#overdueFilter"),
  blockedFilter: document.querySelector("#blockedFilter"),
  metrics: document.querySelector("#metrics"),
  deadlines: document.querySelector("#deadlines"),
  blockers: document.querySelector("#blockers"),
  clientTableBody: document.querySelector("#clientTable tbody"),
  taskDialog: document.querySelector("#taskDialog"),
  taskForm: document.querySelector("#taskForm"),
  dialogTitle: document.querySelector("#dialogTitle"),
  closeDialogButton: document.querySelector("#closeDialogButton"),
  cancelTaskButton: document.querySelector("#cancelTaskButton"),
  deleteTaskButton: document.querySelector("#deleteTaskButton"),
  tipoDemandaSelect: document.querySelector("#tipoDemandaSelect"),
  responsavelSelect: document.querySelector("#responsavelSelect"),
  revisorSelect: document.querySelector("#revisorSelect"),
  etapaSelect: document.querySelector("#etapaSelect"),
  toast: document.querySelector("#toast")
};

let supabase = null;
let realtimeChannel = null;
let currentSession = null;
let currentMember = null;
let members = [];
let tasks = [];
let toastTimeout = null;

const configLooksValid =
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("SEU-PROJETO") &&
  !SUPABASE_ANON_KEY.includes("SUA_CHAVE");

if (configLooksValid) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  dom.setupWarning.classList.remove("hidden");
}

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function nullIfEmpty(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function todayISO() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function parseISODate(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function startOfWeek(date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatDate(value) {
  if (!value) return "Sem prazo";
  const date = parseISODate(value);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit"
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function safeUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function showToast(message, type = "default") {
  clearTimeout(toastTimeout);
  dom.toast.textContent = message;
  dom.toast.style.background = type === "error" ? "#991b1b" : type === "success" ? "#14532d" : "#0f172a";
  dom.toast.classList.add("show");
  toastTimeout = setTimeout(() => dom.toast.classList.remove("show"), 3600);
}

function memberById(id) {
  return members.find((member) => member.id === id) || null;
}

function memberName(id) {
  return memberById(id)?.nome || "Sem responsável";
}

function memberColor(id) {
  return memberById(id)?.cor || "#64748b";
}

function initials(name = "?") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
}

function stageLabel(stageId) {
  return stageById[stageId]?.title || stageId || "Sem etapa";
}

function isDone(task) {
  return task.etapa === "entregue" || task.status === "entregue";
}

function isOverdue(task) {
  const due = parseISODate(task.prazo);
  const today = parseISODate(todayISO());
  return Boolean(due && due < today && !isDone(task));
}

function isDueToday(task) {
  return task.prazo === todayISO() && !isDone(task);
}

function deriveStatusFromStage(stageId) {
  const map = {
    revisao: "revisao_interna",
    enviado_cliente: "aguardando_cliente",
    bloqueado: "bloqueado",
    aprovado: "aprovado",
    entregue: "entregue"
  };
  return map[stageId] || "em_andamento";
}

function populateStaticSelects() {
  dom.tipoDemandaSelect.innerHTML = ["<option value=\"\">Selecione</option>"]
    .concat(DEMAND_TYPES.map((type) => `<option value="${escapeHTML(type)}">${escapeHTML(type)}</option>`))
    .join("");

  const stageOptions = COLUMNS.map((column) => `<option value="${column.id}">${escapeHTML(column.title)}</option>`).join("");
  dom.etapaSelect.innerHTML = stageOptions;
  dom.stageFilter.insertAdjacentHTML("beforeend", stageOptions);
}

function populateMemberSelects() {
  const options = ["<option value=\"\">Sem responsável</option>"]
    .concat(members.map((member) => `<option value="${member.id}">${escapeHTML(member.nome)}</option>`))
    .join("");

  dom.responsavelSelect.innerHTML = options;
  dom.revisorSelect.innerHTML = options.replace("Sem responsável", "Sem revisor");
  dom.responsavelFilter.innerHTML = ["<option value=\"\">Todos</option>"]
    .concat(members.map((member) => `<option value="${member.id}">${escapeHTML(member.nome)}</option>`))
    .join("");
}

function showAuth() {
  dom.app.classList.add("hidden");
  dom.authScreen.classList.remove("hidden");
  dom.currentUser.textContent = "Desconectado";
}

function showApp() {
  dom.authScreen.classList.add("hidden");
  dom.app.classList.remove("hidden");
}

async function ensureActiveMember(session) {
  const email = session?.user?.email;
  if (!email) throw new Error("Sessão sem e-mail.");

  const { data, error } = await supabase
    .from("team_members")
    .select("*")
    .eq("active", true)
    .ilike("email", email)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error("Seu e-mail entrou, mas ainda não está cadastrado como membro ativo do estúdio.");
  }
  currentMember = data;
  return data;
}

async function loadMembers() {
  const { data, error } = await supabase
    .from("team_members")
    .select("id,nome,email,cor,funcao,active")
    .eq("active", true)
    .order("nome", { ascending: true });

  if (error) throw error;
  members = data || [];
  populateMemberSelects();
}

async function loadTasks(showSuccess = false) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("prazo", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  tasks = data || [];
  renderAll();
  if (showSuccess) showToast("Quadro atualizado.", "success");
}

async function loadAll(showSuccess = false) {
  await loadMembers();
  await loadTasks(showSuccess);
}

function subscribeRealtime() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
  }

  realtimeChannel = supabase
    .channel("kanban-tasks-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tasks" },
      () => loadTasks(false)
    )
    .subscribe();
}

async function startApp(session) {
  try {
    currentSession = session;
    const member = await ensureActiveMember(session);
    dom.currentUser.textContent = `${member.nome} • ${session.user.email}`;
    showApp();
    await loadAll(false);
    subscribeRealtime();
  } catch (error) {
    console.error(error);
    showAuth();
    showToast(error.message, "error");
  }
}

function getFilteredTasks() {
  const search = dom.searchInput.value.trim().toLowerCase();
  const responsavel = dom.responsavelFilter.value;
  const priority = dom.priorityFilter.value;
  const stage = dom.stageFilter.value;
  const onlyOverdue = dom.overdueFilter.checked;
  const onlyBlocked = dom.blockedFilter.checked;

  return tasks.filter((task) => {
    const searchable = [task.cliente, task.titulo, task.proxima_acao, task.tipo_demanda, task.observacoes]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (search && !searchable.includes(search)) return false;
    if (responsavel && task.responsavel_id !== responsavel) return false;
    if (priority && task.prioridade !== priority) return false;
    if (stage && task.etapa !== stage) return false;
    if (onlyOverdue && !isOverdue(task)) return false;
    if (onlyBlocked && !(task.bloqueado || task.etapa === "bloqueado" || task.status === "bloqueado")) return false;
    return true;
  });
}

function renderAll() {
  renderBoard();
  renderSidebar();
}

function renderBoard() {
  const filtered = getFilteredTasks();

  dom.board.innerHTML = COLUMNS.map((column) => {
    const columnTasks = filtered.filter((task) => task.etapa === column.id);
    const wipOver = column.wip && columnTasks.length > column.wip;
    const cards = columnTasks.length
      ? columnTasks.map(renderTaskCard).join("")
      : `<div class="empty">Nenhum card nesta etapa.</div>`;

    return `
      <section class="column" data-stage="${column.id}">
        <header class="column-header">
          <div class="column-title-row">
            <h2>${escapeHTML(column.title)}</h2>
            <span class="counter">${columnTasks.length}</span>
          </div>
          ${column.wip ? `<p class="wip ${wipOver ? "over" : ""}">Limite sugerido: ${column.wip} cards${wipOver ? " • acima do limite" : ""}</p>` : ""}
          <p class="column-help">${escapeHTML(column.help)}</p>
        </header>
        <div class="card-list">${cards}</div>
      </section>`;
  }).join("");

  attachBoardEvents();
}

function renderTaskCard(task) {
  const member = memberById(task.responsavel_id);
  const name = member?.nome || "Sem responsável";
  const overdue = isOverdue(task);
  const dueToday = isDueToday(task);
  const blocked = task.bloqueado || task.status === "bloqueado" || task.etapa === "bloqueado";
  const links = renderLinks(task);
  const checklist = Array.isArray(task.checklist) ? task.checklist : [];
  const checklistDone = checklist.filter((item) => item.done).length;

  return `
    <article class="task-card priority-${escapeHTML(task.prioridade || "media")} ${overdue ? "overdue" : ""} ${blocked ? "blocked" : ""}" draggable="true" data-task-id="${task.id}">
      <div class="card-top">
        <div>
          <p class="client-name">${escapeHTML(task.cliente)}</p>
          <h3 class="task-title">${escapeHTML(task.titulo)}</h3>
        </div>
        <button type="button" class="card-menu" data-edit-id="${task.id}" aria-label="Editar card">Editar</button>
      </div>

      <div class="tags">
        <span class="tag ${escapeHTML(task.prioridade || "media")}">${PRIORITY_LABELS[task.prioridade] || "Média"}</span>
        <span class="tag status-${escapeHTML(task.status || "em_andamento")}">${STATUS_LABELS[task.status] || "Em andamento"}</span>
        ${overdue ? `<span class="tag urgente">⚠️ Atrasado</span>` : ""}
        ${dueToday ? `<span class="tag alta">Hoje</span>` : ""}
        ${blocked ? `<span class="tag status-bloqueado">🔒 Bloqueado</span>` : ""}
      </div>

      <div class="assignee">
        <span class="avatar" style="background:${escapeHTML(member?.cor || "#64748b")}">${escapeHTML(initials(name))}</span>
        <span>${escapeHTML(name)}</span>
      </div>

      <div class="card-detail">
        ${task.tipo_demanda ? `<span><strong>Tipo:</strong> ${escapeHTML(task.tipo_demanda)}</span>` : ""}
        <span><strong>Prazo:</strong> ${formatDate(task.prazo)}</span>
        ${task.proxima_acao ? `<span><strong>Próxima ação:</strong> ${escapeHTML(task.proxima_acao)}</span>` : ""}
        ${task.motivo_bloqueio ? `<span><strong>Bloqueio:</strong> ${escapeHTML(task.motivo_bloqueio)}</span>` : ""}
        ${checklist.length ? `<span><strong>Checklist:</strong> ${checklistDone}/${checklist.length} concluídos</span>` : ""}
        ${task.updated_at ? `<span><strong>Atualizado:</strong> ${formatDateTime(task.updated_at)}${task.updated_by ? ` por ${escapeHTML(task.updated_by)}` : ""}</span>` : ""}
      </div>

      ${links ? `<div class="card-links">${links}</div>` : ""}
    </article>`;
}

function renderLinks(task) {
  const links = [
    ["Briefing", safeUrl(task.link_briefing)],
    ["Arquivos", safeUrl(task.link_arquivos)],
    ["Figma/Drive", safeUrl(task.link_figma_drive)]
  ].filter(([, url]) => Boolean(url));

  return links.map(([label, url]) => `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`).join("");
}

function attachBoardEvents() {
  dom.board.querySelectorAll(".task-card").forEach((card) => {
    card.addEventListener("dragstart", (event) => {
      card.classList.add("dragging");
      event.dataTransfer.setData("text/plain", card.dataset.taskId);
      event.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
  });

  dom.board.querySelectorAll("[data-edit-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const task = tasks.find((item) => item.id === button.dataset.editId);
      if (task) openTaskDialog(task);
    });
  });

  dom.board.querySelectorAll(".column").forEach((column) => {
    column.addEventListener("dragover", (event) => {
      event.preventDefault();
      column.classList.add("drop-target");
    });
    column.addEventListener("dragleave", () => column.classList.remove("drop-target"));
    column.addEventListener("drop", async (event) => {
      event.preventDefault();
      column.classList.remove("drop-target");
      const taskId = event.dataTransfer.getData("text/plain");
      const stage = column.dataset.stage;
      await moveTask(taskId, stage);
    });
  });
}

async function moveTask(taskId, stage) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task || task.etapa === stage) return;

  const patch = {
    etapa: stage,
    status: deriveStatusFromStage(stage),
    updated_by: currentSession?.user?.email || null
  };

  if (stage === "bloqueado") patch.bloqueado = true;
  if (stage !== "bloqueado" && task.bloqueado) patch.bloqueado = false;

  const { error } = await supabase.from("tasks").update(patch).eq("id", taskId);
  if (error) {
    console.error(error);
    showToast(error.message, "error");
    return;
  }

  tasks = tasks.map((item) => (item.id === taskId ? { ...item, ...patch } : item));
  renderAll();
  showToast(`Card movido para ${stageLabel(stage)}.`, "success");
}

function renderSidebar() {
  renderMetrics();
  renderDeadlines();
  renderBlockers();
  renderClientTable();
}

function renderMetrics() {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const activeTasks = tasks.filter((task) => !isDone(task));
  const newThisWeek = tasks.filter((task) => {
    const date = parseISODate(task.data_entrada);
    return date && date >= weekStart;
  }).length;
  const deliveredThisWeek = tasks.filter((task) => {
    const date = task.updated_at ? new Date(task.updated_at) : null;
    return isDone(task) && date && date >= weekStart;
  }).length;
  const overdue = tasks.filter(isOverdue).length;
  const blocked = tasks.filter((task) => task.bloqueado || task.etapa === "bloqueado" || task.status === "bloqueado").length;
  const waitingClient = tasks.filter((task) => task.etapa === "enviado_cliente" || task.status === "aguardando_cliente").length;

  const byMember = activeTasks.reduce((acc, task) => {
    const name = memberName(task.responsavel_id);
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});
  const busiest = Object.entries(byMember).sort((a, b) => b[1] - a[1])[0];

  const byStage = activeTasks.reduce((acc, task) => {
    acc[task.etapa] = (acc[task.etapa] || 0) + 1;
    return acc;
  }, {});
  const bottleneck = Object.entries(byStage)
    .filter(([stage]) => stage !== "entregue")
    .sort((a, b) => b[1] - a[1])[0];

  const metrics = [
    [newThisWeek, "Demandas novas"],
    [deliveredThisWeek, "Entregues"],
    [overdue, "Atrasadas"],
    [blocked, "Bloqueadas"],
    [waitingClient, "Aguardando cliente"],
    [busiest ? `${busiest[0]} (${busiest[1]})` : "-", "Mais demandas"],
    [bottleneck ? `${stageLabel(bottleneck[0]).split(" /")[0]} (${bottleneck[1]})` : "-", "Gargalo"]
  ];

  dom.metrics.innerHTML = metrics
    .map(([value, label]) => `<div class="metric"><strong>${escapeHTML(value)}</strong><span>${escapeHTML(label)}</span></div>`)
    .join("");
}

function renderDeadlines() {
  const today = parseISODate(todayISO());
  const limit = addDays(today, 7);
  const items = tasks
    .filter((task) => {
      const due = parseISODate(task.prazo);
      return due && due >= today && due <= limit && !isDone(task);
    })
    .sort((a, b) => parseISODate(a.prazo) - parseISODate(b.prazo))
    .slice(0, 8);

  dom.deadlines.innerHTML = items.length
    ? items.map((task) => `
      <div class="compact-item">
        <strong>${escapeHTML(formatDate(task.prazo))} • ${escapeHTML(task.cliente)}</strong>
        <p>${escapeHTML(task.titulo)} — ${escapeHTML(memberName(task.responsavel_id))}</p>
      </div>`).join("")
    : `<div class="empty">Nenhum prazo crítico nos próximos 7 dias.</div>`;
}

function renderBlockers() {
  const items = tasks
    .filter((task) => task.bloqueado || task.etapa === "bloqueado" || task.status === "bloqueado")
    .filter((task) => !isDone(task))
    .slice(0, 8);

  dom.blockers.innerHTML = items.length
    ? items.map((task) => `
      <div class="compact-item">
        <strong>${escapeHTML(task.cliente)} • ${escapeHTML(task.titulo)}</strong>
        <p>${escapeHTML(task.motivo_bloqueio || "Motivo não informado.")}</p>
        <p><strong>Resolver:</strong> ${escapeHTML(task.proxima_acao || "Definir próxima ação")}</p>
      </div>`).join("")
    : `<div class="empty">Nenhum bloqueio registrado.</div>`;
}

function renderClientTable() {
  const active = tasks
    .filter((task) => !isDone(task))
    .sort((a, b) => {
      const byClient = String(a.cliente).localeCompare(String(b.cliente), "pt-BR");
      if (byClient !== 0) return byClient;
      return String(a.prazo || "9999-12-31").localeCompare(String(b.prazo || "9999-12-31"));
    })
    .slice(0, 25);

  dom.clientTableBody.innerHTML = active.length
    ? active.map((task) => `
      <tr>
        <td>${escapeHTML(task.cliente)}</td>
        <td>${escapeHTML(task.titulo)}</td>
        <td>${escapeHTML(memberName(task.responsavel_id))}</td>
        <td>${escapeHTML(stageLabel(task.etapa).split(" /")[0])}</td>
        <td>${escapeHTML(formatDate(task.prazo))}</td>
        <td>${escapeHTML(task.proxima_acao || "-")}</td>
      </tr>`).join("")
    : `<tr><td colspan="6" class="muted">Nenhum cliente ativo.</td></tr>`;
}

function checklistToText(checklist) {
  if (!Array.isArray(checklist)) return "";
  return checklist.map((item) => `${item.done ? "[x] " : ""}${item.text || ""}`).join("\n");
}

function parseChecklist(text) {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const done = /^\[x\]\s*/i.test(line);
      return {
        text: line.replace(/^\[[x ]\]\s*/i, "").trim(),
        done
      };
    })
    .filter((item) => item.text);
}

function openTaskDialog(task = null) {
  dom.taskForm.reset();
  dom.deleteTaskButton.classList.toggle("hidden", !task);
  dom.dialogTitle.textContent = task ? "Editar card" : "Novo card";
  dom.taskForm.elements.id.value = task?.id || "";

  const defaults = {
    cliente: "",
    titulo: "",
    tipo_demanda: "",
    responsavel_id: currentMember?.id || "",
    revisor_id: "",
    prioridade: "media",
    prazo: "",
    data_entrada: todayISO(),
    etapa: "entrada",
    status: "em_andamento",
    canal_solicitacao: "",
    proxima_acao: "",
    link_briefing: "",
    link_arquivos: "",
    link_figma_drive: "",
    bloqueado: false,
    motivo_bloqueio: "",
    observacoes: "",
    checklist_text: "Briefing recebido\nReferências recebidas\nTextos recebidos\nArquivos/materiais recebidos\nPrazo definido\nResponsável definido\nPrimeira versão criada\nRevisão interna feita\nEnviado ao cliente\nAjustes registrados\nAprovado\nArquivos finais entregues\nCliente confirmado"
  };

  const values = task
    ? { ...task, checklist_text: checklistToText(task.checklist), bloqueado: Boolean(task.bloqueado) }
    : defaults;

  Object.entries(values).forEach(([key, value]) => {
    const field = dom.taskForm.elements[key];
    if (!field) return;
    if (field.type === "checkbox") {
      field.checked = Boolean(value);
    } else {
      field.value = value ?? "";
    }
  });

  dom.taskDialog.showModal();
}

function closeTaskDialog() {
  dom.taskDialog.close();
}

async function saveTask(event) {
  event.preventDefault();
  const formData = new FormData(dom.taskForm);
  const id = nullIfEmpty(formData.get("id"));

  const payload = {
    cliente: nullIfEmpty(formData.get("cliente")),
    titulo: nullIfEmpty(formData.get("titulo")),
    tipo_demanda: nullIfEmpty(formData.get("tipo_demanda")),
    responsavel_id: nullIfEmpty(formData.get("responsavel_id")),
    revisor_id: nullIfEmpty(formData.get("revisor_id")),
    prioridade: nullIfEmpty(formData.get("prioridade")) || "media",
    prazo: nullIfEmpty(formData.get("prazo")),
    data_entrada: nullIfEmpty(formData.get("data_entrada")) || todayISO(),
    etapa: nullIfEmpty(formData.get("etapa")) || "entrada",
    status: nullIfEmpty(formData.get("status")) || "em_andamento",
    canal_solicitacao: nullIfEmpty(formData.get("canal_solicitacao")),
    proxima_acao: nullIfEmpty(formData.get("proxima_acao")),
    link_briefing: nullIfEmpty(formData.get("link_briefing")),
    link_arquivos: nullIfEmpty(formData.get("link_arquivos")),
    link_figma_drive: nullIfEmpty(formData.get("link_figma_drive")),
    bloqueado: formData.get("bloqueado") === "on",
    motivo_bloqueio: nullIfEmpty(formData.get("motivo_bloqueio")),
    observacoes: nullIfEmpty(formData.get("observacoes")),
    checklist: parseChecklist(formData.get("checklist_text")),
    updated_by: currentSession?.user?.email || null
  };

  if (!payload.cliente || !payload.titulo) {
    showToast("Preencha cliente e projeto/demanda.", "error");
    return;
  }

  if (payload.bloqueado) {
    payload.status = "bloqueado";
    payload.etapa = "bloqueado";
  }

  const request = id
    ? supabase.from("tasks").update(payload).eq("id", id).select().single()
    : supabase.from("tasks").insert(payload).select().single();

  const { data, error } = await request;
  if (error) {
    console.error(error);
    showToast(error.message, "error");
    return;
  }

  if (id) {
    tasks = tasks.map((task) => (task.id === id ? data : task));
  } else {
    tasks = [data, ...tasks];
  }

  renderAll();
  closeTaskDialog();
  showToast("Card salvo com sucesso.", "success");
}

async function deleteCurrentTask() {
  const id = dom.taskForm.elements.id.value;
  if (!id) return;
  const task = tasks.find((item) => item.id === id);
  const ok = confirm(`Excluir o card "${task?.titulo || "sem título"}"?`);
  if (!ok) return;

  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) {
    console.error(error);
    showToast(error.message, "error");
    return;
  }

  tasks = tasks.filter((item) => item.id !== id);
  renderAll();
  closeTaskDialog();
  showToast("Card excluído.", "success");
}

function bindEvents() {
  dom.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!supabase) return showToast("Configure o Supabase antes de entrar.", "error");

    const email = dom.emailInput.value.trim().toLowerCase();
    const password = dom.passwordInput.value;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      showToast(error.message, "error");
      return;
    }
    await startApp(data.session);
  });

  dom.signupButton.addEventListener("click", async () => {
    if (!supabase) return showToast("Configure o Supabase antes de criar acesso.", "error");

    const email = dom.emailInput.value.trim().toLowerCase();
    const password = dom.passwordInput.value;
    if (!email || password.length < 6) {
      showToast("Informe e-mail e senha com no mínimo 6 caracteres.", "error");
      return;
    }

    const redirectTo = window.location.origin + window.location.pathname;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo }
    });

    if (error) {
      showToast(error.message, "error");
      return;
    }

    if (data.session) {
      await startApp(data.session);
    } else {
      showToast("Cadastro criado. Verifique o e-mail de confirmação, se solicitado pelo Supabase.", "success");
    }
  });

  dom.logoutButton.addEventListener("click", async () => {
    if (realtimeChannel) await supabase.removeChannel(realtimeChannel);
    await supabase.auth.signOut();
    currentSession = null;
    currentMember = null;
    members = [];
    tasks = [];
    showAuth();
  });

  dom.refreshButton.addEventListener("click", () => loadAll(true).catch((error) => showToast(error.message, "error")));
  dom.newTaskButton.addEventListener("click", () => openTaskDialog());
  dom.closeDialogButton.addEventListener("click", closeTaskDialog);
  dom.cancelTaskButton.addEventListener("click", closeTaskDialog);
  dom.taskForm.addEventListener("submit", saveTask);
  dom.deleteTaskButton.addEventListener("click", deleteCurrentTask);

  [dom.searchInput, dom.responsavelFilter, dom.priorityFilter, dom.stageFilter, dom.overdueFilter, dom.blockedFilter].forEach((input) => {
    input.addEventListener("input", renderAll);
    input.addEventListener("change", renderAll);
  });
}

async function boot() {
  populateStaticSelects();
  bindEvents();

  if (!supabase) {
    showAuth();
    return;
  }

  const { data } = await supabase.auth.getSession();
  if (data.session) {
    await startApp(data.session);
  } else {
    showAuth();
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) return;
    if (session?.user?.id !== currentSession?.user?.id) {
      startApp(session);
    }
  });
}

boot().catch((error) => {
  console.error(error);
  showToast(error.message, "error");
});
