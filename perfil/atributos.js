import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getDatabase,
  ref,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

const app = getApp();
const auth = getAuth(app);
const db = getDatabase(app);

fetch("perfil/atributos.html")
  .then(res => res.text())
  .then(html => {

    document.getElementById("atributos-container").innerHTML = html;

    setTimeout(() => {

      const modal = document.querySelector(".attributes-modal");
      const openBtn = document.getElementById("open-attributes");
      const closeBtn = document.querySelector(".attributes-close-btn");
      const distributeBtn = document.getElementById("open-distribute-points");

      if (!modal || !openBtn || !closeBtn || !distributeBtn) {
        console.error("Modal de atributos não carregou corretamente");
        return;
      }

      modal.style.display = "none";

      // ======================
      // ABRIR
      // ======================
      openBtn.addEventListener("click", async () => {

        const user = auth.currentUser;
        if (!user) return;

        const userRef = ref(db, `players/${user.uid}`);

        const snap = await get(userRef);
        if (!snap.exists()) return;

        const data = snap.val();
        const stats = data.stats || {};

        const set = (id, val) => {
          const el = document.getElementById(id);
          if (el) el.innerText = val;
        };

        set("attr-str", stats.str || 0);
        set("attr-res", stats.res || 0);
        set("attr-dex", stats.dex || 0);
        set("attr-agi", stats.agi || 0);
        set("attr-sta", stats.sta || 0);
        set("attr-hp", stats.hp || 0);

        modal.style.display = "flex";

      });

      // ======================
      // FECHAR
      // ======================
      closeBtn.addEventListener("click", () => {
        modal.style.display = "none";
      });

      // ======================
      // ABRIR DISTRIBUIÇÃO
      // ======================
      distributeBtn.addEventListener("click", () => {

        modal.style.display = "none";

        const distribuirBtn =
          document.getElementById("open-points");

        if (distribuirBtn) {
          distribuirBtn.click();
        }

      });

    }, 0);

  });
