console.log("FICHA.JS CARREGOU");


window.abrirFicha = function(skill){

    console.log("ABRINDO FICHA:", skill);


    const modal = document.getElementById("ficha-modal");

    if(!modal){

        console.log("ERRO: ficha-modal não encontrado");

        return;

    }


    modal.style.display = "flex";


    const img =
    document.getElementById("ficha-img");

    const nome =
    document.getElementById("ficha-nome");

    const description =
    document.getElementById("ficha-description");

    const alcance =
    document.getElementById("ficha-alcance");

    const alvos =
    document.getElementById("ficha-alvos");

    const degradation =
    document.getElementById("ficha-degradation");

    const antidodge =
    document.getElementById("ficha-antidodge");


    if(img){

        img.src =
        `https://res.cloudinary.com/djh45admn/image/upload/v1781908673/${skill.img}.jpg`;

    }


    if(nome){

        nome.innerText =
        skill.nome || "-";

    }


    if(description){

        description.innerText =
        skill.description || "-";

    }


    if(alcance){

        alcance.innerText =
        skill.alcance || "-";

    }


    if(alvos){

        alvos.innerText =
        skill.alvos || "-";

    }


    if(degradation){

        degradation.innerText =
        skill.degradation || "-";

    }


    if(antidodge){

        antidodge.innerText =
        skill.antiDodging || "-";

    }

};



document
.getElementById("close-ficha")
?.addEventListener("click",()=>{


    const modal =
    document.getElementById("ficha-modal");


    if(modal){

        modal.style.display = "none";

    }


});
