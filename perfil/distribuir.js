// ======================
// FIREBASE
// ======================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ======================
// CONFIG
// ======================

const firebaseConfig = {
  apiKey: "AIzaSyC4kgy_L79WYFqr9XZhoDuZBfqG4AGTVUQ",
  authDomain: "grand-line-rpg-dcda9.firebaseapp.com",
  projectId: "grand-line-rpg-dcda9",
  storageBucket: "grand-line-rpg-dcda9.appspot.com",
  messagingSenderId: "172042779786",
  appId: "1:172042779786:web:ecdff9eaf4fee36eca8173",
  databaseURL: "https://grand-line-rpg-dcda9-default-rtdb.firebaseio.com"
};

// ======================
// INIT
// ======================

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ======================
// UID
// ======================

const uid = localStorage.getItem("uid");

if (!uid) {
  window.location.href = "auth.html";
}

// ======================
// ESTADO
// ======================

let stats = null;
let points = null;

// ======================
// LOAD MODAL (BASE FUNCIONAL)
// ======================

fetch("perfil/distribuir.html")
  .then(res => res.text())
  .then((data) => {

    document.getElementById("modal-container").innerHTML = data;

    const modal = document.querySelector(".points-modal");
    const openBtn = document.getElementById("open-points");
    const closeBtn = document.querySelector(".close-btn");

    modal.style.display = "none";

    // ======================
    // ABRIR (FUNCIONANDO + CARREGA DADOS)
    // ======================

    openBtn.addEventListener("click", async () => {

      modal.style.display = "flex";

      await loadPlayer(); // 🔥 carrega dados ao abrir
    });

    // ======================
    // FECHAR
    // ======================

    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });

  });

// ======================
// CARREGAR DADOS FIREBASE
// ======================

async function loadPlayer() {

  const snap = await get(ref(db, `players/${uid}`));

  if (!snap.exists()) return;

  const player = snap.val();

  console.log("PLAYER:", player);

  // fallback seguro
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

  // ======================
  // INJETAR NO MODAL
  // ======================

  document.getElementById("modal-str").textContent = stats.str;
  document.getElementById("modal-res").textContent = stats.res;
  document.getElementById("modal-dex").textContent = stats.dex;
  document.getElementById("modal-agi").textContent = stats.agi;
  document.getElementById("modal-sta").textContent = stats.sta;
  document.getElementById("modal-hp").textContent = stats.hp;

  document.getElementById("available-points").textContent = points.available;
  document.getElementById("used-points").textContent = points.used;
}
