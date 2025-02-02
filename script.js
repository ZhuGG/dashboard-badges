// script.js

// Variables globales
let sessionActive = false;
let session = null;  // session en cours
let sessions = [];   // sessions terminées

// Fonctions de gestion du localStorage

function loadSessions() {
  const stored = localStorage.getItem("sessions");
  if (stored) {
    sessions = JSON.parse(stored);
    sessions.forEach(s => {
      s.startTime = new Date(s.startTime);
      if (s.endTime) s.endTime = new Date(s.endTime);
      if (s.pauseStart) s.pauseStart = new Date(s.pauseStart);
    });
    updateStats();
  }
}

function saveSessions() {
  localStorage.setItem("sessions", JSON.stringify(sessions));
}

function saveActiveSession() {
  if (sessionActive && session) {
    localStorage.setItem("activeSession", JSON.stringify(session));
  }
}

function loadActiveSession() {
  const activeSessionStr = localStorage.getItem("activeSession");
  if (activeSessionStr) {
    session = JSON.parse(activeSessionStr);
    session.startTime = new Date(session.startTime);
    if (session.endTime) session.endTime = new Date(session.endTime);
    if (session.pauseStart) session.pauseStart = new Date(session.pauseStart);
    sessionActive = true;
    restoreActiveSessionDisplay();
  }
}

function clearActiveSession() {
  localStorage.removeItem("activeSession");
}

// Chargement initial des sessions
loadSessions();
loadActiveSession();

// Références DOM
const sessionInitDiv = document.getElementById('sessionInit');
const startSessionButton = document.getElementById('startSessionButton');
const activeSessionDiv = document.getElementById('activeSession');
const sessionStartTimeSpan = document.getElementById('sessionStartTime');
const sessionStatusSpan = document.getElementById('sessionStatus');
const totalPauseTimeSpan = document.getElementById('totalPauseTime');
const pauseButton = document.getElementById('pauseButton');
const finishSessionButton = document.getElementById('finishSessionButton');
const orderForm = document.getElementById('orderForm');
const ordersTableBody = document.querySelector('#ordersTable tbody');
const displayClientName = document.getElementById('displayClientName');
const displayCommandName = document.getElementById('displayCommandName');
const sendEmailButton = document.getElementById('sendEmailButton');

// Restauration de l'affichage de la session active
function restoreActiveSessionDisplay() {
  displayClientName.textContent = session.clientName;
  displayCommandName.textContent = session.commandName;
  sessionStartTimeSpan.textContent = new Date(session.startTime).toLocaleTimeString();
  sessionStatusSpan.textContent = session.paused ? "En pause" : "En cours";
  totalPauseTimeSpan.textContent = session.pauseTotal;
  activeSessionDiv.style.display = 'block';
  sessionInitDiv.style.display = 'none';
  updateOrdersTable();
}

// Démarrer une session
startSessionButton.addEventListener('click', () => {
  const clientNameInput = document.getElementById('clientName').value.trim();
  const commandNameInput = document.getElementById('commandName').value.trim();
  if (!clientNameInput || !commandNameInput) {
    alert("Veuillez renseigner le nom du client et le nom de la commande.");
    return;
  }
  sessionActive = true;
  session = {
    clientName: clientNameInput,
    commandName: commandNameInput,
    startTime: new Date(),
    endTime: null,
    pauseTotal: 0,
    orders: [],
    paused: false,
    pauseStart: null
  };
  console.log("Session démarrée :", session);
  displayClientName.textContent = session.clientName;
  displayCommandName.textContent = session.commandName;
  sessionStartTimeSpan.textContent = session.startTime.toLocaleTimeString();
  sessionStatusSpan.textContent = "En cours";
  totalPauseTimeSpan.textContent = session.pauseTotal;
  activeSessionDiv.style.display = 'block';
  sessionInitDiv.style.display = 'none';
  saveActiveSession();
});

// Gérer la pause / reprise
pauseButton.addEventListener('click', () => {
  if (!session) return;
  if (!session.paused) {
    session.paused = true;
    session.pauseStart = new Date();
    pauseButton.textContent = "Reprendre";
    sessionStatusSpan.textContent = "En pause";
  } else {
    const pauseEnd = new Date();
    const pauseDuration = Math.round((pauseEnd - session.pauseStart) / 60000);
    session.pauseTotal += pauseDuration;
    session.paused = false;
    session.pauseStart = null;
    pauseButton.textContent = "Pause";
    sessionStatusSpan.textContent = "En cours";
    totalPauseTimeSpan.textContent = session.pauseTotal;
  }
  console.log("Mise à jour de la pause, pause totale :", session.pauseTotal);
  saveActiveSession();
});

// Terminer la session
finishSessionButton.addEventListener('click', () => {
  if (!session) return;
  if (session.paused) {
    const pauseEnd = new Date();
    const pauseDuration = Math.round((pauseEnd - session.pauseStart) / 60000);
    session.pauseTotal += pauseDuration;
    session.paused = false;
    session.pauseStart = null;
    pauseButton.textContent = "Pause";
  }
  session.endTime = new Date();
  sessionActive = false;
  sessions.push(session);
  saveSessions();
  clearActiveSession();
  console.log("Session terminée :", session);
  alert("Session terminée. Commandes enregistrées localement.");
  updateStats();
  activeSessionDiv.style.display = 'none';
  sessionInitDiv.style.display = 'block';
  document.getElementById('clientName').value = "";
  document.getElementById('commandName').value = "";
  session = null;
});

// Ajout d'une commande
orderForm.addEventListener('submit', (e) => {
  e.preventDefault();
  console.log("Tentative d'ajout d'une commande. Session active ?", sessionActive);
  if (!session || !sessionActive) {
    alert("Aucune session active. Veuillez démarrer une session.");
    return;
  }
  const badgeSize = document.getElementById('badgeSize').value;
  const accessory = document.getElementById('accessory').value;
  const finish = document.querySelector('input[name="finish"]:checked').value;
  const quantity = parseInt(document.getElementById('quantity').value, 10);
  const orderTime = new Date();
  const order = { badgeSize, accessory, finish, quantity, orderTime };
  session.orders.push(order);
  console.log("Commande ajoutée :", order);
  updateOrdersTable();
  orderForm.reset();
  saveActiveSession();
});

// Mise à jour du tableau des commandes
function updateOrdersTable() {
  ordersTableBody.innerHTML = '';
  if (!session) return;
  session.orders.forEach(order => {
    const orderTimeStr = new Date(order.orderTime).toLocaleTimeString();
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${orderTimeStr}</td>
      <td>${order.badgeSize} mm</td>
      <td>${order.accessory}</td>
      <td>${order.finish}</td>
      <td>${order.quantity}</td>
    `;
    ordersTableBody.appendChild(row);
  });
}

// Mise à jour des statistiques et du graphique
function updateStats() {
  let totalOrders = 0;
  let totalQuantity = 0;
  let badgeCounts = { '25': 0, '38': 0, '45': 0, '58': 0 };
  sessions.forEach(s => {
    s.orders.forEach(order => {
      totalOrders++;
      totalQuantity += order.quantity;
      if (badgeCounts[order.badgeSize] !== undefined) {
        badgeCounts[order.badgeSize] += order.quantity;
      }
    });
  });
  document.getElementById('totalOrders').textContent = totalOrders;
  document.getElementById('totalQuantity').textContent = totalQuantity;
  updateChart(badgeCounts);
  
  // Affichage des temps de la dernière session
  const lastSessionStatsDiv = document.getElementById('lastSessionStats');
  if (sessions.length > 0) {
    const lastSession = sessions[sessions.length - 1];
    const start = new Date(lastSession.startTime).toLocaleTimeString();
    const end = lastSession.endTime ? new Date(lastSession.endTime).toLocaleTimeString() : "En cours";
    let duration = "";
    if (lastSession.endTime) {
      const diff = Math.round((new Date(lastSession.endTime) - new Date(lastSession.startTime)) / 60000);
      const effective = diff - lastSession.pauseTotal;
      duration = `${effective} minutes (Total: ${diff} minutes, Pause: ${lastSession.pauseTotal} minutes)`;
    }
    lastSessionStatsDiv.innerHTML = `
      <p>Session dernière: Début ${start} - Fin ${end}</p>
      <p>Durée effective: ${duration}</p>
    `;
  } else {
    lastSessionStatsDiv.innerHTML = "";
  }
}

let statsChart = null;
function updateChart(badgeCounts) {
  const ctx = document.getElementById('statsChart').getContext('2d');
  const data = {
    labels: ['25 mm', '38 mm', '45 mm', '58 mm'],
    datasets: [{
      label: 'Quantité produite',
      data: [badgeCounts['25'], badgeCounts['38'], badgeCounts['45'], badgeCounts['58']],
      backgroundColor: [
        'rgba(255, 99, 132, 0.6)',
        'rgba(54, 162, 235, 0.6)',
        'rgba(255, 206, 86, 0.6)',
        'rgba(75, 192, 192, 0.6)'
      ],
      borderColor: [
        'rgba(255, 99, 132, 1)',
        'rgba(54, 162, 235, 1)',
        'rgba(255, 206, 86, 1)',
        'rgba(75, 192, 192, 1)'
      ],
      borderWidth: 1
    }]
  };
  const options = {
    responsive: true,
    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
  };
  if (statsChart) {
    statsChart.data = data;
    statsChart.update();
  } else {
    statsChart = new Chart(ctx, { type: 'bar', data: data, options: options });
  }
}

// Envoi de l'email prérempli
sendEmailButton.addEventListener('click', () => {
  if (sessions.length === 0) {
    alert("Aucune session terminée à envoyer.");
    return;
  }
  const lastSession = sessions[sessions.length - 1];
  let emailBody = "Bonjour Pan,%0D%0A%0D%0A";
  emailBody += "Voici le récapitulatif de la session de production :%0D%0A";
  emailBody += `Client : ${lastSession.clientName}%0D%0A`;
  emailBody += `Commande : ${lastSession.commandName}%0D%0A`;
  emailBody += `Début de session : ${new Date(lastSession.startTime).toLocaleTimeString()}%0D%0A`;
  emailBody += `Fin de session : ${lastSession.endTime ? new Date(lastSession.endTime).toLocaleTimeString() : "En cours"}%0D%0A`;
  emailBody += `Pause totale : ${lastSession.pauseTotal} minutes%0D%0A`;
  if (lastSession.endTime) {
    const diff = Math.round((new Date(lastSession.endTime) - new Date(lastSession.startTime)) / 60000);
    const effective = diff - lastSession.pauseTotal;
    emailBody += `Durée effective : ${effective} minutes (Total: ${diff} minutes, Pause: ${lastSession.pauseTotal} minutes)%0D%0A`;
  }
  emailBody += "%0D%0ACommandes :%0D%0A";
  lastSession.orders.forEach((order, index) => {
    const orderTimeStr = new Date(order.orderTime).toLocaleTimeString();
    emailBody += `Commande ${index + 1} :%0D%0A`;
    emailBody += `Heure : ${orderTimeStr}%0D%0A`;
    emailBody += `Taille : ${order.badgeSize} mm, Accessoire : ${order.accessory}, Finition : ${order.finish}, Quantité : ${order.quantity}%0D%0A%0D%0A`;
  });
  emailBody += "Cordialement,%0D%0AHugues";
  const subject = `Récapitulatif Session Production - ${lastSession.clientName} - ${lastSession.commandName} - ${new Date(lastSession.startTime).toLocaleDateString()}`;
  const mailtoLink = `mailto:info@v-mach.com?subject=${encodeURIComponent(subject)}&body=${emailBody}`;
  window.location.href = mailtoLink;
});
