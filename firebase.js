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
  set
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

// login persistente
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

    console.log("UID criado:", user.uid);

    // 🔥 ESTRUTURA RPG COMPLETA
    await set(ref(db, "players/" + user.uid), {

      uid: user.uid,
      nome,
      email,

      info: {
        level: 1,
        exp: 0,
        saldo: 0
      },

      character: {
        faction: "Sem Facção",
        charName: "Novo Personagem",
        style: "-",
        race: "-",
        fruit: "-"
      },

      stats: {
        str: 0,
        res: 0,
        dex: 0,
        agi: 0,
        sta: 0,
        hp: 100
      }
    });

    alert("Conta criada com sucesso!");
    showLogin();

  } catch (error) {
    console.error(error);
    alert(error.message);
  }
};

// ======================
// LOGIN
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

    window.location.href = "perfil.html";

  } catch (error) {
    alert(error.message);
  }
};
