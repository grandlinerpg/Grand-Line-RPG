import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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

/**
 * FUNÇÃO GLOBAL PRA ABRIR MEMBROS
 * (isso resolve o botão de uma vez)
 */
window.openMembers = async function (faction) {

  const snap = await get(ref(db, "players"));

  if (!snap.exists()) return;

  const data = snap.val();

  // cria modal se não existir
  let modal = document.querySelector(".members-modal");

  if (!modal) {
    modal = document.createElement("div");
    modal.className = "members-modal";
    modal.innerHTML = `
      <div class="members-box">
        <button class="close-members">X</button>
        <h2>Membros</h2>
        <div id="members-list"></div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  const list = modal.querySelector("#members-list");
  list.innerHTML = "";

  let count = 0;

  Object.values(data).forEach(p => {

    if (p?.character?.faction !== faction) return;

    count++;

    const div = document.createElement("div");
    div.className = "member-card";

    div.innerHTML = `
      <div>
        <strong>${p.nome || "Sem nome"}</strong><br>
        <small>${p.character?.charName || ""}</small>
      </div>
      <div>Lv ${p.info?.level || 1}</div>
    `;

    list.appendChild(div);
  });

  modal.style.display = "flex";

  modal.querySelector(".close-members").onclick = () => {
    modal.style.display = "none";
  };
};
