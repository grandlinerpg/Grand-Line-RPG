import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getDatabase,
  ref,
  set
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
// PERSONAGENS
// ======================
const personagens = {
  luffy: "https://res.cloudinary.com/djh45admn/image/upload/v1778336777/luffy.png",
  zoro: "https://res.cloudinary.com/djh45admn/image/upload/v1778336777/zoro.png",
  sanji: "https://res.cloudinary.com/djh45admn/image/upload/v1778336777/sanji.png"
};

// ======================
// ELEMENTOS (SEGURANÇA)
// ======================
const selectPersonagem = document.getElementById("personagem");
const selectEstilo = document.getElementById("estilo");
const imgPreview = document.getElementById("preview-img");

// evita crash se DOM ainda não carregou
if (selectPersonagem && imgPreview) {
  selectPersonagem.addEventListener("change", () => {
    const value = selectPersonagem.value;
    imgPreview.src = personagens[value] || imgPreview.src;
  });
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

  if (!personagem || !estilo) {
    alert("Escolha personagem e estilo!");
    return;
  }

  const data = {
    charName: personagem,
    style: estilo,
    image: personagens[personagem] || "",
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
// PROTEÇÃO DE ACESSO
// ======================
onAuthStateChanged(auth, (user) => {

  if (!user) {
    window.location.href = "auth.html";
  }

});
