console.log("CARD-CHAR.JS CARREGOU");

const personagemContainer =
document.getElementById("personagem-container");

async function carregarCharHTML(){

    if(!personagemContainer) return;

    const res =
    await fetch(
        location.pathname.includes("/guia/")
        ? "../perfil/card-char.html"
        : "perfil/card-char.html"
    );

    personagemContainer.insertAdjacentHTML(
        "beforeend",
        await res.text()
    );


    // ======================
    // FECHAR
    // ======================

    document
    .getElementById("close-personagem")
    ?.addEventListener("click",()=>{

        document
        .getElementById("personagem-modal")
        .style.display="none";

    });


    // ======================
    // UPLOAD IMAGEM
    // ======================

    document
    .getElementById("upload-img")
    ?.addEventListener("change",(e)=>{

        const file = e.target.files[0];

        if(file){

            document
            .getElementById("personagem-img")
            .src = URL.createObjectURL(file);

        }

    });


    // ======================
    // DOWNLOAD
    // ======================

    document
    .getElementById("download-personagem")
    ?.addEventListener("click",async()=>{

        const card =
        document.querySelector(".personagem-image-area");

        const canvas =
        await html2canvas(card,{
            scale:3,
            useCORS:true,
            backgroundColor:null
        });

        const link =
        document.createElement("a");

        link.download="personagem.png";
        link.href=canvas.toDataURL("image/png");
        link.click();

    });

}

carregarCharHTML();



// ===================================================
// ABRIR CARD
// ===================================================

window.abrirPersonagem=function(data){

    document
    .getElementById("personagem-modal")
    .style.display="flex";

    const character =
    data.character || {};

    const stats =
    data.stats || {};


    // ======================
    // NOME
    // ======================

    document
    .getElementById("personagem-nome")
    .innerText =
    character.charName || "-";


    // ======================
    // IMAGEM
    // ======================

    const personagem =
    (character.charName || "default")
    .toLowerCase()
    .replaceAll(" ","-")
    .replaceAll(".","")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"");

    const img =
    document.getElementById("personagem-img");


    img.src =
    `https://res.cloudinary.com/djh45admn/image/upload/v1778334616/${personagem}.png`;


    img.onerror=function(){

        this.src =
        "https://res.cloudinary.com/djh45admn/image/upload/v1778336777/sem-personagem.png";

    };


    // ======================
    // RANK
    // ======================

    const ranks={

        1:"INICIANTE",
        2:"APRENDIZ",
        3:"NOVATO",
        4:"INTERMEDIÁRIO",
        5:"VETERANO"

    };

    document
    .getElementById("personagem-rank")
    .innerText=
    ranks[character.rank] || "-";


    // ======================
    // ATRIBUTOS
    // ======================

    document
    .getElementById("personagem-for")
    .innerText=
    "FOR: " + (stats.str || 0);

    document
    .getElementById("personagem-res")
    .innerText=
    "RES: " + (stats.res || 0);

    document
    .getElementById("personagem-dex")
    .innerText=
    "DEX: " + (stats.dex || 0);

    document
    .getElementById("personagem-agi")
    .innerText=
    "AGI: " + (stats.agi || 0);

    document
    .getElementById("personagem-stm")
    .innerText=
    "STM: " + (stats.sta || 0);

    document
    .getElementById("personagem-hp")
    .innerText=
    "HP: " + (stats.hp || 0);

};
