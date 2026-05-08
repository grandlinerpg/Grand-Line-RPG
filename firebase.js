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

// ======================
// PERSISTÊNCIA (CORRIGIDA)
// ======================
async function initAuth() {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (err) {
    console.error("Erro persistência:", err);
  }
}
initAuth();

// ======================
// REGISTER
// ======================
window.register = async function () {

  const email = document.getElementById("register-email").value;
  const senha = document.getElementById("register-password").value;
  const nome = document.getElementById("register-name").value;

  if (!email || !senha || !nome) {
    alert("Preencha tudo!");
    return;
  }

  try {

    const userCred = await createUserWithEmailAndPassword(auth, email, senha);
    const user = userCred.user;

    console.log("UID criado:", user.uid);

    // 🔥 SALVAR NO REALTIME DATABASE
    await set(ref(db, "players/" + user.uid), {
      nome: nome,
      email: email,
      level: 1,
      exp: 0,
      saldo: 0,
      faction: "Sem Facção",
      charName: "Novo Personagem",
      style: "-",
      race: "-",
      fruit: "-",
      str: 0,
      res: 0,
      dex: 0,
      agi: 0,
      sta: 0,
      hp: 100
    });

    console.log("Salvou no database");

    alert("Conta criada!");
    showLogin();

  } catch (err) {
    console.error("ERRO REGISTER:", err);
    alert(err.message);
  }
};

// ======================
// LOGIN
// ======================
window.login = async function () {

  const email = document.getElementById("login-email").value;
  const senha = document.getElementById("login-password").value;

  if (!email || !senha) {
    alert("Preencha tudo!");
    return;
  }

  try {

    const userCred = await signInWithEmailAndPassword(auth, email, senha);
    const user = userCred.user;

    console.log("Login OK:", user.uid);

    localStorage.setItem("uid", user.uid);

    window.location.href = "perfil.html";

  } catch (err) {
    console.error("ERRO LOGIN:", err);
    alert(err.message);
  }
};
