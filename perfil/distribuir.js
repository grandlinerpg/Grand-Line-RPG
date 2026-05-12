import {
  getDatabase,
  ref,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

fetch("perfil/distribuir.html")
  .then(res => res.text())
  .then(data => {

    document.getElementById("modal-container").innerHTML = data;

    const modal = document.querySelector(".points-modal");
    modal.style.display = "none";

    const openBtn = document.getElementById("open-points");
    const closeBtn = document.querySelector(".close-btn");

    // ======================
    // CARREGAR DADOS FIREBASE
    // ======================
    async function loadStats() {

      const user = window.auth?.currentUser;
      const db = window.db;

      if (!user || !db) return;

      const snap = await get(ref(db, "players/" + user.uid));

      if (!snap.exists()) return;

      const data = snap.val();
      const stats = data.stats || {};

      // ======================
      // ATRIBUTOS
      // ======================
      document.getElementById("modal-str").textContent = stats.str || 0;
      document.getElementById("modal-res").textContent = stats.res || 0;
      document.getElementById("modal-dex").textContent = stats.dex || 0;
      document.getElementById("modal-agi").textContent = stats.agi || 0;
      document.getElementById("modal-sta").textContent = stats.sta || 0;
      document.getElementById("modal-hp").textContent  = stats.hp || 0;

      // ======================
      // PONTOS
      // ======================
      document.getElementById("available-points").textContent =
        data.info?.pointsAvailable || 0;

      document.getElementById("used-points").textContent =
        data.info?.pointsUsed || 0;
    }

    // ======================
    // ABRIR MODAL
    // ======================
    openBtn.addEventListener("click", async () => {

      modal.style.display = "flex";

      await loadStats(); // 🔥 busca Firebase ao abrir

    });

    // ======================
    // FECHAR MODAL
    // ======================
    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });

  });
