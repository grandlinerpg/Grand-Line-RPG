import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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
const img = document.getElementById("preview-img");

// ======================
// LÓGICA IGUAL PERFIL (SLUG)
// ======================
function gerarSlug(nome) {
  return nome
    .toLowerCase()
    .replaceAll(" ", "-")
    .replaceAll(".", "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// ======================
// PREVIEW DA IMAGEM
// ======================
function atualizarImagem() {
  const slug = gerarSlug(selectPersonagem.value);

  const url =
    `https://res.cloudinary.com/djh45admn/image/upload/v1778334616/${slug}.png`;

  img.src = url;

  img.onerror = () => {
    img.src =
      "https://res.cloudinary.com/djh45admn/image/upload/v1778336777/Picsart_26-05-07_12-17-03-057_nkedrn.png";
  };
}

selectPersonagem.addEventListener("change", atualizarImagem);

// inicia preview
atualizarImagem();

// ======================
// CRIAR PERSONAGEM
// ======================
window.criarPersonagem = async function () {

  const user = auth.currentUser;

  if (!user) {
    alert("Você não está logado!");
    return;
  }

  const charName = selectPersonagem.value;
  const style = selectEstilo.value;

  const slug = gerarSlug(charName);

  const image =
    `https://res.cloudinary.com/djh45admn/image/upload/v1778334616/${slug}.png`;

  const data = {
    charName,
    style,
    image,
    faction: "Governo Mundial"
  };

  try {

    await set(ref(db, `players/${user.uid}/character`), data);

    alert("Personagem criado com sucesso!");
    window.location.href = "perfil.html";

  } catch (err) {
    console.error(err);
    alert("Erro ao criar personagem");
  }
};

// ======================
// PROTEÇÃO
// ======================
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "auth.html";
  }
});
