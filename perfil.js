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
  get
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
      const snap = await get(ref(db, "players/" + uid));

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
      // IMAGEM AUTOMÁTICA
      // ======================
      const personagem = (data.character?.charName || "default")
        .toLowerCase()
        .replaceAll(" ", "-")
        .replaceAll(".", "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      const imagem =
        `https://res.cloudinary.com/djh45admn/image/upload/${personagem}.png`;

      document.getElementById("char-img").src = imagem;

      // fallback caso não exista imagem
      document.getElementById("char-img").onerror = function () {
        this.src = "https://i.imgur.com/DYQY9IR.png";
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
      const exp = data.info?.exp || 0;
      const saldo = data.info?.saldo || 0;

      // EXP DINÂMICA
      const expMax = level * 1000;

      document.getElementById("level").innerText = level;
      document.getElementById("exp").innerText = exp;
      document.getElementById("exp-max").innerText = expMax;
      document.getElementById("saldo").innerText = saldo;

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
