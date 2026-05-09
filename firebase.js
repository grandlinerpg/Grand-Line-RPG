// ======================
// FIREBASE IMPORTS
// ======================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getDatabase,
  ref,
  set,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ======================
// CONFIG
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

setPersistence(auth, browserLocalPersistence);

// ======================
// REGISTER
// ======================
window.register = async function () {

  const email = document.getElementById("register-email").value;
  const senha = document.getElementById("register-password").value;
  const nome = document.getElementById("register-name").value;
  const confirmar = document.getElementById("register-confirm").value;

  if (!email || !senha || !nome || !confirmar) {
    alert("Preencha todos os campos!");
    return;
  }

  if (senha !== confirmar) {
    alert("As senhas não coincidem!");
    return;
  }

  try {

    const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
    const user = userCredential.user;

    const playerData = {
      uid: user.uid,
      nome: nome,
      email: email,

      info: {
        level: 1,
        exp: 0,
        saldo: 10000
      },

      character: {
        faction: "Governo Mundial",
        charName: "Sem Personagem",
        style: "—",
        race: "—",
        fruit: "—"
      },

      stats: {
        str: 1,
        res: 1,
        dex: 1,
        agi: 1,
        sta: 1,
        hp: 1
      }
    };

    await set(ref(db, `players/${user.uid}`), playerData);

    alert("Conta criada com sucesso!");

    // 🔥 AGORA VAI PARA LOGIN
    window.location.href = "auth.html";

  } catch (error) {
    alert(error.message);
  }
};

// ======================
// LOGIN (NOVO FLUXO)
// ======================
window.login = async function () {

  const email = document.getElementById("login-email").value;
  const senha = document.getElementById("login-password").value;

  if (!email || !senha) {
    alert("Preencha todos os campos!");
    return;
  }

  try {

    const userCredential = await signInWithEmailAndPassword(auth, email, senha);
    const user = userCredential.user;

    localStorage.setItem("uid", user.uid);

    // 🔥 BUSCA DADOS DO PLAYER
    const snap = await get(ref(db, `players/${user.uid}`));

    if (!snap.exists()) {
      alert("Jogador não encontrado!");
      return;
    }

    const data = snap.val();

    // 🔥 CHECA SE TEM PERSONAGEM
    const temPersonagem =
      data.character &&
      data.character.charName &&
      data.character.charName !== "Novo Personagem";

    if (temPersonagem) {
      window.location.href = "perfil.html";
    } else {
      window.location.href = "criacao-personagem.html";
    }

  } catch (error) {
    alert(error.message);
  }
};
