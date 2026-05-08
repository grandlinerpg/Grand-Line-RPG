// ======================
// IMPORTS FIREBASE (CDN)
// ======================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ======================
// CONFIG FIREBASE (CORRETO)
// ======================
const firebaseConfig = {
  apiKey: "AIzaSyC4kgy_L79WYFqr9XZhoDuZBfqG4AGTVUQ",
  authDomain: "grand-line-rpg-dcda9.firebaseapp.com",
  projectId: "grand-line-rpg-dcda9",
  storageBucket: "grand-line-rpg-dcda9.appspot.com",
  messagingSenderId: "172042779786",
  appId: "1:172042779786:web:ecdff9eaf4fee36eca8173",
  measurementId: "G-1H48YJSFXQ"
};

// ======================
// INIT FIREBASE
// ======================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ======================
// PERSISTÊNCIA LOGIN
// ======================
let authReady = false;

async function initAuth() {
  try {
    await setPersistence(auth, browserLocalPersistence);
    authReady = true;
  } catch (error) {
    console.error("Erro persistência:", error);
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

    if (!authReady) await initAuth();

    await signInWithEmailAndPassword(auth, email, senha);

    alert("Login realizado com sucesso!");

    // espera leve para garantir sessão salva
    setTimeout(() => {
      window.location.href = "perfil.html";
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

    if (!authReady) await initAuth();

    await createUserWithEmailAndPassword(auth, email, senha);

    alert("Conta criada com sucesso!");

    showLogin(); // sua função de UI

  } catch (error) {
    alert(error.message);
  }
};
