console.log("CARD.JS CARREGOU");


const cardContainer =
document.getElementById("card-container");


async function carregarCardHTML(){

    if(!cardContainer) return;


    const res =
    await fetch(
      location.pathname.includes("/guia/")
      ? "../perfil/card.html"
      : "perfil/card.html"
    );


    cardContainer.insertAdjacentHTML(
        "beforeend",
        await res.text()
    );


    document
    .getElementById("close-card")
    ?.addEventListener("click",()=>{

        document.getElementById(
            "card-modal"
        ).style.display="none";

    });


    // BOTÃO DOWNLOAD
    document
    .getElementById("download-card")
    ?.addEventListener("click", async()=>{


        const card =
        document.querySelector(".card-image-area");


        const canvas =
        await html2canvas(card,{
            scale:3,
            useCORS:true,
            backgroundColor:null
        });


        const link =
        document.createElement("a");


        link.download =
        "card.png";


        link.href =
        canvas.toDataURL("image/png");


        link.click();


    });


}


carregarCardHTML();



window.abrirCard=function(skill){


    document.getElementById(
        "card-modal"
    ).style.display="flex";


    document.getElementById("card-img").src =
    `https://res.cloudinary.com/djh45admn/image/upload/v1781908673/${skill.img}.jpg`;



    document.getElementById("card-nome").innerText =
    skill.nome || "-";



    const ranks={

        1:"INICIANTE",
        2:"APRENDIZ",
        3:"NOVATO",
        4:"INTERMEDIÁRIO",
        5:"VETERANO"

    };



    function atualizarAtributo(id,nome,valor){


        const el =
        document.getElementById(id);


        if(valor !== undefined && valor !== null && valor !== ""){


            el.style.display="";
            el.innerText =
            `${nome} ${valor}`;


        }else{


            el.style.display="none";


        }


    }



    atualizarAtributo(
        "card-atk",
        "ATK",
        skill.atributos?.atk
    );


    atualizarAtributo(
        "card-def",
        "DEF",
        skill.atributos?.def
    );


    atualizarAtributo(
        "card-stm",
        "STM",
        skill.atributos?.stm
    );


    atualizarAtributo(
        "card-pow",
        "POW",
        skill.atributos?.pow
    );



    const rank =
    document.getElementById("card-rank");



    if(skill.rank){


        rank.style.display="";
        rank.innerText =
        ranks[skill.rank] || skill.rank;


    }else{


        rank.style.display="none";


    }


};
