import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ======================
// FIREBASE CONFIG
// ======================
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  projectId: "SEU_PROJECT_ID",
  appId: "SEU_APP_ID"
};

// ======================
// INIT FIREBASE
// ======================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ======================
// ELEMENTO DA HOME
// ======================
const area = document.getElementById("home-button-area");

// loading inicial
area.innerHTML = `<button class="button-loading">CARREGANDO...</button>`;

// ======================
// VERIFICA LOGIN
// ======================
onAuthStateChanged(auth, (user) => {

  if (user) {

    // 🔥 LOGADO
    area.innerHTML = `
      <a href="perfil.html" class="hero-btn">
        👤 MEU PERFIL
      </a>
    `;

    console.log("Logado como:", user.email);

  } else {

    // ❌ NÃO LOGADO
    area.innerHTML = `
      <a href="auth.html" class="hero-btn">
        ⚓ COMEÇAR JORNADA
      </a>
    `;

    console.log("Não logado");

  }

});
