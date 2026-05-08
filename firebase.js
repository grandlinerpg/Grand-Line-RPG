// FIREBASE

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// CONFIG FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyC4kgy_L79WYFqr9XZhoDuZBfqG4AGTVUQ",
  authDomain: "grand-line-rpg-dcda9.firebaseapp.com",
  projectId: "grand-line-rpg-dcda9",
  storageBucket: "grand-line-rpg-dcda9.firebasestorage.app",
  messagingSenderId: "172042779786",
  appId: "1:172042779786:web:ecdff9eaf4fee36eca8173",
  measurementId: "G-1H48YJSFXQ"
};

// INICIALIZA
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// 🔥 GARANTE QUE O LOGIN NÃO SE PERCA (IMPORTANTE PRO GITHUB PAGES)
setPersistence(auth, browserLocalPersistence);

// =========================
// REGISTRAR
// =========================
window.register = async function () {

  const email = document.getElementById("register-email").value;
  const senha = document.getElementById("register-password").value;
  const confirmar = document.getElementById("register-confirm").value;

  if (senha !== confirmar) {
    alert("As senhas não coincidem.");
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

// =========================
// LOGIN (CORRIGIDO)
// =========================
window.login = async function () {

  const email = document.getElementById("login-email").value;
  const senha = document.getElementById("login-password").value;

  try {

    await setPersistence(auth, browserLocalPersistence);

    await signInWithEmailAndPassword(auth, email, senha);

    alert("Login realizado com sucesso!");

    // 🔥 pequeno delay evita bug de estado no Firebase
    setTimeout(() => {
      window.location.href = "index.html";
    }, 300);

  } catch (error) {
    alert(error.message);
  }
};
