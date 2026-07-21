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
// BUFFER LOCAL
// ======================
let tempStats = {};
let tempPoints = {};
let originalStats = {};
let originalPoints = {};

const LIMITES_RANK = {
  1: 20,
  2: 40,
  3: 60,
  4: 80,
  5: 100
};

let limiteAtributo = 20;

fetch("perfil/distribuir.html")
  .then(res => res.text())
  .then(html => {

    document.getElementById("distribuir-container").innerHTML = html;

    // ⚠️ garante DOM pronto após inject
    setTimeout(() => {

      const modal = document.querySelector(".points-modal");
      const openBtn = document.getElementById("open-points");
      const closeBtn = document.querySelector(".distribuir-close-btn");
      const confirmBtn = document.querySelector(".points-modal .save-btn");

      if (!modal || !openBtn || !closeBtn || !confirmBtn) {
        console.error("Modal não carregou corretamente");
        return;
      }

      modal.style.display = "none";

      // ======================
      // ABRIR MODAL
      // ======================
      openBtn.addEventListener("click", async () => {

        const user = auth.currentUser;
        if (!user) return;

        userRef = ref(db, `players/${user.uid}`);

        const snap = await get(userRef);
        if (!snap.exists()) return;

        const data = snap.val();

        const rank = data.character?.rank || 1;

        limiteAtributo = LIMITES_RANK[rank] || 20;

        originalStats = structuredClone(data.stats || {});
        originalPoints = structuredClone(data.points || {});

        tempStats = structuredClone(originalStats);
        tempPoints = structuredClone(originalPoints);

        modal.style.display = "flex";

        const set = (id, val) => {
          const el = document.getElementById(id);
          if (el) el.innerText = val;
        };

        set("modal-str", `${tempStats.str || 0}/${limiteAtributo}`);
        set("modal-res", `${tempStats.res || 0}/${limiteAtributo}`);
        set("modal-dex", `${tempStats.dex || 0}/${limiteAtributo}`);
        set("modal-agi", `${tempStats.agi || 0}/${limiteAtributo}`);
        set("modal-sta", `${tempStats.sta || 0}/${limiteAtributo}`);
        set("modal-hp", `${tempStats.hp || 0}/${limiteAtributo}`);

        set("available-points", tempPoints.available || 0);
        set("used-points", tempPoints.used || 0);

      });

      // ======================
      // FECHAR = SÓ DESCARTA (NÃO SALVA)
      // ======================
      closeBtn.addEventListener("click", () => {

         // fecha distribuir
        modal.style.display = "none";

        // desfaz alterações não confirmadas
        tempStats = structuredClone(originalStats);
        tempPoints = structuredClone(originalPoints);

        // reabre atributos
       const attrModal = document.querySelector(".attributes-modal");

        if (attrModal) {
          attrModal.style.display = "flex";
        }

      });

      // ======================
      // + ATRIBUTOS
      // ======================
      document.addEventListener("click", (e) => {

        const btn = e.target.closest(".plus-btn");
        if (!btn) return;

        if ((tempPoints.available || 0) <= 0) return;

        const id = btn.id;

        const add = (stat) => {

          if ((tempStats[stat] || 0) >= limiteAtributo) {
            alert(`Limite desse atributo atingido (${limiteAtributo})`);
            return;
          }

          tempStats[stat] = (tempStats[stat] || 0) + 1;
          tempPoints.available -= 1;
          tempPoints.used += 1;

          const statEl = document.getElementById(`modal-${stat}`);
          if (statEl) {
            statEl.innerText = `${tempStats[stat]}/${limiteAtributo}`;
          }

          const av = document.getElementById("available-points");
          const us = document.getElementById("used-points");

          if (av) av.innerText = tempPoints.available;
          if (us) us.innerText = tempPoints.used;
        };

        if (id === "up-str") add("str");
        if (id === "up-res") add("res");
        if (id === "up-dex") add("dex");
        if (id === "up-agi") add("agi");
        if (id === "up-sta") add("sta");
        if (id === "up-hp") add("hp");

      });

      // ======================
      // CONFIRMAR (SALVA DE VERDADE)
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

    }, 0);

  });
