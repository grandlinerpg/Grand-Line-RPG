import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getDatabase,
  ref,
  get,
  update
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

// ======================
// FIREBASE
// ======================
const app = getApp();
const auth = getAuth(app);
const db = getDatabase(app);

// ======================
// CARREGA MODAL
// ======================
fetch("perfil/distribuir.html")
  .then(res => res.text())
  .then(html => {

    document.getElementById("modal-container").innerHTML = html;

    const modal = document.querySelector(".points-modal");
    const openBtn = document.getElementById("open-points");
    const closeBtn = document.querySelector(".close-btn");

    modal.style.display = "none";

    let userRef = null;

    // ======================
    // FUNÇÃO UPGRADE
    // ======================
    async function upgradeStat(statName) {

      if (!userRef) return;

      const snap = await get(userRef);
      if (!snap.exists()) return;

      const data = snap.val();

      const stats = data.stats || {};
      const points = data.points || {};

      if ((points.available || 0) <= 0) return;

      const newStats = {
        ...stats,
        [statName]: (stats[statName] || 0) + 1
      };

      const newPoints = {
        available: (points.available || 0) - 1,
        used: (points.used || 0) + 1
      };

      await update(userRef, {
        stats: newStats,
        points: newPoints
      });

      // atualiza UI
      document.getElementById(`modal-${statName}`).innerText = newStats[statName];
      document.getElementById("available-points").innerText = newPoints.available;
      document.getElementById("used-points").innerText = newPoints.used;
    }

    // ======================
    // ABRIR MODAL
    // ======================
    openBtn.addEventListener("click", async () => {

      modal.style.display = "flex";

      const user = auth.currentUser;
      if (!user) return;

      userRef = ref(db, `players/${user.uid}`);

      const snap = await get(userRef);
      if (!snap.exists()) return;

      const data = snap.val();

      const stats = data.stats || {};
      const points = data.points || {};

      // ======================
      // ATRIBUTOS
      // ======================
      document.getElementById("modal-str").innerText = stats.str || 0;
      document.getElementById("modal-res").innerText = stats.res || 0;
      document.getElementById("modal-dex").innerText = stats.dex || 0;
      document.getElementById("modal-agi").innerText = stats.agi || 0;
      document.getElementById("modal-sta").innerText = stats.sta || 0;
      document.getElementById("modal-hp").innerText  = stats.hp  || 0;

      // ======================
      // PONTOS
      // ======================
      document.getElementById("available-points").innerText = points.available || 0;
      document.getElementById("used-points").innerText = points.used || 0;

      // ======================
      // BOTÕES DE UPGRADE
      // ======================
      document.getElementById("up-str").onclick = () => upgradeStat("str");
      document.getElementById("up-res").onclick = () => upgradeStat("res");
      document.getElementById("up-dex").onclick = () => upgradeStat("dex");
      document.getElementById("up-agi").onclick = () => upgradeStat("agi");
      document.getElementById("up-sta").onclick = () => upgradeStat("sta");
      document.getElementById("up-hp").onclick  = () => upgradeStat("hp");

    });

    // ======================
    // FECHAR MODAL
    // ======================
    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });

  });
