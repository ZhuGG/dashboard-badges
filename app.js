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
let editIdx = null;

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
  list.forEach((cmd, i) => {
    let liveDur = cmd.status === "done" ? cmd.durationSec
      : Math.floor(((cmd.endTime||Date.now())-(cmd.startTime||Date.now()))/1000);
    let addedClass = (i === 0 && window.__justAdded) ? "added" : "";
    html += `<div class="cmd-card ${addedClass}" data-id="${cmd.id}" draggable="false">
      <div class="cmd-header">
        <span class="cmd-handle" title="Déplacer">≡</span>
        <span class="cmd-title">${cmd.name}</span>
        <span class="cmd-edit" title="Modifier">✎</span>
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
        <button type="button" data-act="pause">${cmd.status === "pause" ? "Reprendre" : "Pause"}</button>
        <button type="button" data-act="done">Terminer</button>
        <button type="button" data-act="delete">Supprimer</button>
      </div>
    </div>`;
  });
  document.getElementById('cmd-list').innerHTML = html || "<div style='color:var(--text-muted);text-align:center;padding:2rem 0'>Aucune commande…</div>";
  updateTimers();
  window.__justAdded = false;
}

// STATUS
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

// ACTIONS CARTE (pause, done, delete, edit)
document.getElementById('cmd-list').addEventListener('click', function(e) {
  let btn = e.target.closest('button[data-act]');
  let card = e.target.closest('.cmd-card');
  let id = card?.getAttribute("data-id");
  let idx = commands.findIndex(c=>c.id===id);

  // Edition rapide (clic sur crayon)
  if (e.target.classList.contains('cmd-edit')) {
    let cmd = commands[idx];
    // Pré-remplir le formulaire
    Object.entries(cmd).forEach(([k,v])=>{
      let input = formAdd.elements[k];
      if(input) input.value = v;
    });
    formAdd.style.display = "block";
    formAdd.scrollIntoView({behavior:"smooth",block:"center"});
    editIdx = idx;
    fab.style.display = "none";
    formAdd.querySelector('[name="client"]').focus();
    formAdd.querySelector('button[type="submit"]').textContent = "Enregistrer";
    return;
  }

  if (!btn || idx < 0) return;
  let act = btn.getAttribute('data-act');
  if (act==="pause") {
    commands[idx].status = (commands[idx].status==="pause") ? "wait" : "pause";
    saveCommands(commands);
    renderList();
    btn.classList.add("acted");
    setTimeout(()=>btn.classList.remove("acted"), 520);
  }
  else if (act==="done") {
    if (!commands[idx].endTime) {
      commands[idx].endTime = Date.now();
      commands[idx].durationSec = Math.floor((commands[idx].endTime-commands[idx].startTime)/1000);
    }
    commands[idx].status = "done";
    saveCommands(commands);
    renderList();
    btn.classList.add("acted");
    setTimeout(()=>btn.classList.remove("acted"), 520);
  }
  else if (act==="delete") {
    if (confirm("Supprimer cette commande ? Cette action est irréversible.")) {
      card.classList.add("swipe-remove");
      setTimeout(()=>{
        commands.splice(idx,1);
        saveCommands(commands);
        renderList();
      },220);
    }
  }
});

// SWIPE MOBILE (gauche = supprimer, droite = pause)
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
    card.style.opacity = 1-Math.abs(dx)/220;
  }
},{passive:true});
document.getElementById('cmd-list').addEventListener('touchend', function(e){
  let card = e.target.closest('.cmd-card');
  if (!card) return;
  let dx = e.changedTouches[0].clientX-startX;
  card.style.transition = ".18s";
  let id = card.getAttribute("data-id");
  let idx = commands.findIndex(c=>c.id===id);

  if (dx < -70) { // swipe gauche = supprimer
    if (confirm("Supprimer cette commande ?")) {
      card.classList.add("swipe-remove");
      setTimeout(()=>{
        commands.splice(idx,1);
        saveCommands(commands);
        renderList();
      }, 200);
    } else {
      card.style.transform = ""; card.style.opacity = "";
    }
  } else if (dx > 70) { // swipe droite = pause/reprendre
    commands[idx].status = (commands[idx].status==="pause") ? "wait" : "pause";
    saveCommands(commands);
    renderList();
  } else {
    card.style.transform = "";
    card.style.opacity = "";
  }
});

// DRAG & DROP + long press mobile (delay)
new Sortable(document.getElementById('cmd-list'), {
  animation: 160,
  handle: ".cmd-handle",
  touchStartThreshold: 5,
  delay: 120,
  delayOnTouchOnly: true
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

// FAB & FORM (gestion mobile & desktop)
let fab = document.getElementById('fab');
let formAdd = document.getElementById('form-add');
fab.onclick = (e)=>{
  e.stopPropagation();
  formAdd.style.display = (formAdd.style.display === "none" || !formAdd.style.display) ? "block" : "none";
  if (formAdd.style.display === "block") {
    setTimeout(()=>formAdd.querySelector('[name="client"]').focus(),120);
    fab.style.display = "none";
    editIdx = null;
    formAdd.querySelector('button[type="submit"]').textContent = "Ajouter";
  }
};
// Ferme le formulaire si on clique hors du form
document.addEventListener("click", function(e){
  if (formAdd.style.display === "block" && !formAdd.contains(e.target) && e.target!==fab) {
    formAdd.style.display = "none";
    fab.style.display = "flex";
    editIdx = null;
    formAdd.querySelector('button[type="submit"]').textContent = "Ajouter";
  }
});
// Gère l'appui sur echap
document.addEventListener('keydown', function(e){
  if (e.key === "Escape") {
    formAdd.style.display = "none";
    fab.style.display = "flex";
    editIdx = null;
    formAdd.querySelector('button[type="submit"]').textContent = "Ajouter";
  }
});

// FORMULAIRE (ajout ou édition)
formAdd.onsubmit = function(e) {
  e.preventDefault();
  let formData = Object.fromEntries(new FormData(formAdd));
  if (editIdx !== null && typeof editIdx === "number") {
    // édition
    Object.assign(commands[editIdx], formData);
    saveCommands(commands);
    editIdx = null;
    formAdd.querySelector('button[type="submit"]').textContent = "Ajouter";
    fab.style.display = "flex";
  } else {
    // ajout
    commands.unshift(newCommand(formData));
    saveCommands(commands);
    window.__justAdded = true;
    fab.style.display = "flex";
  }
  formAdd.reset();
  formAdd.style.display = "none";
  renderList();
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

// EXPORT CSV compatible accents
function exportData(type) {
  let data = commands.map(c=>{
    let {id,...obj} = c;
    return obj;
  });
  if (type==="csv") {
    let header = Object.keys(data[0]||{}).join(",");
    let rows = data.map(row=>Object.values(row).map(v=>typeof v==="string"?('"'+v.replace(/"/g,'""')+'"'):v).join(","));
    let csvContent = "\uFEFF" + header + "\n" + rows.join("\n");
    let blob = new Blob([csvContent], {type:"text/csv"});
    let a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "badges_vmach.csv";
    a.click();
  }
}
document.getElementById('export-csv').onclick = ()=>exportData("csv");

// ENVOI PAR MAIL (compact, clair)
function mailExport() {
  // Commandes terminées
  let done = commands.filter(c => c.status === "done");
  if (!done.length) {
    alert("Aucune commande terminée à envoyer.");
    return;
  }
  let lignes = [
    "Badges V-MACH terminés :\n",
    ...done.map(cmd =>
      `• ${cmd.name} | Client : ${cmd.client} | Qté : ${cmd.qty} | Format : ${cmd.diam} | Finition : ${cmd.finish} | Attache : ${cmd.type} | Carton : ${cmd.carton} | Créé : ${formatDate(cmd.startTime)} | Terminé : ${formatDate(cmd.endTime)} | Durée : ${formatDuration(cmd.durationSec)}`
    )
  ];
  let mailBody = lignes.join("\n");
  let subject = encodeURIComponent("Badges terminés - Synthèse V-MACH");
  let body = encodeURIComponent(mailBody);
  let mailto = `mailto:?subject=${subject}&body=${body}`;
  window.open(mailto, "_blank");
}
document.getElementById('export-mail').onclick = mailExport;

// STORAGE EVENTS (multi-onglet live sync)
window.addEventListener("storage", ()=>{
  commands = loadCommands();
  renderList();
  refreshAutocomplete();
});

// INIT
renderList();
refreshAutocomplete();
