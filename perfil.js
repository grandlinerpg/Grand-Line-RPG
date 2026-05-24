import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getDatabase,
  ref,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ======================
// FIREBASE CONFIG
// ======================
const firebaseConfig = {
  apiKey: "AIzaSyC4kgy_L79WYFqr9XZhoDuZBfqG4AGTVUQ",
  authDomain: "grand-line-rpg-dcda9.firebaseapp.com",
  projectId: "grand-line-rpg-dcda9",
  storageBucket: "grand-line-rpg-dcda9.appspot.com",
  messagingSenderId: "172042779786",
  appId: "1:172042779786:web:ecdff9eaf4fee36eca8173",
  measurementId: "G-1H48YJSFXQ",
  databaseURL: "https://grand-line-rpg-dcda9-default-rtdb.firebaseio.com"
};

// ======================
// INIT
// ======================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// ======================
// AUTH + LOAD PROFILE
// ======================
async function startAuth() {

  await setPersistence(auth, browserLocalPersistence);

  onAuthStateChanged(auth, async (user) => {

    if (!user) {
      window.location.replace("auth.html");
      return;
    }

    const uid = user.uid;

    try {

      // ======================
      // BUSCA NO FIREBASE
      // ======================
      onValue(ref(db, "players/" + uid), (snap) => {

        if (!snap.exists()) {
          console.log("Sem dados no DB");
          return;
        }

        const data = snap.val();

        // ======================
        // INFO DO PLAYER
        // ======================
        document.getElementById("player-name").innerText =
          data.nome || "-";

        document.getElementById("char-name").innerText =
          data.character?.charName || "-";

        document.getElementById("faction").innerText =
          data.character?.faction || "-";

        // ======================
        // IMAGEM PERSONAGEM
        // ======================
        const personagem = (data.character?.charName || "default")
          .toLowerCase()
          .replaceAll(" ", "-")
          .replaceAll(".", "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");

        const imagem =
          `https://res.cloudinary.com/djh45admn/image/upload/v1778334616/${personagem}.png?v=${Date.now()}`;

        const charImg = document.getElementById("char-img");

        charImg.src = imagem;

        // fallback
        charImg.onerror = function () {
          this.src =
            "https://res.cloudinary.com/djh45admn/image/upload/v1778336777/Picsart_26-05-07_12-17-03-057_nkedrn.png?v=" + Date.now();
        };

        // ======================
        // INFORMAÇÕES
        // ======================
        document.getElementById("style").innerText =
          data.character?.style || "-";

        document.getElementById("race").innerText =
          data.character?.race || "-";

        document.getElementById("fruit").innerText =
          data.character?.fruit || "-";

        // ======================
        // INFO / LEVEL / EXP
        // ======================
        const level = data.info?.level || 1;
        const exptotal = data.info?.exp || 0;
        const exp = exptotal % 1000;
        const saldo = data.info?.saldo || 0;

        const expMax = 1000;

        document.getElementById("level").innerText = level;

        document.getElementById("exp").innerText =
          exp.toLocaleString("pt-BR");

        document.getElementById("exp-max").innerText =
          expMax.toLocaleString("pt-BR");

        document.getElementById("saldo").innerText =
          saldo.toLocaleString("pt-BR");

        // ======================
        // ATRIBUTOS
        // ======================
        const stats = data.stats || {};

        document.getElementById("str").innerText = stats.str || 0;
        document.getElementById("res").innerText = stats.res || 0;
        document.getElementById("dex").innerText = stats.dex || 0;
        document.getElementById("agi").innerText = stats.agi || 0;
        document.getElementById("sta").innerText = stats.sta || 0;
        document.getElementById("hp").innerText = stats.hp || 0;

      });

    } catch (err) {
      console.error("Erro ao carregar perfil:", err);
    }
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


// ======================================================
// 🔥 ADIÇÃO NECESSÁRIA PARA O MODAL (SEM MEXER NO RESTO)
// ======================================================
window.auth = auth;
window.db = db;
