import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ======================
// FIREBASE CONFIG
// ======================
const firebaseConfig = {
  apiKey: "AIzaSyC4kgy_L79WYFqr9XZhoDuZBfqG4AGTVUQ",
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
// ELEMENTOS
// ======================
const modal = document.querySelector(".members-modal");
const list = document.getElementById("members-list");
const closeBtn = document.querySelector(".close-members");

// ======================
// ABRIR JANELA
// ======================
window.openMembers = async function (faction = null) {

  modal.style.display = "flex";

  const snap = await get(ref(db, "players"));

  if (!snap.exists()) return;

  const data = snap.val();

  list.innerHTML = "";

  Object.values(data).forEach(player => {

    if (faction && player.character?.faction !== faction) return;

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
};

// ======================
// FECHAR
// ======================
closeBtn.addEventListener("click", () => {
  modal.style.display = "none";
});
