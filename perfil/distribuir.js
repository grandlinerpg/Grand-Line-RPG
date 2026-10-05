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

// ID exato do item no Firebase
const ITEM_REGRESSAO_ID = "pedraregressao";

let userRef = null;

// ======================
// BUFFER LOCAL
// ======================
let tempStats = {};
let tempPoints = {};
let originalStats = {};
let originalPoints = {};
let pedrasDisponiveis = 0;
let pedrasUsadas = 0;
let playerLevel = 1;

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

        // Busca dados do jogador e da pedra de regressão no inventário
        const [snap, invSnap] = await Promise.all([
          get(userRef),
          get(ref(db, `players/${user.uid}/inventory/${ITEM_REGRESSAO_ID}`))
        ]);

        if (!snap.exists()) return;

        const data = snap.val();
        const rank = data.character?.rank || 1;

        // Pega o nível do personagem (suporta data.info.level ou data.character.info.level)
        playerLevel = Number(data.info?.level || data.character?.info?.level || 1);

        limiteAtributo = LIMITES_RANK[rank] || 20;

        originalStats = structuredClone(data.stats || {});
        originalPoints = structuredClone(data.points || {});

        tempStats = structuredClone(originalStats);
        tempPoints = structuredClone(originalPoints);

        // Quantidade de pedras no inventário
        pedrasDisponiveis = invSnap.exists() ? Number(invSnap.val()) || 0 : 0;
        pedrasUsadas = 0;

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
        pedrasUsadas = 0;

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

        const btnPlus = e.target.closest(".plus-btn");
        const btnMinus = e.target.closest(".minus-btn");

        // 🔥 AUMENTAR PONTO
        if (btnPlus) {
          if ((tempPoints.available || 0) <= 0) return;

          const id = btnPlus.id;

          const add = (stat) => {
            if ((tempStats[stat] || 0) >= limiteAtributo) {
              alert(`Limite desse atributo atingido (${limiteAtributo})`);
              return;
            }

            tempStats[stat] = (tempStats[stat] || 0) + 1;
            tempPoints.available -= 1;
            tempPoints.used += 1;

            const statEl = document.getElementById(`modal-${stat}`);
            if (statEl) statEl.innerText = `${tempStats[stat]}/${limiteAtributo}`;

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
        }

        // 🔥 DIMINUIR PONTO (UTILIZA PEDRA DE REGRESSÃO CASO REDUZA PONTOS ORIGINAIS)
        if (btnMinus) {
          const id = btnMinus.id;

          const remove = (stat) => {
            const valorAtual = tempStats[stat] || 0;
            const valorOriginal = originalStats[stat] || 0;
            const limiteMinimo = Math.floor(playerLevel / 2);

            if (valorAtual <= 0) return;

            // Requisito: Não permite diminuir abaixo de metade do level (arredondada para baixo)
            if (valorAtual <= limiteMinimo) {
              alert(`Não é possível reduzir o atributo para menos de ${limiteMinimo} (metade do seu nível).`);
              return;
            }

            // Se for tentar reduzir um ponto que já estava salvo no banco, precisa da pedra
            if (valorAtual <= valorOriginal) {
              const pedrasRestantes = pedrasDisponiveis - pedrasUsadas;

              if (pedrasRestantes <= 0) {
                alert("Você precisa de 1 Pedra de Regressão para reduzir pontos já distribuídos!");
                return;
              }

              pedrasUsadas += 1;
            }

            tempStats[stat] = valorAtual - 1;
            tempPoints.available = (tempPoints.available || 0) + 1;
            tempPoints.used = Math.max(0, (tempPoints.used || 0) - 1);

            const statEl = document.getElementById(`modal-${stat}`);
            if (statEl) statEl.innerText = `${tempStats[stat]}/${limiteAtributo}`;

            const av = document.getElementById("available-points");
            const us = document.getElementById("used-points");

            if (av) av.innerText = tempPoints.available;
            if (us) us.innerText = tempPoints.used;
          };

          if (id === "down-str") remove("str");
          if (id === "down-res") remove("res");
          if (id === "down-dex") remove("dex");
          if (id === "down-agi") remove("agi");
          if (id === "down-sta") remove("sta");
          if (id === "down-hp") remove("hp");
        }

      });

      // ======================
      // CONFIRMAR (SALVA DE VERDADE)
      // ======================
      confirmBtn.addEventListener("click", async () => {

        const user = auth.currentUser;
        if (!user || !userRef) return;

        const updates = {};
        updates[`players/${user.uid}/stats`] = tempStats;
        updates[`players/${user.uid}/points`] = tempPoints;

        // Se gastou Pedras de Regressão, atualiza a quantidade no inventário
        if (pedrasUsadas > 0) {
          const novaQtdPedras = pedrasDisponiveis - pedrasUsadas;

          if (novaQtdPedras > 0) {
            updates[`players/${user.uid}/inventory/${ITEM_REGRESSAO_ID}`] = novaQtdPedras;
          } else {
            // Se zerar as pedras, remove a chave do inventário
            updates[`players/${user.uid}/inventory/${ITEM_REGRESSAO_ID}`] = null;
          }
        }

        await update(ref(db), updates);

        pedrasDisponiveis -= pedrasUsadas;
        pedrasUsadas = 0;

        modal.style.display = "none";

      });

    }, 0);

  });
