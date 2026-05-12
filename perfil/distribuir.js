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
// LOAD MODAL
// ======================

fetch("perfil/distribuir.html")
  .then(res => res.text())
  .then(async (html) => {

    document.getElementById("modal-container").innerHTML = html;

    const modal = document.querySelector(".points-modal");

    if (!modal) {
      console.error("Modal não encontrado");
      return;
    }

    modal.style.display = "none";

    // ======================
    // FIREBASE DATA
    // ======================

    const snap = await get(ref(db, `players/${uid}`));

    if (!snap.exists()) return;

    const player = snap.val();

    let stats = {
      str: player.stats?.str || 1,
      res: player.stats?.res || 1,
      dex: player.stats?.dex || 1,
      agi: player.stats?.agi || 1,
      sta: player.stats?.sta || 1,
      hp: player.stats?.hp || 1
    };

    let points = {
      available: player.points?.available || 0,
      used: player.points?.used || 0
    };

    // ======================
    // ELEMENTOS UI
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

    updateUI();

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

    document.getElementById("plus-str")?.addEventListener("click", () => addPoint("str"));
    document.getElementById("plus-res")?.addEventListener("click", () => addPoint("res"));
    document.getElementById("plus-dex")?.addEventListener("click", () => addPoint("dex"));
    document.getElementById("plus-agi")?.addEventListener("click", () => addPoint("agi"));
    document.getElementById("plus-sta")?.addEventListener("click", () => addPoint("sta"));
    document.getElementById("plus-hp")?.addEventListener("click", () => addPoint("hp"));

    // ======================
    // ABRIR MODAL (CORRIGIDO)
    // ======================

    const openBtn = document.getElementById("open-points");

    if (openBtn) {
      openBtn.addEventListener("click", () => {
        modal.style.display = "flex";
      });
    } else {
      console.error("Botão open-points não encontrado");
    }

    // ======================
    // FECHAR MODAL
    // ======================

    const closeBtn = document.querySelector(".close-btn");

    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        modal.style.display = "none";
      });
    }

    // ======================
    // SALVAR
    // ======================

    const saveBtn = document.querySelector(".save-btn");

    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {

        await update(ref(db, `players/${uid}`), {
          stats,
          points
        });

        modal.style.display = "none";
      });
    }

  });
