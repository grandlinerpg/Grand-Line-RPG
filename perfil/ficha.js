console.log("FICHA.JS CARREGOU");


const fichaContainer = document.getElementById("ficha-container");


async function carregarFichaHTML(){

    if(!fichaContainer){

        console.log("ERRO: ficha-container não encontrado");

        return;

    }


    const res = await fetch("perfil/ficha.html");

    const html = await res.text();


    fichaContainer.insertAdjacentHTML(
        "beforeend",
        html
    );


    const closeBtn =
    document.getElementById("close-ficha");


    closeBtn?.addEventListener("click",()=>{

        document
        .getElementById("ficha-modal")
        .style.display = "none";

    });


}


carregarFichaHTML();



window.abrirFicha = function(skill){

    console.log("ABRINDO FICHA:", skill);


    const modal =
    document.getElementById("ficha-modal");


    if(!modal){

        console.log("ERRO: ficha-modal não encontrado");

        return;

    }


    modal.style.display = "flex";


    document.getElementById("ficha-img").src =
    `https://res.cloudinary.com/djh45admn/image/upload/v1781908673/${skill.img}.jpg`;


    document.getElementById("ficha-nome").innerText =
    skill.nome || "-";


    document.getElementById("ficha-description").innerText =
    skill.description || "-";

    document.getElementById("ficha-cooldown").innerText =
    skill.cooldown || "-";
    
    document.getElementById("ficha-categoria").innerText =
    skill.categoria || "-";

    document.getElementById("ficha-propriedade").innerText =
    skill.propriedade || "-";


    document.getElementById("ficha-alcance").innerText =
    skill.alcance || "-";


    document.getElementById("ficha-alvos").innerText =
    skill.alvos || "-";


    document.getElementById("ficha-degradation").innerText =
    skill.degradation || "-";


    document.getElementById("ficha-antidodge").innerText =
    skill.antiDodging || "-";

};
