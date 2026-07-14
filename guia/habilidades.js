import {
    ref,
    get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


const container =
document.getElementById("habilidades-container");



async function carregarHabilidadesHTML(){

    if(!container) return;


    const res =
    await fetch("guia/habilidades.html");


    container.insertAdjacentHTML(
        "beforeend",
        await res.text()
    );

}


carregarHabilidadesHTML();





function slug(texto){

    return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/\s+/g,"-");

}





window.abrirHabilidades = async function(estilo){


    const modal =
    document.getElementById("habilidades-modal");


    const list =
    document.getElementById("habilidades-list");


    const title =
    document.getElementById("habilidades-title");



    if(!modal || !list) return;



    modal.style.display="flex";



    title.innerText =
    "HABILIDADES - " + estilo;



    list.innerHTML =
    "Carregando...";



    const db =
    window.db;



    const nomeEstilo =
    slug(estilo);



    const snap =
    await get(
        ref(
            db,
            `habilidades/estilo-de-luta/${nomeEstilo}`
        )
    );



    if(!snap.exists()){


        list.innerHTML =
        "Nenhuma habilidade encontrada.";


        return;

    }



    const habilidades =
    snap.val();



    list.innerHTML="";



    const ranks = {

        1:"INICIANTE",
        2:"APRENDIZ",
        3:"NOVATO",
        4:"INTERMEDIÁRIO",
        5:"VETERANO"

    };



    for(const id in habilidades){



        const skill =
        habilidades[id];



        const div =
        document.createElement("div");



        div.className =
        "skill-item";



        div.innerHTML = `

            <img
            src="https://res.cloudinary.com/djh45admn/image/upload/v1781908673/${skill.img}.jpg"
            class="skill-icon"
            >


            <span>

                ${skill.nome}

                <br>

                ${ranks[skill.rank] || ""}

            </span>

        `;



        div.addEventListener("click",()=>{


            console.log(
                "Clicou na skill:",
                skill
            );


            abrirFicha(skill);


        });



        list.appendChild(div);


    }


};






document.addEventListener("click",(e)=>{


    if(e.target.id === "close-habilidades"){


        document
        .getElementById("habilidades-modal")
        .style.display="none";


    }


});
