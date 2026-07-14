import {
  getDatabase,
  ref,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


const db = window.db;

async function carregarHabilidadesHTML(){

  const container =
  document.getElementById("habilidades-container");

  if(!container) return;

  const res =
  await fetch("habilidades.html");

  container.innerHTML =
  await res.text();

}

carregarHabilidadesHTML();



const habilidadeTiers = {

  1:"https://res.cloudinary.com/djh45admn/image/upload/v1779847983/tier-1.png",
  2:"https://res.cloudinary.com/djh45admn/image/upload/v1779847983/tier-2.png",
  3:"https://res.cloudinary.com/djh45admn/image/upload/v1779847983/tier-3.png",
  4:"https://res.cloudinary.com/djh45admn/image/upload/v1779847983/tier-4.png",
  5:"https://res.cloudinary.com/djh45admn/image/upload/v1779847983/tier-5.png"

};



function slug(name){

  return name
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"")
  .replace(/\s+/g,"-");

}




async function getEstilo(key){


  const snap =
  await get(
    ref(
      db,
      `habilidades/estilo-de-luta/${key}`
    )
  );


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

    console.error(
      "Modal habilidades não encontrado"
    );

    return;

  }



  modal.style.display="flex";


  if(title){

    title.innerText =
    "HABILIDADES - " + estiloNome;

  }



  container.innerHTML =
  "Carregando...";




  try{


    const key =
    slug(estiloNome);



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
        fila.push(
          estilo.heranca.heranca
        );


      if(estilo.heranca.heranca2)
        fila.push(
          estilo.heranca.heranca2
        );


      if(estilo.heranca.heranca3)
        fila.push(
          estilo.heranca.heranca3
        );


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



      sep.innerHTML =
      `<img src="${habilidadeTiers[tier]}">`;



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
        src="
        https://res.cloudinary.com/djh45admn/image/upload/v1781908673/${skill.img}.jpg
        "
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


          abrirFicha(skill);


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
