import {
  ref,
  get,
  onValue,
  off
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const modalContainer = document.getElementById("atividades-container");

let atividadesRef = null;
let atividadesCallback = null;

async function loadAtividadesHTML() {
  if (!modalContainer) return;
  const response = await fetch("perfil/atividades.html");
  const html = await response.text();

  modalContainer.innerHTML = html;

  requestAnimationFrame(() => {
    initAtividades();
  });
}

function initAtividades() {
  const auth = window.auth;
  const db = window.db;

  const atividadesModal = document.getElementById("atividades-modal");
  const atividadesList = document.getElementById("atividades-list");
  const detalheModal = document.getElementById("atividade-detalhe-modal");

  const openBtn = document.getElementById("open-atividades");
  const closeBtn = document.getElementById("close-atividades");
  const closeDetalhe = document.getElementById("close-detalhe");
  const participarBtn = document.getElementById("participar-atividade");

  if (!openBtn || !atividadesModal || !atividadesList) {
    console.error("Modal de atividades não carregou corretamente.");
    return;
  }

  // ABRIR JANELA
  openBtn.onclick = async () => {
    atividadesModal.style.display = "flex";
    atividadesList.innerHTML = "Carregando atividades...";

    const user = await new Promise(resolve => {
      const unsub = auth.onAuthStateChanged(u => {
        unsub();
        resolve(u);
      });
    });

    if (!user) {
      atividadesList.innerHTML = "Usuário não autenticado.";
      return;
    }

    // 1. Buscar a facção atual do jogador
    const playerSnap = await get(ref(db, `players/${user.uid}/character/faction`));
    const faccaoNome = playerSnap.val();

    if (!faccaoNome) {
      atividadesList.innerHTML = "Você não pertence a nenhuma facção.";
      return;
    }

    if (atividadesRef && atividadesCallback) {
      off(atividadesRef, "value", atividadesCallback);
    }

    // 2. Apontar para as atividades da facção no Firebase
    atividadesRef = ref(db, `faccoes/${faccaoNome}/atividades`);

    atividadesCallback = onValue(atividadesRef, (snapshot) => {
      atividadesList.innerHTML = "";

      if (!snapshot.exists()) {
        atividadesList.innerHTML = "Nenhuma atividade disponível para esta facção no momento.";
        return;
      }

      const atividades = snapshot.val();

      for (const atividadeId in atividades) {
        const ativ = atividades[atividadeId];
        
        const nomeAtividade = ativ.nome || "Atividade Sem Nome";
        const emojiAtiv = ativ.emoji || "🎯";
        const descAtiv = ativ.description || "Sem descrição.";
        const limiteJogadores = ativ.jogadores?.limite || 1;

        const div = document.createElement("div");
        div.className = "inventory-item";

        div.innerHTML = `
          <div class="inventory-item-top">
            <span class="inventory-emoji">${emojiAtiv}</span>

            <div class="inventory-text">
              <div class="inventory-name-qty">
                <span class="inventory-name">${nomeAtividade}</span>
                <span class="inventory-qty" title="Limite de Jogadores">👥 ${limiteJogadores}</span>
              </div>
            </div>
          </div>
        `;

        // Ao clicar na atividade, abre o modal de detalhes
        div.onclick = () => {
          detalheModal.querySelector("#detalhe-emoji").innerText = emojiAtiv;
          detalheModal.querySelector("#detalhe-nome").innerText = nomeAtividade;
          detalheModal.querySelector("#detalhe-description").innerHTML = `
            <div>${descAtiv}</div>
            <div style="margin-top:12px; font-size:12px; color:#f6d365;">Limite de Participantes: ${limiteJogadores}</div>
          `;

          participarBtn.onclick = () => {
            alert(`Você se inscreveu na atividade: ${nomeAtividade}!`);
            detalheModal.style.display = "none";
          };

          detalheModal.style.display = "flex";
        };

        atividadesList.appendChild(div);
      }
    });
  };

  // BOTÕES DE FECHAR
  closeBtn.onclick = () => {
    atividadesModal.style.display = "none";
  };

  closeDetalhe.onclick = () => {
    detalheModal.style.display = "none";
  };
}

loadAtividadesHTML();
