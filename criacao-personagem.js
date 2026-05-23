import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getDatabase,
  ref,
  update,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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

// ======================
// INIT
// ======================
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

// ======================
// FUNÇÃO IMAGEM
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

// ======================
// PREVIEW
// ======================
function atualizarImagem() {
  img.src = gerarUrl(selectPersonagem.value);
}

selectPersonagem.addEventListener("change", () => {
  atualizarImagem();
  controlarEstilo("—"); // sempre mostra ao trocar personagem
});

atualizarImagem();

// ======================
// CONTROLAR ESTILO (CORRIGIDO)
// ======================
function controlarEstilo(style) {

  // FORÇA STRING SEGURA
  const valor = (style ?? "").toString().trim();

  const semEstilo = valor === "—" || valor === "-" || valor === "";

  if (semEstilo) {
    grupoEstilo.style.display = "block";
  } else {
    grupoEstilo.style.display = "none";
  }
}

// ======================
// CRIAR PERSONAGEM
// ======================
window.criarPersonagem = async function () {

  const user = auth.currentUser;

  if (!user) {
    alert("Você não está logado!");
    return;
  }

  const personagem = selectPersonagem.options[selectPersonagem.selectedIndex].text;
  const estilo = selectEstilo.value;

  if (grupoEstilo.style.display === "block" && !estilo) {
    alert("Escolha um estilo de luta!");
    return;
  }

  try {
    await update(ref(db, `players/${user.uid}/character`), {
      charName: personagem,
      style: estilo || "—",
      image: gerarUrl(selectPersonagem.value),
      faction: "Governo Mundial"
    });

    alert("Personagem criado!");
    window.location.href = "perfil.html";

  } catch (err) {
    console.error(err);
    alert("Erro ao criar personagem");
  }
};

// ======================
// AUTH + LOAD DADOS
// ======================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "auth.html";
    return;
  }

  const snap = await get(ref(db, `players/${user.uid}/character`));

  if (snap.exists()) {
    const data = snap.val();

    if (data.charName) {
      selectPersonagem.value = data.charName;
      atualizarImagem();
    }

    // 🔥 REGRA PRINCIPAL: SÓ ESCONDE SE FOR DIFERENTE DE "—"
    controlarEstilo(data.style || "—");
  } else {
    controlarEstilo("—");
  }
});
