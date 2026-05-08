import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ======================
// FIREBASE CONFIG
// ======================
const firebaseConfig = {
  apiKey: "AIzaSyC4kgy_L79WYFqr9XZhoDuZBfqG4AGTVUQ",
  authDomain: "grand-line-rpg-dcda9.firebaseapp.com",
  projectId: "grand-line-rpg-dcda9",
  storageBucket: "grand-line-rpg-dcda9.firebasestorage.app",
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
// START AUTH
// ======================
async function startAuth() {

  await setPersistence(auth, browserLocalPersistence);

  onAuthStateChanged(auth, (user) => {

    if (!user) {
      window.location.replace("auth.html");
      return;
    }

    // ======================
    // DADOS FIREBASE AUTH
    // ======================
    console.log("Logado como:", user.email);

    // ======================
    // RPG (MOCK - FUTURO FIRESTORE)
    // ======================

    // Jogador / personagem
    document.getElementById("player-name").innerText = "Pirata";
    document.getElementById("char-name").innerText = "Monkey D. Teste";
    document.getElementById("faction").innerText = "Piratas";

    // imagem personagem
    document.getElementById("char-img").src =
      "https://i.imgur.com/DYQY9IR.png";

    // infos
    document.getElementById("style").innerText = "Espadachim";
    document.getElementById("race").innerText = "Humano";
    document.getElementById("fruit").innerText = "Nenhuma";

    // ======================
    // LEVEL / EXP / SALDO
    // ======================

    const level = 5;
    const exp = 250;
    const expMax = 1000;
    const saldo = 15000;

    document.getElementById("level").innerText = level;

    document.getElementById("exp").innerText = exp;
    document.getElementById("exp-max").innerText = expMax;

    document.getElementById("saldo").innerText = saldo;

    // ======================
    // ATRIBUTOS
    // ======================
    document.getElementById("str").innerText = 10;
    document.getElementById("res").innerText = 8;
    document.getElementById("dex").innerText = 12;
    document.getElementById("agi").innerText = 15;
    document.getElementById("sta").innerText = 20;
    document.getElementById("hp").innerText = 100;

  });

}

// ======================
// LOGOUT
// ======================
window.logout = function () {
  signOut(auth).then(() => {
    window.location.replace("index.html");
  });
};

startAuth();
