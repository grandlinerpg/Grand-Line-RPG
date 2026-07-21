import { 
  initializeApp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getDatabase,
  ref,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyC4kgy_L79WYFqr9XZhoDuZBfqG4AGTVUQ",
  authDomain: "grand-line-rpg-dcda9.firebaseapp.com",
  projectId: "grand-line-rpg-dcda9",
  storageBucket: "grand-line-rpg-dcda9.appspot.com",
  messagingSenderId: "172042779786",
  appId: "1:172042779786:web:ecdff9eaf4fee36eca8173",
  databaseURL: "https://grand-line-rpg-dcda9-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

console.log("FIREBASE DB:", db);

async function carregarHabilidadesHTML(){

  const container =
  document.getElementById("habilidades-container");

  if(!container) return;

  const res =
  await fetch("habilidades.html");

  container.innerHTML =
  await res.text();

  const btn =
  document.getElementById("close-habilidades");

  if(btn){
    btn.onclick = fecharHabilidades;
  }

}

carregarHabilidadesHTML();


async function getEstilo(key){

  let snap =
  await get(
    ref(
      db,
      `habilidades/Estilo de Luta/${key}`
    )
  );


  let tipo="Estilo de Luta";


  if(!snap.exists()){

    snap =
    await get(
      ref(
        db,
        `habilidades/Raças/${key}`
      )
    );

    tipo="Raças";

  }


  if(!snap.exists())
    return null;


  const data =
  snap.val();


  return {

    skills:
    Object.values(data)
    .filter(
      v =>
      v &&
      typeof v === "object" &&
      v.nome
    ),


    heranca:{
      heranca:data.heranca || null,
      heranca2:data.heranca2 || null,
      heranca3:data.heranca3 || null
    }

  };

}



window.abrirHabilidades = async function(estiloNome){

  const modal =
  document.getElementById("habilidades-modal");

  const container =
  document.getElementById("habilidades-list");

  const title =
  document.getElementById("habilidades-title");


  if(!modal || !container){

    await carregarHabilidadesHTML();

    return window.abrirHabilidades(estiloNome);

  }


  modal.style.display="flex";


  if(title){

    title.innerText =
    "HABILIDADES";

  }


  container.innerHTML =
  "Carregando...";


  try{

    const key =
    estiloNome;

    let todasSkills=[];

    let visitados =
    new Set();

    let fila=[
      key
    ];


    while(fila.length){

      const atual =
      fila.shift();


      if(!atual || visitados.has(atual))
        continue;


      visitados.add(atual);


      const estilo =
      await getEstilo(atual);


      if(!estilo)
        continue;


      todasSkills =
      todasSkills.concat(
        estilo.skills
      );


      if(estilo.heranca.heranca)
        fila.push(estilo.heranca.heranca);

      if(estilo.heranca.heranca2)
        fila.push(estilo.heranca.heranca2);

      if(estilo.heranca.heranca3)
        fila.push(estilo.heranca.heranca3);

    }


    if(!todasSkills.length){

      container.innerHTML=
      `
      <div class="skill-item">
      Nenhuma habilidade encontrada
      </div>
      `;

      return;

    }


    container.innerHTML="";


    const nomesRank = {
      1:"INICIANTE",
      2:"APRENDIZ",
      3:"NOVATO",
      4:"INTERMEDIÁRIO",
      5:"VETERANO"
    };


    for(let tier=1;tier<=5;tier++){

      const group =
      todasSkills.filter(
        h =>
        Number(h.rank)===tier
      );


      if(!group.length)
        continue;


      const sep =
      document.createElement("div");


      sep.className =
      "skill-rank";


      sep.innerText =
      nomesRank[tier];


      container.appendChild(sep);



      group.forEach(skill=>{

        const item =
        document.createElement("div");


        item.className =
        "skill-item";


        item.innerHTML =
        `
        <img
        class="skill-icon"
        src="https://res.cloudinary.com/djh45admn/image/upload/v1781908673/${skill.img}.jpg"
        >

        <span>
        ${skill.nome}
        </span>
        `;


        item.onclick=()=>{

          console.log(
            "Skill:",
            skill
          );

          abrirFicha(skill, true, false, true);

        };


        container.appendChild(item);

      });


    }


  }catch(err){

    console.error(
      err
    );

    container.innerHTML=
    `
    <div class="skill-item">
    Erro ao carregar habilidades
    </div>
    `;

  }

}



window.fecharHabilidades = function(){

  const modal =
  document.getElementById("habilidades-modal");

  const container =
  document.getElementById("habilidades-list");


  if(modal)
    modal.style.display="none";


  if(container)
    container.innerHTML="";

}
