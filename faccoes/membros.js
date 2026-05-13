import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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

// FUNÇÃO GLOBAL
window.openMembers = async function (faction) {

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

    card.innerHTML = `
      <div>
        <div class="member-name">${player.nome || "Desconhecido"}</div>
        <div class="member-info">${player.character?.charName || "-"}</div>
      </div>

      <div class="member-info">Lv ${player.info?.level || 1}</div>
    `;

    list.appendChild(card);
  });

  const closeBtn = modal.querySelector(".close-members");

  if (closeBtn) {
    closeBtn.onclick = () => {
      modal.style.display = "none";
    };
  }
};
