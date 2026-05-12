import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getDatabase,
  ref,
  get,
  update
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

const app = getApp();
const auth = getAuth(app);
const db = getDatabase(app);

let userRef = null;
let cachedData = null;

// ======================
// FUNÇÃO UPGRADE (GLOBAL)
// ======================
async function upgradeStat(statName) {

  const user = auth.currentUser;
  if (!user) return;

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

  document.getElementById(`modal-${statName}`).innerText = newStats[statName];
  document.getElementById("available-points").innerText = newPoints.available;
  document.getElementById("used-points").innerText = newPoints.used;
}

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

      cachedData = snap.val();

      const stats = cachedData.stats || {};
      const points = cachedData.points || {};

      document.getElementById("modal-str").innerText = stats.str || 0;
      document.getElementById("modal-res").innerText = stats.res || 0;
      document.getElementById("modal-dex").innerText = stats.dex || 0;
      document.getElementById("modal-agi").innerText = stats.agi || 0;
      document.getElementById("modal-sta").innerText = stats.sta || 0;
      document.getElementById("modal-hp").innerText  = stats.hp  || 0;

      document.getElementById("available-points").innerText = points.available || 0;
      document.getElementById("used-points").innerText = points.used || 0;

    });

    // ======================
    // FECHAR MODAL
    // ======================
    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });

    // ======================
    // 🔥 EVENT DELEGATION (AQUI RESOLVE 100%)
    // ======================
    document.addEventListener("click", (e) => {

      if (!e.target.classList.contains("plus-btn")) return;

      const id = e.target.id;

      if (id === "up-str") upgradeStat("str");
      if (id === "up-res") upgradeStat("res");
      if (id === "up-dex") upgradeStat("dex");
      if (id === "up-agi") upgradeStat("agi");
      if (id === "up-sta") upgradeStat("sta");
      if (id === "up-hp") upgradeStat("hp");

    });

  });
