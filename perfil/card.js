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

    // =====================
    // VALORES PADRÃO POR RANK
    // =====================

    const atributosRank = {

        1:{
            stm:100,
            atk:100,
            def:100
        },

        2:{
            stm:250,
            atk:250,
            def:250
        },

        3:{
            stm:500,
            atk:500,
            def:500
        },

        4:{
            stm:1000,
            atk:1000,
            def:1000
        },

        5:{
            stm:2000,
            atk:2000,
            def:2000
        }

    };

    const base = atributosRank[skill.rank] || {};

    function pegarAtributo(valor, padrao){

        if(valor === 0){
            return null;
        }

        if(valor === "" || valor === undefined || valor === null){
            return padrao;
        }

        return valor;
    
    }

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


    // ATK somente ofensivo
    atualizarAtributo(
        "card-atk",
        "ATK:",
        skill.categoria === "Ofensivo"
        ? pegarAtributo(skill.atributos?.atk, base.atk)
        : null
    );


    // DEF somente defensivo
    atualizarAtributo(
        "card-def",
        "DEF:",
        skill.categoria === "Defensivo"
        ? pegarAtributo(skill.atributos?.def, base.def)
        : null
    );


    // STM sempre
    atualizarAtributo(
        "card-stm",
        "STM:",
        pegarAtributo(skill.atributos?.stm, base.stm)
    );

    atualizarAtributo(
        "card-pow",
        "POW:",
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
