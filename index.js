import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC4kgy_L79WYFqr9XZhoDuZBfqG4AGTVUQ",
  authDomain: "grand-line-rpg-dcda9.firebaseapp.com",
  projectId: "grand-line-rpg-dcda9",
  storageBucket: "grand-line-rpg-dcda9.firebasestorage.app",
  messagingSenderId: "172042779786",
  appId: "1:172042779786:web:ecdff9eaf4fee36eca8173",
  measurementId: "G-1H48YJSFXQ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function init() {

  await setPersistence(auth, browserLocalPersistence);

  onAuthStateChanged(auth, (user) => {

    if (user) {
      // 🔥 JÁ LOGADO → manda direto pro perfil
      window.location.href = "perfil.html";
      return;
    }

    // não logado → fica na home
    const area = document.getElementById("home-button-area");

    if (area) {
      area.innerHTML = `
        <a href="auth.html" class="hero-btn">
          ⚓ COMEÇAR JORNADA
        </a>
      `;
    }

  });

}

init();
