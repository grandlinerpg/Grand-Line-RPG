import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getDatabase,
  ref,
  onValue,
  off
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

const app = getApp();
const auth = getAuth(app);
const db = getDatabase(app);

let attrRef = null;
let attrListener = null;

fetch("perfil/atributos.html")
  .then(res => res.text())
  .then(html => {

    document.getElementById("atributos-container").innerHTML = html;

    setTimeout(() => {

      const modal = document.querySelector(".attributes-modal");
      const openBtn = document.getElementById("open-attributes");
      const closeBtn = document.querySelector(".attributes-close-btn");
      const distributeBtn = document.getElementById("open-distribute-points");

      if (!modal || !openBtn || !closeBtn) {
        console.error("attributes-modal não encontrada");
        return;
      }

      modal.style.display = "none";

      const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.innerText = value;
      };

      const ranks = {
        1: "INICIANTE",
        2: "APRENDIZ",
        3: "NOVATO",
        4: "INTERMEDIÁRIO",
        5: "VETERANO"
      };

      // ======================
      // ABRIR ATRIBUTOS (TEMPO REAL)
      // ======================
      openBtn.addEventListener("click", () => {

        const user = auth.currentUser;
        if (!user) return;

        attrRef = ref(db, `players/${user.uid}`);

        modal.style.display = "flex";

        // evita duplicar listener
        if (attrListener) off(attrRef);

        attrListener = onValue(attrRef, (snap) => {

          if (!snap.exists()) return;

          const data = snap.val();
          window.playerData = data;
          const stats = data.stats || {};

          set(
            "attr-rank",
            ranks[data.character?.rank] || data.character?.rank || "-"
          );

          set("attr-str", stats.str || 0);
          set("attr-res", stats.res || 0);
          set("attr-dex", stats.dex || 0);
          set("attr-agi", stats.agi || 0);
          set("attr-sta", stats.sta || 0);
          set("attr-hp", stats.hp || 0);

            // imagem
        const mainImg = document.getElementById("char-img");
        const attrImg = document.getElementById("attr-char-img");

        if(mainImg && attrImg){
            attrImg.src = mainImg.src;
        }

        if(attrImg){

          attrImg.style.cursor = "pointer";

          attrImg.onclick = ()=>{
  
              if(window.playerData){

                  abrirPersonagem(window.playerData);

                }

             };

          }

        });

      });

      // ======================
      // FECHAR
      // ======================
      closeBtn.addEventListener("click", () => {

        modal.style.display = "none";

        if (attrRef) {
          off(attrRef);
          attrListener = null;
        }

      });

      // ======================
      // ABRIR DISTRIBUIR
      // ======================
      if (distributeBtn) {

        distributeBtn.addEventListener("click", () => {

          const openPoints = document.getElementById("open-points");

          if (openPoints) {
            openPoints.click();
          }

        });

      }

    }, 0);

  });
