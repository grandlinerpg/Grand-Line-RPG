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

// 🔥 Controle do Item de Regressão
let originalPedraRegressao = 0;
let tempPedraRegressao = 0;
let nomeItemRegressao = "Pedra de Regressão"; // Nome padrão até buscar no Firebase

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

        // Busca dados do jogador e da lista global de itens
        const [snap, itensSnap] = await Promise.all([
          get(userRef),
          get(ref(db, "itens"))
        ]);

        if (!snap.exists()) return;

        const data = snap.val();

        // 🔥 Busca o nome real do item "pedraregressao" no banco de dados
        if (itensSnap.exists()) {
          const categorias = itensSnap.val();
          for (const cat in categorias) {
            if (categorias[cat]?.pedraregressao?.nome) {
              nomeItemRegressao = categorias[cat].pedraregressao.nome;
              break;
            }
          }
        }

        const rank = data.character?.rank || 1;

        limiteAtributo = LIMITES_RANK[rank] || 20;

        originalStats = structuredClone(data.stats || {});
        originalPoints = structuredClone(data.points || {});
        
        // 🔥 Lê a quantidade atual de "pedraregressao" no inventário do jogador
        originalPedraRegressao = Number(data.inventory?.pedraregressao || 0);

        tempStats = structuredClone(originalStats);
        tempPoints = structuredClone(originalPoints);
        tempPedraRegressao = originalPedraRegressao;

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
        tempPedraRegressao = originalPedraRegressao;

        // reabre atributos
        const attrModal = document.querySelector(".attributes-modal");

        if (attrModal) {
          attrModal.style.display = "flex";
        }

      });

      // ======================
      // EVENTOS DE CLIQUE (+ E -)
      // ======================
      document.addEventListener("click", (e) => {

        // --- BOTÃO DE ADICIONAR (+) ---
        const plusBtn = e.target.closest(".plus-btn");
        if (plusBtn) {
          if ((tempPoints.available || 0) <= 0) return;

          const id = plusBtn.id;

          const add = (stat) => {
            if ((tempStats[stat] || 0) >= limiteAtributo) {
              alert(`Limite desse atributo atingido (${limiteAtributo})`);
              return;
            }

            tempStats[stat] = (tempStats[stat] || 0) + 1;
            tempPoints.available -= 1;
            tempPoints.used += 1;

            updateStatUI(stat);
          };

          if (id === "up-str") add("str");
          if (id === "up-res") add("res");
          if (id === "up-dex") add("dex");
          if (id === "up-agi") add("agi");
          if (id === "up-sta") add("sta");
          if (id === "up-hp") add("hp");
          return;
        }

        // --- BOTÃO DE SUBTRAIR (-) ---
        const minusBtn = e.target.closest(".minus-btn");
        if (minusBtn) {
          const id = minusBtn.id;

          const remove = (stat) => {
            // Não permite diminuir abaixo de 0
            if ((tempStats[stat] || 0) <= 0) {
              alert("O atributo não pode ser menor que 0.");
              return;
            }

            // Verifica se possui o item no inventário temporário
            if (tempPedraRegressao <= 0) {
              alert(`Você precisa do item "${nomeItemRegressao}" para diminuir pontos de atributo.`);
              return;
            }

            // Consome 1 pedra e devolve o ponto
            tempPedraRegressao -= 1;
            tempStats[stat] -= 1;
            tempPoints.available += 1;
            tempPoints.used = Math.max(0, (tempPoints.used || 0) - 1);

            updateStatUI(stat);
          };

          if (id === "down-str") remove("str");
          if (id === "down-res") remove("res");
          if (id === "down-dex") remove("dex");
          if (id === "down-agi") remove("agi");
          if (id === "down-sta") remove("sta");
          if (id === "down-hp") remove("hp");
        }

      });

      // Função auxiliar para atualizar a interface dos atributos
      function updateStatUI(stat) {
        const statEl = document.getElementById(`modal-${stat}`);
        if (statEl) {
          statEl.innerText = `${tempStats[stat]}/${limiteAtributo}`;
        }

        const av = document.getElementById("available-points");
        const us = document.getElementById("used-points");

        if (av) av.innerText = tempPoints.available;
        if (us) us.innerText = tempPoints.used;
      }

      // ======================
      // CONFIRMAR (SALVA DE VERDADE)
      // ======================
      confirmBtn.addEventListener("click", async () => {

        const user = auth.currentUser;
        if (!user || !userRef) return;

        const updates = {
          stats: tempStats,
          points: tempPoints
        };

        // 🔥 Se houve consumo de pedraregressao, atualiza a chave no inventário
        if (tempPedraRegressao !== originalPedraRegressao) {
          if (tempPedraRegressao <= 0) {
            // Remove o item se zerar
            updates["inventory/pedraregressao"] = null;
          } else {
            updates["inventory/pedraregressao"] = tempPedraRegressao;
          }
        }

        await update(userRef, updates);

        modal.style.display = "none";

      });

    }, 0);

  });
