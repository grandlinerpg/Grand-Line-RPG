import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ======================
// FIREBASE CONFIG
// ======================
const firebaseConfig = {
  apiKey: "AIzaSyC4kgy_L79WYFQr9XZhoDuBfqG4AGTVUQ",
  authDomain: "grand-line-rpg-dcda9.firebaseapp.com",
  databaseURL: "https://grand-line-rpg-dcda9-default-rtdb.firebaseio.com",
  projectId: "grand-line-rpg-dcda9",
  storageBucket: "grand-line-rpg-dcda9.appspot.com",
  messagingSenderId: "172042779786",
  appId: "1:172042779786:web:ecdff9eaf4fee36eca8173"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ======================
// ELEMENTOS DO MODAL
// ======================
const modal = document.querySelector(".members-modal");
const list = document.getElementById("members-list");
const closeBtn = document.querySelector(".close-members");

// facção vem da página principal
const faction = window.currentFaction || null;

// ======================
// FECHAR MODAL
// ======================
function closeModal() {
  if (modal) modal.remove();
  const container = document.getElementById("members-container");
  if (container) container.innerHTML = "";
}

// ======================
// CARREGAR MEMBROS
// ======================
async function loadMembers() {
  if (!modal || !list) return;

  modal.style.display = "flex";

  const snap = await get(ref(db, "players"));
  list.innerHTML = "";

  if (!snap.exists()) return;

  const data = snap.val();

  let count = 0;

  Object.values(data).forEach(player => {

    const playerFaction = player.character?.faction;

    if (faction && playerFaction !== faction) return;

    count++;

    const card = document.createElement("div");
    card.className = "member-card";

    const name = player.nome || "Desconhecido";
    const char = player.character?.charName || "-";
    const level = player.info?.level || 1;

    card.innerHTML = `
      <div>
        <div class="member-name">${name}</div>
        <div class="member-info">${char}</div>
      </div>

      <div class="member-info">Lv ${level}</div>
    `;

    list.appendChild(card);
  });

  // atualiza contador na facção (se existir no HTML)
  const countEl = document.getElementById(`count-${faction}`);
  if (countEl) countEl.textContent = count;
}

// ======================
// EVENTO DO BOTÃO FECHAR
// ======================
function setupCloseButton() {
  const btn = document.querySelector(".close-members");

  if (btn) {
    btn.addEventListener("click", closeModal);
  }
}

// ======================
// START
// ======================
setupCloseButton();
loadMembers();
