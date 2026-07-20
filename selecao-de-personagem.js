import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, update, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ======================
// FIREBASE
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

// ======================
// IMAGEM
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

selectPersonagem.addEventListener("change", async () => {
  atualizarImagem();

  const user = auth.currentUser;
  if (!user) return;

  const snap = await get(ref(db, `players/${user.uid}/character`));

  if (snap.exists()) {
    const data = snap.val();
    controlarEstilo(data.style || "—");
  } else {
    controlarEstilo("—");
  }
});

atualizarImagem();

// ======================
// CONTROLAR ESTILO (SEM BUG VISUAL)
// ======================
function controlarEstilo(valor) {
  const v = (valor || "").trim();

  const container = grupoEstilo;

  if (!v || v === "—") {
    // MOSTRAR SEM QUEBRAR LAYOUT
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.opacity = "1";
    container.style.height = "auto";
  } else {
    // ESCONDER
    container.style.display = "none";
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

  const personagem = selectPersonagem.value;
  const estilo = selectEstilo.value;

  try {

    const charRef = ref(db, `players/${user.uid}/character`);
    const snap = await get(charRef);

    if (!snap.exists()) {
      alert("Personagem não encontrado.");
      return;
    }

    const data = snap.val();

    const updates = {
      charName: personagem,
      image: gerarUrl(personagem)
    };

    // Só altera o estilo se ainda não possuir um
    if (!data.style || data.style === "—") {
      updates.style = estilo;
    }

    await update(charRef, updates);

    alert("Sucesso!");
    window.location.href = "perfil.html";

  } catch (err) {
    console.error(err);
    alert("Erro ao escolher personagem");
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

  if (snap.exists()) {
    const data = snap.val();

    if (data.charName) {
      selectPersonagem.value = data.charName;
      atualizarImagem();
    }

    controlarEstilo(data.style || "—");
  } else {
    controlarEstilo("—");
  }
});
