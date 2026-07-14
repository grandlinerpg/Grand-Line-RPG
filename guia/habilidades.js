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





window.abrirHabilidades = async function(estilo){



    const modal =
    document.getElementById("habilidades-modal");


    const list =
    document.getElementById("habilidades-list");


    const title =
    document.getElementById("habilidades-title");



    if(!modal || !list) return;



    modal.style.display = "flex";


    title.innerText =
    "HABILIDADES - " + estilo;



    list.innerHTML =
    "Carregando...";



    const db =
    window.db;



    const snap =
    await get(ref(db,"habilidades"));



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



    let encontrou = false;



    for(const categoria in habilidades){


        for(const sub in habilidades[categoria]){


            for(const id in habilidades[categoria][sub]){


                const skill =
                habilidades[categoria][sub][id];



                // FILTRO PELO ESTILO
                if(skill.estilo !== estilo)
                    continue;



                encontrou = true;



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



                div.onclick = ()=>{

                    console.log(
                        "Skill:",
                        skill
                    );

                    abrirFicha(skill);

                };



                list.appendChild(div);


            }

        }

    }



    if(!encontrou){

        list.innerHTML =
        "Nenhuma habilidade encontrada para este estilo.";

    }


};





document.addEventListener("click",e=>{


    if(e.target.id === "close-habilidades"){

        document
        .getElementById("habilidades-modal")
        .style.display="none";

    }


});
