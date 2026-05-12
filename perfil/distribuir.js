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

    if (!modal || !openBtn || !closeBtn) {
      console.error("Modal não carregou corretamente");
      return;
    }

    modal.style.display = "none";

    let userRef = null;

    // ======================
    // FUNÇÃO UPGRADE
    // ======================
    async function upgradeStat(statName) {

      const user = auth.currentUser;
      if (!user || !userRef) return;

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

      // ======================
      // UI UPDATE
      // ======================
      const statEl = document.getElementById(`modal-${statName}`);
      if (statEl) statEl.innerText = newStats[statName];

      const av = document.getElementById("available-points");
      const us = document.getElementById("used-points");

      if (av) av.innerText = newPoints.available;
      if (us) us.innerText = newPoints.used;
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
      const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.innerText = value;
      };

      set("modal-str", stats.str || 0);
      set("modal-res", stats.res || 0);
      set("modal-dex", stats.dex || 0);
      set("modal-agi", stats.agi || 0);
      set("modal-sta", stats.sta || 0);
      set("modal-hp", stats.hp || 0);

      // ======================
      // PONTOS
      // ======================
      set("available-points", points.available || 0);
      set("used-points", points.used || 0);

      // ======================
      // BOTÕES (AGORA SEM BUG)
      // ======================
      const bind = (id, stat) => {
        const btn = document.getElementById(id);
        if (btn) btn.onclick = () => upgradeStat(stat);
      };

      bind("up-str", "str");
      bind("up-res", "res");
      bind("up-dex", "dex");
      bind("up-agi", "agi");
      bind("up-sta", "sta");
      bind("up-hp", "hp");

    });

    // ======================
    // FECHAR MODAL
    // ======================
    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });

  });
