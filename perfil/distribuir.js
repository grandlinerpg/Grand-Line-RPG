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

// ======================
// BUFFER LOCAL (EDIÇÃO)
// ======================
let tempStats = {};
let tempPoints = {};
let originalStats = {};
let originalPoints = {};

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
    const confirmBtn = document.querySelector(".save-btn");

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

      const data = snap.val();

      // salva estado original (caso feche sem salvar)
      originalStats = structuredClone(data.stats || {});
      originalPoints = structuredClone(data.points || {});

      // buffer editável
      tempStats = structuredClone(originalStats);
      tempPoints = structuredClone(originalPoints);

      const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
      };

      set("modal-str", tempStats.str || 0);
      set("modal-res", tempStats.res || 0);
      set("modal-dex", tempStats.dex || 0);
      set("modal-agi", tempStats.agi || 0);
      set("modal-sta", tempStats.sta || 0);
      set("modal-hp", tempStats.hp || 0);

      set("available-points", tempPoints.available || 0);
      set("used-points", tempPoints.used || 0);

    });

    // ======================
    // FECHAR MODAL = DESCARTA
    // ======================
    closeBtn.addEventListener("click", () => {

      modal.style.display = "none";

      // volta tudo pro original (descarta mudanças)
      tempStats = structuredClone(originalStats);
      tempPoints = structuredClone(originalPoints);
    });

    // ======================
    // + ATRIBUTOS (SÓ LOCAL)
    // ======================
    document.addEventListener("click", (e) => {

      if (!e.target.classList.contains("plus-btn")) return;

      if ((tempPoints.available || 0) <= 0) return;

      const id = e.target.id;

      const add = (stat) => {
        tempStats[stat] = (tempStats[stat] || 0) + 1;
        tempPoints.available -= 1;
        tempPoints.used += 1;

        document.getElementById(`modal-${stat}`).innerText = tempStats[stat];
        document.getElementById("available-points").innerText = tempPoints.available;
        document.getElementById("used-points").innerText = tempPoints.used;
      };

      if (id === "up-str") add("str");
      if (id === "up-res") add("res");
      if (id === "up-dex") add("dex");
      if (id === "up-agi") add("agi");
      if (id === "up-sta") add("sta");
      if (id === "up-hp") add("hp");

    });

    // ======================
    // CONFIRMAR (SALVA NO FIREBASE)
    // ======================
    confirmBtn.addEventListener("click", async () => {

      const user = auth.currentUser;
      if (!user || !userRef) return;

      await update(userRef, {
        stats: tempStats,
        points: tempPoints
      });

      modal.style.display = "none";
    });

  });
