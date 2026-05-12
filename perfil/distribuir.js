import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyC4kgy_L79WYFqr9XZhoDuZBfqG4AGTVUQ",
  authDomain: "grand-line-rpg-dcda9.firebaseapp.com",
  projectId: "grand-line-rpg-dcda9",
  storageBucket: "grand-line-rpg-dcda9.appspot.com",
  messagingSenderId: "172042779786",
  appId: "1:172042779786:web:ecdff9eaf4fee36eca8173",
  databaseURL: "https://grand-line-rpg-dcda9-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const uid = localStorage.getItem("uid");
if (!uid) window.location.href = "auth.html";

let stats = null;
let points = null;

// ======================
// MODAL HTML
// ======================

fetch("perfil/distribuir.html")
  .then(r => r.text())
  .then(html => {

    document.getElementById("modal-container").innerHTML = html;

    const modal = document.querySelector(".points-modal");

    modal.style.display = "none";

    // ======================
    // 🔥 DELEGATION (SEMPRE FUNCIONA)
    // ======================

    document.addEventListener("click", async (e) => {

      // abrir modal
      if (e.target.id === "open-points") {
        modal.style.display = "flex";
        await loadPlayer();
      }

      // fechar modal
      if (e.target.classList.contains("close-btn")) {
        modal.style.display = "none";
      }

    });

  });

// ======================
// FIREBASE LOAD
// ======================

async function loadPlayer() {

  const snap = await get(ref(db, `players/${uid}`));
  if (!snap.exists()) return;

  const player = snap.val();

  stats = player.stats || {
    str: 1,
    res: 1,
    dex: 1,
    agi: 1,
    sta: 1,
    hp: 1
  };

  points = player.points || {
    available: 0,
    used: 0
  };

  document.getElementById("modal-str").textContent = stats.str;
  document.getElementById("modal-res").textContent = stats.res;
  document.getElementById("modal-dex").textContent = stats.dex;
  document.getElementById("modal-agi").textContent = stats.agi;
  document.getElementById("modal-sta").textContent = stats.sta;
  document.getElementById("modal-hp").textContent = stats.hp;

  document.getElementById("available-points").textContent = points.available;
  document.getElementById("used-points").textContent = points.used;
}
