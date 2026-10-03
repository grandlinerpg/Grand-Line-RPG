import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, update, get, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ======================
// FIREBASE CONFIG
// ======================
const firebaseConfig = {
  apiKey: "AIzaSyC4kgy_L79WYFqr9XZhoDuZBfqG4AGTVUQ",
  authDomain: "grand-line-rpg-dcda9.firebaseapp.com",
  projectId: "grand-line-rpg-dcda9",
  storageBucket: "grand-line-rpg-dcda9.appspot.com",
  messagingSenderId: "172042779786",
  appId: "1:172042779786:web:ecdff9eaf4fee36eca8173",
  databaseURL: "https://grand-line-rpg-dcda9-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// ======================
// ELEMENTOS
// ======================
const selectPersonagem = document.getElementById("personagem");
const selectEstilo = document.getElementById("estilo");
const grupoEstilo = document.getElementById("grupo-estilo");
const img = document.getElementById("preview-img");

// Copia as opções do HTML no carregamento para poder filtrar dinamicamente
const todasOpcoes = Array.from(selectPersonagem.options).map(opt => ({
  value: opt.value,
  text: opt.text
}));

// ======================
// AUXILIARES
// ======================
function gerarUrl(nome) {
  if (!nome || nome === "Sem Personagem") return "";
  return `https://res.cloudinary.com/djh45admn/image/upload/v1778334616/${
    nome
      .toLowerCase()
      .replaceAll(" ", "-")
      .replaceAll(".", "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
  }.png`;
}

function atualizarImagem() {
  if (selectPersonagem.value && selectPersonagem.value !== "Sem Personagem") {
    img.src = gerarUrl(selectPersonagem.value);
  } else {
    img.src = "";
  }
}

function controlarEstilo(valor) {
  const v = (valor || "").trim();
  if (!v || v === "—") {
    grupoEstilo.style.display = "flex";
    grupoEstilo.style.flexDirection = "column";
    grupoEstilo.style.opacity = "1";
    grupoEstilo.style.height = "auto";
  } else {
    grupoEstilo.style.display = "none";
  }
}

// ======================
// FILTRAR PERSONAGENS OCUPADOS
// ======================
async function carregarPersonagensDisponiveis(uidUsuarioAtual, personagemAtualDoUsuario) {
  const takenSnap = await get(ref(db, "personagens"));
  const ocupadosMap = takenSnap.exists() ? takenSnap.val() : {};

  // Extrai a lista de nomes de personagens que já estão sendo usados por outros UIDs
  const personagensEmUso = Object.entries(ocupadosMap)
    .filter(([uid, nomeChar]) => uid !== uidUsuarioAtual)
    .map(([uid, nomeChar]) => nomeChar);

  selectPersonagem.innerHTML = "";

  todasOpcoes.forEach(opt => {
    // Exibe "Sem Personagem", ou personagens que NÃO estão em uso por outros
    if (opt.value === "Sem Personagem" || !personagensEmUso.includes(opt.value)) {
      const optionEl = document.createElement("option");
      optionEl.value = opt.value;
      optionEl.textContent = opt.text;
      selectPersonagem.appendChild(optionEl);
    }
  });

  // Força a seleção para a primeira opção carregada na lista
  if (selectPersonagem.options.length > 0) {
    selectPersonagem.value = selectPersonagem.options[0].value;
  }

  atualizarImagem();
}

selectPersonagem.addEventListener("change", () => {
  atualizarImagem();
});

// ======================
// CRIAR / TROCAR PERSONAGEM
// ======================
window.criarPersonagem = async function () {
  const user = auth.currentUser;
  if (!user) {
    alert("Você não está logado!");
    return;
  }

  const novoPersonagem = selectPersonagem.value;
  const estilo = selectEstilo.value;

  if (!novoPersonagem) {
    alert("Selecione um personagem válido.");
    return;
  }

  try {
    const charRef = ref(db, `players/${user.uid}/character`);
    const snap = await get(charRef);
    const data = snap.exists() ? snap.val() : {};
    const antigoPersonagem = data.charName || null;

    // Se escolheu o mesmo personagem que já possui, apenas volta pro perfil
    if (antigoPersonagem === novoPersonagem) {
      window.location.href = "perfil.html";
      return;
    }

    const ehSemPersonagem = (novoPersonagem === "Sem Personagem");

    // --- VERIFICAÇÃO DO ITEM DE TROCA ---
    // Isenta a troca se o destino for "Sem Personagem"
    const itemRef = ref(db, `players/${user.uid}/inventory/trocadepersonagem`);
    let qtdItem = 0;

    if (antigoPersonagem && !ehSemPersonagem) {
      const itemSnap = await get(itemRef);
      qtdItem = itemSnap.exists() ? Number(itemSnap.val()) || 0 : 0;

      if (qtdItem <= 0) {
        alert("Você não possui o item 'Troca de Personagem' no inventário para realizar essa troca!");
        return;
      }
    }

    // --- TRAVA DO PERSONAGEM ---
    // Agora verifica no nó geral se o personagem já não está reservado por OUTRO UID
    if (!ehSemPersonagem) {
      const todosPersonagensSnap = await get(ref(db, "personagens"));
      const todosPersonagens = todosPersonagensSnap.exists() ? todosPersonagensSnap.val() : {};

      // Procura se o novoPersonagem já pertence a outro usuário
      const jaOcupadoPorOutro = Object.entries(todosPersonagens).some(
        ([uid, nomeChar]) => nomeChar === novoPersonagem && uid !== user.uid
      );

      if (jaOcupadoPorOutro) {
        alert("Ops! Alguém acabou de escolher este personagem. Por favor, selecione outro.");
        await carregarPersonagensDisponiveis(user.uid, antigoPersonagem);
        return;
      }

      // Trava o personagem salvando: uidjogador: "Roronoa Zoro"
      await update(ref(db, "personagens"), {
        [user.uid]: novoPersonagem
      });
    } else {
      // Se selecionou "Sem Personagem", remove o registro do jogador no nó geral
      await update(ref(db, "personagens"), {
        [user.uid]: null
      });
    }

    // Se trocou de personagem e tinha um anterior válido, descontar item de troca
    if (antigoPersonagem && antigoPersonagem !== novoPersonagem && antigoPersonagem !== "Sem Personagem") {
      // --- DESCONTO DO ITEM DE TROCA ---
      if (!ehSemPersonagem) {
        if (qtdItem > 1) {
          await update(ref(db, `players/${user.uid}/inventory`), {
            trocadepersonagem: qtdItem - 1
          });
        } else {
          // Se só tinha 1, remove a chave do inventário
          await update(ref(db, `players/${user.uid}/inventory`), {
            trocadepersonagem: null
          });
        }
      }
    }

    // --- INCLUSÃO NO RANKING ---
    const rankingRef = ref(db, "ranking");
    const rankingSnap = await get(rankingRef);
    const rankingData = rankingSnap.exists() ? rankingSnap.val() : {};

    // Converte o objeto/matriz em lista para verificar se o UID já existe
    const uidsNoRanking = Object.values(rankingData);
    if (!uidsNoRanking.includes(user.uid)) {
      // Descobre a próxima posição numérica livre no ranking (1-based)
      const chaves = Object.keys(rankingData).map(Number).filter(n => !isNaN(n));
      const proximaPosicao = chaves.length > 0 ? Math.max(...chaves) + 1 : 1;

      await update(ref(db, "ranking"), {
        [proximaPosicao]: user.uid
      });
    }

    // Atualiza o personagem do jogador
    const updates = {
      charName: novoPersonagem,
      image: gerarUrl(novoPersonagem)
    };

    if (!data.style || data.style === "—") {
      updates.style = estilo;
    }

    await update(charRef, updates);

    alert("Personagem escolhido com sucesso!");
    window.location.href = "perfil.html";

  } catch (err) {
    console.error(err);
    alert("Erro ao escolher personagem.");
  }
};

// ======================
// LOAD
// ======================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "auth.html";
    return;
  }

  const snap = await get(ref(db, `players/${user.uid}/character`));
  let personagemAtual = null;
  let estiloAtual = "—";

  if (snap.exists()) {
    const data = snap.val();
    personagemAtual = data.charName || null;
    estiloAtual = data.style || "—";
  }

  controlarEstilo(estiloAtual);
  await carregarPersonagensDisponiveis(user.uid, personagemAtual);
});
