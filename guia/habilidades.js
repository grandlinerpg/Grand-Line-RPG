import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getDatabase,
  ref,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* FIREBASE */
const firebaseConfig = {
  /* SUA CONFIG FIREBASE */
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* TIERS IMAGEM */
const habilidadeTiers = {
  1: "https://res.cloudinary.com/djh45admn/image/upload/v1779847983/tier-1.png",
  2: "https://res.cloudinary.com/djh45admn/image/upload/v1779847983/tier-2.png",
  3: "https://res.cloudinary.com/djh45admn/image/upload/v1779847983/tier-3.png",
  4: "https://res.cloudinary.com/djh45admn/image/upload/v1779847983/tier-4.png",
  5: "https://res.cloudinary.com/djh45admn/image/upload/v1779847983/tier-5.png"
};

/* slug padrão */
function slug(name){
  return name.toLowerCase().replace(/ /g,'-');
}

/* 🔥 FUNÇÃO PRINCIPAL DA JANELA */
export async function abrirHabilidades(estiloNome){

  const modal = document.getElementById("habilidades-modal");
  const container = document.getElementById("habilidades-container");

  if(!modal || !container){
    console.error("Modal de habilidades não encontrado no HTML");
    return;
  }

  modal.style.display = "flex";
  container.innerHTML = "Carregando...";

  const estiloKey = estiloNome.toLowerCase();

  const habilidadesRef = ref(
    db,
    `matriz/habilidades/estilo-de-luta/${estiloKey}`
  );

  const snapshot = await get(habilidadesRef);

  if(!snapshot.exists()){
    container.innerHTML = `
      <div class="habilidade-item">
        Nenhuma habilidade encontrada.
      </div>
    `;
    return;
  }

  const lista = Object.values(snapshot.val());
  container.innerHTML = "";

  for(let tier = 1; tier <= 5; tier++){

    const group = lista.filter(h => Number(h.rank) === tier);

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
}

/* 🔥 FECHAR JANELA */
export function fecharHabilidades(){
  const modal = document.getElementById("habilidades-modal");
  const container = document.getElementById("habilidades-container");

  if(modal) modal.style.display = "none";
  if(container) container.innerHTML = "";
}
