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

fetch("./perfil/distribuir.html")
  .then(res => res.text())
  .then(async (html) => {

    document.getElementById("modal-container").innerHTML = html;

    const modal = document.querySelector(".points-modal");
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
    // ELEMENTOS
    // ======================

    const availableSpan = document.getElementById("available-points");
    const usedSpan = document.getElementById("used-points");

    const strValue = document.getElementById("modal-str");
    const resValue = document.getElementById("modal-res");
    const dexValue = document.getElementById("modal-dex");
    const agiValue = document.getElementById("modal-agi");
    const staValue = document.getElementById("modal-sta");
    const hpValue = document.getElementById("modal-hp");

    // ======================
    // UPDATE UI
    // ======================

    function updateUI() {
      strValue.textContent = stats.str;
      resValue.textContent = stats.res;
      dexValue.textContent = stats.dex;
      agiValue.textContent = stats.agi;
      staValue.textContent = stats.sta;
      hpValue.textContent = stats.hp;

      availableSpan.textContent = points.available;
      usedSpan.textContent = points.used;
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

    document.getElementById("plus-str").onclick = () => addPoint("str");
    document.getElementById("plus-res").onclick = () => addPoint("res");
    document.getElementById("plus-dex").onclick = () => addPoint("dex");
    document.getElementById("plus-agi").onclick = () => addPoint("agi");
    document.getElementById("plus-sta").onclick = () => addPoint("sta");
    document.getElementById("plus-hp").onclick = () => addPoint("hp");

    // ======================
    // ABRIR MODAL
    // ======================

    document.getElementById("open-points").onclick = () => {
      modal.style.display = "flex";
    };

    // ======================
    // FECHAR MODAL
    // ======================

    document.querySelector(".close-btn").onclick = () => {
      modal.style.display = "none";
    };

    // ======================
    // SALVAR NO FIREBASE
    // ======================

    document.querySelector(".save-btn").onclick = async () => {

      await update(ref(db, `players/${uid}`), {
        stats: stats,
        points: points
      });

      // atualiza perfil na tela
      document.getElementById("str").textContent = stats.str;
      document.getElementById("res").textContent = stats.res;
      document.getElementById("dex").textContent = stats.dex;
      document.getElementById("agi").textContent = stats.agi;
      document.getElementById("sta").textContent = stats.sta;
      document.getElementById("hp").textContent = stats.hp;

      modal.style.display = "none";
    };

  });
