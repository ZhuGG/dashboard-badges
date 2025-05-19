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
    name: data.name.trim(),
    qty: Number(data.qty),
    diam: data.diam,
    finish: data.finish,
    type: data.type,
    carton: data.carton,
    client: data.client ? data.client.trim() : "",
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

// SYNTHÈSE
function computeStats(list) {
  let now = new Date();
  let startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  let startOfWeek = startOfToday - ((now.getDay() + 6) % 7) * 864e5;
  let startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  let today = 0, week = 0, month = 0, total = list.length;
  list.forEach(cmd => {
    if (cmd.endTime) {
      if (cmd.endTime >= startOfToday) today += cmd.qty;
      if (cmd.endTime >= startOfWeek) week += cmd.qty;
      if (cmd.endTime >= startOfMonth) month += cmd.qty;
    }
  });
  return { today, week, month, total };
}
function renderSynth() {
  let stats = computeStats(commands);
  document.getElementById('synth').innerHTML = `
    <div>
      <span class="val">${stats.today}</span>
      <span>Badges aujourd'hui</span>
    </div>
    <div>
      <span class="val">${stats.week}</span>
      <span>Semaine</span>
    </div>
    <div>
      <span class="val">${stats.month}</span>
      <span>Mois</span>
    </div>
    <div>
      <span class="val">${stats.total}</span>
      <span>Total commandes</span>
    </div>`;
}

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
    html += `<div class="cmd-card" data-id="${cmd.id}" draggable="false" ontouchstart="">
      <div class="cmd-header">
        <span class="cmd-handle" title="Déplacer">≡</span>
        <span class="cmd-title">${cmd.name}</span>
        <span class="cmd-status" data-status="${cmd.status}">${statusLabel(cmd.status)}</span>
      </div>
      <div class="cmd-meta">
        <span>Qté : <b>${cmd.qty}</b></span>
        <span>${cmd.diam}</span>
        <span>${cmd.finish}</span>
        <span>${cmd.type}</span>
        <span>${cmd.carton}</span>
        ${cmd.client?`<span>Client : <b>${cmd.client}</b></span>`:""}
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

// ACTIONS CARTE
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
    // Animation avant suppression
    card.classList.add("swipe-remove");
    setTimeout(()=>{
      commands.splice(idx,1);
      saveCommands(commands);
      renderSynth(); renderList();
    },220);
    return;
  }
  saveCommands(commands);
  renderSynth(); renderList();
});

// SWIPE MOBILE (suppr)
let startX=0, startY=0, moved=false;
document.getElementById('cmd-list').addEventListener('touchstart', function(e){
  let card = e.target.closest('.cmd-card');
  if (!card) return;
  startX = e.touches[0].clientX; startY = e.touches[0].clientY; moved = false;
  card.style.transition = "";
}, {passive:true});
document.getElementById('cmd-list').addEventListener('touchmove', function(e){
  let card = e.target.closest('.cmd-card');
  if (!card) return;
  let dx = e.touches[0].clientX-startX;
  if (Math.abs(dx)>10) moved=true;
  if (moved) {
    card.style.transform = `translateX(${dx}px)`;
    card.style.opacity = 1-Math.abs(dx)/160;
  }
},{passive:true});
document.getElementById('cmd-list').addEventListener('touchend', function(e){
  let card = e.target.closest('.cmd-card');
  if (!card) return;
  let dx = e.changedTouches[0].clientX-startX;
  card.style.transition = ".18s";
  if (dx < -70) { // swipe left = suppr
    card.classList.add("swipe-remove");
    let id = card.getAttribute("data-id");
    setTimeout(()=>{
      commands = commands.filter(c=>c.id!==id);
      saveCommands(commands);
      renderSynth(); renderList();
    }, 220);
  } else {
    card.style.transform = "";
    card.style.opacity = "";
  }
});

// DRAG & DROP
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
    // calculer où insérer (par rapport à la filteredList)
    let before = list[newI];
    let globalNew = before ? commands.findIndex(c=>c.id===before.id) : commands.length;
    commands.splice(globalNew,0,moving);
    saveCommands(commands); renderList();
  }
});

// FILTRES
document.querySelectorAll('.filters button[data-filter]').forEach(btn=>{
  btn.onclick = ()=>{
    document.querySelectorAll('.filters button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    filter = btn.getAttribute('data-filter');
    renderList();
  }
});

// THEME
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem("theme", theme);
  document.querySelector('.theme-toggle').textContent = theme==="light" ? "☀️" : "🌙";
}
let userTheme = localStorage.getItem("theme") || "dark";
setTheme(userTheme);
document.querySelector('.theme-toggle').onclick = ()=>{
  setTheme(document.documentElement.getAttribute('data-theme')==="dark" ? "light":"dark");
};

// SEARCH
document.getElementById('search').oninput = function(e) {
  search = this.value.trim();
  renderList();
};

// FAB & FORM
let fab = document.getElementById('fab');
let formAdd = document.getElementById('form-add');
fab.onclick = ()=>{
  formAdd.style.display = (formAdd.style.display === "none" || !formAdd.style.display) ? "block" : "none";
  if (formAdd.style.display === "block") formAdd.querySelector('[name="name"]').focus();
};

// FORMULAIRE
formAdd.onsubmit = function(e) {
  e.preventDefault();
  let formData = Object.fromEntries(new FormData(formAdd));
  commands.unshift(newCommand(formData));
  saveCommands(commands);
  formAdd.reset();
  formAdd.style.display = "none";
  renderSynth(); renderList();
  refreshAutocomplete();
};

// AUTOCOMPLETE NOM BADGE
let autocompleteList = document.getElementById('autocomplete-list');
function getHistoryNames() {
  let set = new Set();
  commands.forEach(c=>set.add(c.name));
  return Array.from(set).sort();
}
function refreshAutocomplete() {
  autocompleteList.style.display = "none";
}
document.getElementById('name').oninput = function(e) {
  let val = this.value;
  if (!val) { autocompleteList.style.display="none"; return; }
  let suggs = getHistoryNames().filter(n=>n.toLowerCase().includes(val.toLowerCase()) && n.toLowerCase()!==val.toLowerCase());
  if (!suggs.length) { autocompleteList.style.display="none"; return;}
  autocompleteList.innerHTML = suggs.slice(0,5).map(s=>`<div class="autocomplete-item">${s}</div>`).join('');
  autocompleteList.style.display="block";
};
autocompleteList.onclick = function(e) {
  if (e.target.classList.contains("autocomplete-item")) {
    document.getElementById('name').value = e.target.textContent;
    autocompleteList.style.display="none";
  }
};
document.body.addEventListener('click', function(e){
  if (!autocompleteList.contains(e.target) && e.target.id!=="name")
    autocompleteList.style.display="none";
}, true);

// EXPORT CSV/JSON
function exportData(type) {
  let data = commands.map(c=>{
    let {id,...obj} = c;
    return obj;
  });
  if (type==="csv") {
    let header = Object.keys(data[0]||{}).join(",");
    let rows = data.map(row=>Object.values(row).map(v=>typeof v==="string"?('"'+v.replace(/"/g,'""')+'"'):v).join(","));
    let blob = new Blob([header+"\n"+rows.join("\n")], {type:"text/csv"});
    let a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "badges_vmach.csv";
    a.click();
  } else if (type==="json") {
    let blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
    let a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "badges_vmach.json";
    a.click();
  }
}
document.getElementById('export-csv').onclick = ()=>exportData("csv");
document.getElementById('export-json').onclick = ()=>exportData("json");

// STORAGE EVENTS (multi-onglet live sync)
window.addEventListener("storage", ()=>{
  commands = loadCommands();
  renderSynth(); renderList(); refreshAutocomplete();
});

// INIT
renderSynth();
renderList();
refreshAutocomplete();
