import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getDatabase,
  ref,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import {
  initPerfilAlter
} from "./perfil-alter.js";

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

window.db = db;

// ======================
// IMAGEM PERSONAGEM
// ======================

function gerarImagemPersonagem(nome) {
  const personagem = (nome || "default")
    .toLowerCase()
    .replaceAll(" ", "-")
    .replaceAll(".", "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return `https://res.cloudinary.com/djh45admn/image/upload/v1778334616/${personagem}.png?v=${Date.now()}`;
}

// ======================
// CARREGAR FACÇÃO
// ======================

async function startAuth() {
  await setPersistence(
    auth,
    browserLocalPersistence
  );

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.replace("auth.html");
      return;
    }

    const uid = user.uid;

    // ======================
    // PLAYER LOGADO
    // ======================

    onValue(
      ref(db, `players/${uid}`),
      (playerSnap) => {
        if (!playerSnap.exists()) {
          console.log("Player não encontrado");
          return;
        }

        const player = playerSnap.val();
        const faction = player.character?.faction;
        const bando = player.character?.bando;

        console.log("Facção:", faction, "Bando:", bando);

        if (!faction) {
          console.log("Sem facção");
          return;
        }

        // Determina o caminho do nó no Firebase
        let factionPath = `faccoes/${faction}`;
        if (faction === "Piratas") {
          if (!bando) {
            console.log("Jogador é Pirata mas não tem bando definido");
            return;
          }
          factionPath = `faccoes/Piratas/bandos/${bando}`;
        }

        // ======================
        // DADOS DA FACÇÃO / BANDO
        // ======================

        onValue(
          ref(db, factionPath),
          (factionSnap) => {
            if (!factionSnap.exists()) {
              console.log("Dados do grupo não encontrados em:", factionPath);
              return;
            }

            const data = factionSnap.val();
            const nomeFaccao = data.nome || (faction === "Piratas" ? bando : faction);

            // NOME
            document.getElementById("faction-name").innerText = nomeFaccao;

            // IMAGEM
            const factionImg = document.getElementById("faction-img");
            factionImg.src = `https://res.cloudinary.com/djh45admn/image/upload/v1778334616/${data.imagem}.jpg?v=${Date.now()}`;

            factionImg.onerror = function () {
              this.src = "https://res.cloudinary.com/djh45admn/image/upload/v1778661201/logoglrpg.png";
            };

            // ARMAZÉM
            document.getElementById("warehouse").innerText = (data.armazem || 0).toLocaleString("pt-BR");

            // FORÇA
            document.getElementById("power").innerText = (data.forca || 0).toLocaleString("pt-BR");
          }
        );

        // ======================
        // MEMBROS DA FACÇÃO / BANDO
        // ======================

        onValue(
          ref(db, "players"),
          (playersSnap) => {
            const box = document.getElementById("members-list");
            box.innerHTML = "";

            playersSnap.forEach((playerItem) => {
              const data = playerItem.val();
              const playerFaction = data.character?.faction;
              const playerBando = data.character?.bando;

              // Se for Pirata, filtra por facção E bando; caso contrário, filtra apenas por facção
              const ehDoMesmoGrupo = faction === "Piratas"
                ? (playerFaction === "Piratas" && playerBando === bando)
                : (playerFaction === faction);

              if (ehDoMesmoGrupo) {
                const charName = data.character?.charName || "Sem personagem";

                const div = document.createElement("div");
                div.className = "member-card";

                div.innerHTML = `
                  <img
                    src="${gerarImagemPersonagem(charName)}"
                    onerror="this.src='https://res.cloudinary.com/djh45admn/image/upload/v1778661201/sem-personagem.png'"
                  >
                  <span>${charName}</span>
                `;

                // abrir window do personagem
                div.onclick = () => {
                  if (window.abrirPerfilAlter) {
                    window.abrirPerfilAlter(playerItem.key);
                  } else {
                    console.log("perfil-alter.js não carregado");
                  }
                };

                box.appendChild(div);
              }
            });

            if (box.innerHTML === "") {
              box.innerHTML = "Sem membros";
            }
          }
        );
      }
    );
  });
}

async function carregarPerfilAlter() {
  const res = await fetch("./perfil-alter.html");
  const html = await res.text();

  document.getElementById("perfil-alter-container").innerHTML = html;

  initPerfilAlter();

  console.log("Perfil alter:", window.abrirPerfilAlter);
}

// ======================
// START
// ======================

async function iniciar() {
  try {
    await carregarPerfilAlter();
  } catch (e) {
    console.log("Erro ao carregar perfil alter:", e);
  }

  startAuth();
}

iniciar();
