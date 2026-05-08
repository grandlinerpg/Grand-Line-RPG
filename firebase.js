import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ======================
// CONFIG FIREBASE
// ======================
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_BUCKET",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

// ======================
// INIT
// ======================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// 🔥 controle de inicialização
let authReady = false;

async function initAuth() {
  try {
    await setPersistence(auth, browserLocalPersistence);
    authReady = true;
  } catch (err) {
    console.error("Erro persistência:", err);
  }
}

initAuth();

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

    // 🔥 garante que persistência já foi configurada
    if (!authReady) {
      await initAuth();
    }

    await signInWithEmailAndPassword(auth, email, senha);

    alert("Login realizado com sucesso!");

    // 🔥 espera próximo ciclo do browser
    setTimeout(() => {
      window.location.replace("index.html");
    }, 500);

  } catch (error) {
    alert(error.message);
  }
};

// ======================
// REGISTER
// ======================
window.register = async function () {

  const email = document.getElementById("register-email").value;
  const senha = document.getElementById("register-password").value;
  const confirmar = document.getElementById("register-confirm").value;

  if (!email || !senha || !confirmar) {
    alert("Preencha todos os campos!");
    return;
  }

  if (senha !== confirmar) {
    alert("As senhas não coincidem!");
    return;
  }

  try {

    if (!authReady) {
      await initAuth();
    }

    await createUserWithEmailAndPassword(auth, email, senha);

    alert("Conta criada com sucesso!");

    showLogin();

  } catch (error) {
    alert(error.message);
  }
};
