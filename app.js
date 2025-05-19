// MODELE & PERSISTENCE
const STORAGE_KEY = "commands";
function loadCommands() {
  try {
    let data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}
function saveCommands(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("storage"));
}
function newCommand(data) {
  return {
    id: Date.now() + "" + Math.floor(Math.random()*9999),
    client: data.client.trim(),
    name: data.name.trim(),
    qty: Number(data.qty),
    diam: data.diam,
    finish: data.finish,
    type: data.type,
    carton: data.carton,
    status: "wait",
    startTime: Date.now(),
    endTime: null,
    durationSec: 0
  }
}

// VARIABLES GLOBALES
let commands = loadCommands();
let filter = "all";
let timers = {};
let search = "";

// FILTRES & RECHERCHE
function filterList(cmd) {
  if (filter !== "all" && cmd.status !== filter) return false;
  if (search) {
    let s = search.toLowerCase();
    return (cmd.name && cmd.name.toLowerCase().includes(s))
      || (cmd.client && cmd.client.toLowerCase().includes(s))
      || (cmd.diam && cmd.diam.toLowerCase().includes(s))
      || (cmd.type && cmd.type.toLowerCase().includes(s));
  }
  return true;
}

// RENDER COMMANDES
function formatDate(ts) {
  let d = new Date(ts);
  return d.toLocaleDateString("fr-FR") + " " + d.toLocaleTimeString("fr-FR").slice(0,5);
}
function formatDuration(sec) {
  if (!sec) return "—";
  let h = Math.floor(sec/3600);
  let m = Math.floor(sec%3600/60);
  let s = sec%60;
  return (h ? h+"h ":"") + (m?m+"m ":"") + (s?`${s}s`:"");
}
function renderList() {
  let list = commands.filter(filterList);
  let html = "";
  list.forEach(cmd => {
    let liveDur = cmd.status === "done" ? cmd.durationSec
      : Math.floor(((cmd.endTime||Date.now())-(cmd.startTime||Date.now()))/1000);
    html += `<div class="cmd-card" data-id="${cmd.id}" draggable="false">
      <div class="cmd-header">
        <span class="cmd-handle" title="Déplacer">≡</span>
        <span class="cmd-title">${cmd.name}</span>
        <span class="cmd-status" data-status="${cmd.status}">${statusLabel(cmd.status)}</span>
      </div>
      <div class="cmd-meta">
        <span>Client : <b>${cmd.client}</b></span>
        <span>Qté : <b>${cmd.qty}</b></span>
        <span>${cmd.diam}</span>
        <span>${cmd.finish}</span>
        <span>${cmd.type}</span>
        <span>${cmd.carton}</span>
      </div>
      <div class="cmd-meta">
        <span>Créé : ${formatDate(cmd.startTime)}</span>
        <span class="cmd-timer">${cmd.status === "done" ? 'Durée' : 'En cours'} : <b>${formatDuration(liveDur)}</b></span>
      </div>
      <div class="cmd-actions">
        <button data-act="pause">${cmd.status === "pause" ? "Reprendre" : "Pause"}</button>
        <button data-act="done">Terminer</button>
        <button data-act="delete">Supprimer</button>
      </div>
    </div>`;
  });
  document.getElementById('cmd-list').innerHTML = html || "<div style='color:var(--text-muted);text-align:center;padding:2rem 0'>Aucune commande…</div>";
  updateTimers();
}
function statusLabel(st) {
  if (st === "wait") return "En attente";
  if (st === "pause") return "En pause";
  if (st === "done") return "Terminée";
  return st;
}

// TIMER LIVE
function updateTimers() {
  clearInterval(timers.list);
  timers.list = setInterval(() => {
    document.querySelectorAll('.cmd-card').forEach(card => {
      let id = card.getAttribute("data-id");
      let cmd = commands.find(c=>c.id===id);
      if (!cmd) return;
      let span = card.querySelector('.cmd-timer b');
      if (span && cmd.status !== "done") {
        let dur = Math.floor(((cmd.endTime||Date.now())-(cmd.startTime||Date.now()))/1000);
        span.textContent = formatDuration(dur);
      }
    });
  }, 1000);
}

// ACTIONS CARTE (pause, done, delete)
document.getElementById('cmd-list').addEventListener('click', function(e) {
  let btn = e.target.closest('button[data-act]');
  if (!btn) return;
  let card = e.target.closest('.cmd-card');
  let id = card.getAttribute("data-id");
  let idx = commands.findIndex(c=>c.id===id);
  if (idx<0) return;
  let act = btn.getAttribute('data-act');
  if (act==="pause") {
    if (commands[idx].status==="pause") {
      commands[idx].status = "wait";
    } else {
      commands[idx].status = "pause";
    }
  }
  else if (act==="done") {
    if (!commands[idx].endTime) {
      commands[idx].endTime = Date.now();
      commands[idx].durationSec = Math.floor((commands[idx].endTime-commands[idx].startTime)/1000);
    }
    commands[idx].status = "done";
  }
  else if (act==="delete") {
    card.classList.add("swipe-remove");
    setTimeout(()=>{
      commands.splice(idx,1);
      saveCommands(commands);
      renderList();
    },220);
    return;
  }
  saveCommands(commands);
  renderList();
});

// DRAG & DROP (déplacement)
new Sortable(document.getElementById('cmd-list'), {
  animation: 160,
  handle: ".cmd-handle",
  onEnd: function (evt) {
    let oldI = evt.oldIndex, newI = evt.newIndex;
    if (oldI === newI) return;
    let list = commands.filter(filterList);
    let moving = list[oldI];
    let globalOld = commands.findIndex(c=>c.id===moving.id);
    commands.splice(globalOld,1);
    let before = list[newI];
    let globalNew = before ? commands.findIndex(c=>c.id===before.id) : commands.length;
    commands.splice(globalNew,0,moving);
    saveCommands(commands); renderList();
  }
});

// FILTRES
document.querySelectorAll('.filters button[data-filter]').forEach(btn
