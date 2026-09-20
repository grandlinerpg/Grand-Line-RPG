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
  if (selectPersonagem.value) {
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
  const ocupados = takenSnap.exists() ? takenSnap.val() : {};

  selectPersonagem.innerHTML = "";

  todasOpcoes.forEach(opt => {
    const dono = ocupados[opt.value];
    if (!dono || dono === uidUsuarioAtual) {
      const optionEl = document.createElement("option");
      optionEl.value = opt.value;
      optionEl.textContent = opt.text;
      selectPersonagem.appendChild(optionEl);
    }
  });

  if (personagemAtualDoUsuario && ocupados[personagemAtualDoUsuario] === uidUsuarioAtual) {
    selectPersonagem.value = personagemAtualDoUsuario;
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

    // --- VERIFICAÇÃO DO ITEM DE TROCA ---
    // Se o jogador já tinha um personagem e está trocando, precisa do item "trocadepersonagem"
    const itemRef = ref(db, `players/${user.uid}/inventory/trocadepersonagem`);
    let qtdItem = 0;

    if (antigoPersonagem) {
      const itemSnap = await get(itemRef);
      qtdItem = itemSnap.exists() ? Number(itemSnap.val()) || 0 : 0;

      if (qtdItem <= 0) {
        alert("Você não possui o item 'Troca de Personagem' no inventário para realizar essa troca!");
        return;
      }
    }

    // Tenta travar o novo personagem de forma atômica no banco
    const novoCharRef = ref(db, `personagens/${novoPersonagem}`);
    const txResult = await runTransaction(novoCharRef, (currentOwner) => {
      if (currentOwner === null || currentOwner === user.uid) {
        return user.uid;
      } else {
        return; // Alguém pegou primeiro
      }
    });

    if (!txResult.committed) {
      alert("Ops! Alguém acabou de escolher este personagem. Por favor, selecione outro.");
      await carregarPersonagensDisponiveis(user.uid, antigoPersonagem);
      return;
    }

    // Se trocou de personagem, libera o antigo na lista global
    if (antigoPersonagem && antigoPersonagem !== novoPersonagem) {
      await update(ref(db, "personagens"), {
        [antigoPersonagem]: null
      });

      // --- DESCONTO DO ITEM DE TROCA ---
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
