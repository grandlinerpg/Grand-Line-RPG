import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getDatabase,
  ref,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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
// FUNÇÃO PRINCIPAL
// ======================
async function renderMembers(faction) {

  const modal = document.querySelector(".members-modal");
  const list = document.getElementById("members-list");

  if (!modal || !list) return;

  modal.style.display = "flex";

  const snap = await get(ref(db, "players"));

  list.innerHTML = "";

  if (!snap.exists()) return;

  const data = snap.val();

  Object.values(data).forEach(player => {

    const playerFaction = player.character?.faction;

    if (faction && playerFaction !== faction) return;

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

  // fechar botão (garante que existe após render)
  const closeBtn = document.querySelector(".close-members");

  if (closeBtn) {
    closeBtn.onclick = () => {
      modal.style.display = "none";
    };
  }
}

// ======================
// EXPÕE GLOBAL
// ======================
window.openMembers = renderMembers;
