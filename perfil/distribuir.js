import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getDatabase,
  ref,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

// ======================
// FIREBASE (usa mesma instância do projeto)
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

    // ======================
    // ABRIR / FECHAR MODAL
    // ======================
    openBtn.addEventListener("click", async () => {

      modal.style.display = "flex";

      const user = auth.currentUser;
      if (!user) return;

      const snap = await get(ref(db, `players/${user.uid}`));
      if (!snap.exists()) return;

      const data = snap.val();

      // ======================
      // ESTRUTURA CORRETA
      // ======================
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
    });

    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });

  });
