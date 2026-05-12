
// ======================
// FIREBASE
// ======================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  get,
  update
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
// LOAD MODAL HTML
// ======================

fetch("perfil/distribuir.html")
  .then(res => res.text())
  .then(data => {

    document.getElementById("modal-container").innerHTML = data;

    const modal = document.querySelector(".points-modal");

    modal.style.display = "none";

    const openBtn = document.getElementById("open-points");
    const closeBtn = document.querySelector(".close-btn");

    // ======================
    // ESTADO LOCAL
    // ======================

    let stats = {};
    let points = {};

    // ======================
    // CARREGAR DO FIREBASE
    // ======================

    async function loadPlayer() {

      const snap = await get(ref(db, `players/${uid}`));

      if (!snap.exists()) return;

      const player = snap.val();

      stats = {
        str: player.stats?.str || 1,
        res: player.stats?.res || 1,
        dex: player.stats?.dex || 1,
        agi: player.stats?.agi || 1,
        sta: player.stats?.sta || 1,
        hp: player.stats?.hp || 1
      };

      points = {
        available: player.points?.available || 0,
        used: player.points?.used || 0
      };

      updateUI();
    }

    // ======================
    // UI UPDATE
    // ======================

    function updateUI() {

      document.getElementById("modal-str").textContent = stats.str;
      document.getElementById("modal-res").textContent = stats.res;
      document.getElementById("modal-dex").textContent = stats.dex;
      document.getElementById("modal-agi").textContent = stats.agi;
      document.getElementById("modal-sta").textContent = stats.sta;
      document.getElementById("modal-hp").textContent = stats.hp;

      document.getElementById("available-points").textContent = points.available;
      document.getElementById("used-points").textContent = points.used;
    }

    // ======================
    // ADD POINT
    // ======================

    function addPoint(stat) {

      if (points.available <= 0) return;

      stats[stat]++;
      points.available--;
      points.used++;

      updateUI();
    }

    // ======================
    // BOTÕES +
    // ======================

    document.getElementById("plus-str").onclick = () => addPoint("str");
    document.getElementById("plus-res").onclick = () => addPoint("res");
    document.getElementById("plus-dex").onclick = () => addPoint("dex");
    document.getElementById("plus-agi").onclick = () => addPoint("agi");
    document.getElementById("plus-sta").onclick = () => addPoint("sta");
    document.getElementById("plus-hp").onclick = () => addPoint("hp");

    // ======================
    // ABRIR MODAL
    // ======================

    openBtn.addEventListener("click", async () => {

      modal.style.display = "flex";

      await loadPlayer(); // 🔥 carrega dados ao abrir

    });

    // ======================
    // FECHAR MODAL
    // ======================

    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });

    // ======================
    // SALVAR NO FIREBASE
    // ======================

    document.querySelector(".save-btn").addEventListener("click", async () => {

      await update(ref(db, `players/${uid}`), {
        stats,
        points
      });

      // atualiza perfil principal
      document.getElementById("str").textContent = stats.str;
      document.getElementById("res").textContent = stats.res;
      document.getElementById("dex").textContent = stats.dex;
      document.getElementById("agi").textContent = stats.agi;
      document.getElementById("sta").textContent = stats.sta;
      document.getElementById("hp").textContent = stats.hp;

      modal.style.display = "none";
    });

  });
