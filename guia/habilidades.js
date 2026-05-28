import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getDatabase,
  ref,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* 🔥 FIREBASE CONFIG */
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

/* INIT */
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* TIER IMAGES */
const habilidadeTiers = {
  1: "https://res.cloudinary.com/djh45admn/image/upload/v1779847983/tier-1.png",
  2: "https://res.cloudinary.com/djh45admn/image/upload/v1779847983/tier-2.png",
  3: "https://res.cloudinary.com/djh45admn/image/upload/v1779847983/tier-3.png",
  4: "https://res.cloudinary.com/djh45admn/image/upload/v1779847983/tier-4.png",
  5: "https://res.cloudinary.com/djh45admn/image/upload/v1779847983/tier-5.png"
};

function slug(name){
  return name.toLowerCase().replace(/ /g,'-');
}

/* 🔥 BUSCA ESTILO */
async function getEstilo(key){

  const snap = await get(ref(db, `habilidades/estilo-de-luta/${key}`));

  if(!snap.exists()){
    return { skills: [], heranca: null };
  }

  const data = snap.val();

  const heranca = data.heranca || null;

  const skills = Object.entries(data)
    .filter(([k]) => k !== "heranca")
    .map(([_, v]) => v);

  return {
    skills,
    heranca
  };
}

/* 🔥 ABRIR JANELA COM HERANÇA EM CADEIA */
export async function abrirHabilidades(estiloNome){

  const modal = document.getElementById("habilidades-modal");
  const container = document.getElementById("habilidades-container");

  if(!modal || !container){
    console.error("Modal de habilidades não encontrado no HTML");
    return;
  }

  modal.style.display = "flex";
  container.innerHTML = "Carregando...";

  try {

    const key = estiloNome.toLowerCase();

    let todasSkills = [];
    let fila = [key];
    let visitados = new Set();

    /* 🔥 CADEIA DE HERANÇA */
    while(fila.length > 0){

      const atual = fila.shift();

      if(visitados.has(atual)) continue;
      visitados.add(atual);

      const estilo = await getEstilo(atual);

      todasSkills = todasSkills.concat(estilo.skills);

      if(estilo.heranca){
        fila.push(estilo.heranca);
      }
    }

    if(todasSkills.length === 0){
      container.innerHTML = `
        <div class="habilidade-item">
          Nenhuma habilidade encontrada
        </div>
      `;
      return;
    }

    container.innerHTML = "";

    for(let tier = 1; tier <= 5; tier++){

      const group = todasSkills.filter(h => Number(h.rank) === tier);

      if(group.length === 0) continue;

      const sep = document.createElement("div");
      sep.className = "habilidade-tier-sep";
      sep.innerHTML = `<img src="${habilidadeTiers[tier]}">`;
      container.appendChild(sep);

      group.forEach(h => {

        const item = document.createElement("div");
        item.className = "habilidade-item";
        item.innerHTML = `<span>${h.nome}</span>`;

        container.appendChild(item);
      });
    }

  } catch (err) {
    console.error("Erro Firebase:", err);
    container.innerHTML = `
      <div class="habilidade-item">
        Erro ao carregar habilidades
      </div>
    `;
  }
}

/* 🔥 FECHAR JANELA */
export function fecharHabilidades(){

  const modal = document.getElementById("habilidades-modal");
  const container = document.getElementById("habilidades-container");

  if(modal) modal.style.display = "none";
  if(container) container.innerHTML = "";
}
