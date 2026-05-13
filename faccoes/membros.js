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

async function loadMembers() {

  const list = document.getElementById("members-list");
  const modal = document.querySelector(".members-modal");

  const faction = window.currentFaction;

  const snap = await get(ref(db, "players"));

  list.innerHTML = "";

  if (!snap.exists()) return;

  const data = snap.val();

  let count = 0;

  Object.values(data).forEach(p => {

    if (p.character?.faction !== faction) return;

    count++;

    const div = document.createElement("div");
    div.className = "member-card";

    div.innerHTML = `
      <div>
        <strong>${p.nome}</strong><br>
        <small>${p.character?.charName}</small>
      </div>
      <div>Lv ${p.info?.level || 1}</div>
    `;

    list.appendChild(div);
  });

  modal.querySelector(".close-members").onclick = () => {
    modal.remove();
  };
}

loadMembers();
