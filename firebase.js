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

// 🔥 garantir persistência ANTES de qualquer coisa
async function initAuth() {
  await setPersistence(auth, browserLocalPersistence);
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

    await signInWithEmailAndPassword(auth, email, senha);

    alert("Login realizado com sucesso!");

    // 🔥 espera o Firebase salvar sessão antes de trocar página
    setTimeout(() => {
      window.location.href = "index.html";
    }, 300);

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

    await createUserWithEmailAndPassword(auth, email, senha);

    alert("Conta criada com sucesso!");

    showLogin();

  } catch (error) {
    alert(error.message);
  }
};
