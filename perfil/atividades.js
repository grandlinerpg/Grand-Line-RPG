import {
  ref,
  get,
  onValue,
  off
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const modalContainer = document.getElementById("atividades-container");

let atividadesRef = null;
let atividadesCallback = null;

let playerAtivRef = null;
let playerAtivCallback = null;

let playerSaldoRef = null;
let playerSaldoCallback = null;

// Normaliza chaves (ex: "Revolução" -> "revolucao") para bater com o nó do player
function normalizarChave(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

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

  const expSpan = document.getElementById("atividades-exp");
  const saldoSpan = document.getElementById("atividades-saldo");

  const openBtn = document.getElementById("open-atividades");
  const closeBtn = document.getElementById("close-atividades");
  const closeDetalhe = document.getElementById("close-detalhe");
  const participarBtn = document.getElementById("participar-atividade");

  if (!openBtn || !atividadesModal || !atividadesList) {
    console.error("Modal de atividades não carregou corretamente.");
    return;
  }

  let faccaoAtividadesCache = {};
  let playerAtividadesCache = {};

  // Função que renderiza a lista cruzando os dados da facção com o progresso do player
  function renderizarListaAtividades() {
    atividadesList.innerHTML = "";

    const keys = Object.keys(faccaoAtividadesCache);
    if (keys.length === 0) {
      atividadesList.innerHTML = "Nenhuma atividade disponível para esta facção no momento.";
      return;
    }

    for (const atividadeId of keys) {
      const ativ = faccaoAtividadesCache[atividadeId];

      const nomeAtividade = ativ.nome || "Atividade Sem Nome";
      const emojiAtiv = ativ.emoji || "🎯";
      const descAtiv = ativ.description || "Sem descrição.";
      
      // Limite definido no nó da atividade (com fallback caso ainda esteja dentro de jogadores)
      const limiteAtividade = ativ.limite ?? ativ.jogadores?.limite ?? 0;

      // Busca quantas vezes o jogador já fez essa atividade
      const chaveNormalizadaId = normalizarChave(atividadeId);
      const chaveNormalizadaNome = normalizarChave(nomeAtividade);

      const feitasJogador =
        playerAtividadesCache[atividadeId] ??
        playerAtividadesCache[chaveNormalizadaId] ??
        playerAtividadesCache[chaveNormalizadaNome] ??
        0;

      const div = document.createElement("div");
      div.className = "inventory-item";

      div.innerHTML = `
        <div class="inventory-item-top">
          <span class="inventory-emoji">${emojiAtiv}</span>

          <div class="inventory-text">
            <div class="inventory-name-qty">
              <span class="inventory-name">${nomeAtividade}</span>
              <span class="inventory-qty" title="Realizadas / Limite">${feitasJogador}/${limiteAtividade}</span>
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
          <div style="margin-top:12px; font-size:12px; color:#f6d365;">
            Progresso Semanal/Diário: ${feitasJogador}/${limiteAtividade}
          </div>
        `;

        // Desabilita visualmente ou avisa caso já tenha atingido o limite
        if (limiteAtividade > 0 && feitasJogador >= limiteAtividade) {
          participarBtn.innerText = "LIMITE ATINGIDO";
          participarBtn.style.opacity = "0.6";
          participarBtn.onclick = () => {
            alert(`Você já atingiu o limite (${feitasJogador}/${limiteAtividade}) para ${nomeAtividade}!`);
          };
        } else {
          participarBtn.innerText = "PARTICIPAR";
          participarBtn.style.opacity = "1";
          participarBtn.onclick = () => {
            alert(`Você se inscreveu na atividade: ${nomeAtividade}!`);
            detalheModal.style.display = "none";
          };
        }

        detalheModal.style.display = "flex";
      };

      atividadesList.appendChild(div);
    }
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

    // Limpa listeners anteriores caso existam
    if (atividadesRef && atividadesCallback) off(atividadesRef, "value", atividadesCallback);
    if (playerAtivRef && playerAtivCallback) off(playerAtivRef, "value", playerAtivCallback);
    if (playerSaldoRef && playerSaldoCallback) off(playerSaldoRef, "value", playerSaldoCallback);

    // 1. Escutar dados de atividades do jogador (teto de EXP e contadores)
    playerAtivRef = ref(db, `players/${user.uid}/atividades`);
    playerAtivCallback = onValue(playerAtivRef, (snap) => {
      playerAtividadesCache = snap.exists() ? snap.val() : {};

      const tetoAtual = Number(playerAtividadesCache.teto) || 0;
      if (expSpan) {
        expSpan.innerText = `${tetoAtual.toLocaleString("pt-BR")} / 1.000`;
      }

      // Re-renderiza a lista se as atividades da facção já tiverem carregado
      if (Object.keys(faccaoAtividadesCache).length > 0) {
        renderizarListaAtividades();
      }
    });

    // 2. Escutar saldo do jogador (money / berrys)
    playerSaldoRef = ref(db, `players/${user.uid}/character`);
    playerSaldoCallback = onValue(playerSaldoRef, (snap) => {
      if (snap.exists() && saldoSpan) {
        const charData = snap.val();
        const saldo = Number(charData.money ?? charData.berrys ?? charData.saldo ?? 0);
        saldoSpan.innerText = `฿ ${saldo.toLocaleString("pt-BR")}`;
      }
    });

    // 3. Buscar a facção atual do jogador
    const playerSnap = await get(ref(db, `players/${user.uid}/character/faction`));
    const faccaoNome = playerSnap.val();

    if (!faccaoNome) {
      atividadesList.innerHTML = "Você não pertence a nenhuma facção.";
      return;
    }

    // 4. Apontar para as atividades da facção no Firebase
    atividadesRef = ref(db, `faccoes/${faccaoNome}/atividades`);

    atividadesCallback = onValue(atividadesRef, (snapshot) => {
      if (!snapshot.exists()) {
        faccaoAtividadesCache = {};
        atividadesList.innerHTML = "Nenhuma atividade disponível para esta facção no momento.";
        return;
      }

      faccaoAtividadesCache = snapshot.val();
      renderizarListaAtividades();
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
