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

        const modal =
        document.getElementById("ficha-modal");


        if(modal){

            modal.style.display = "none";

        }

    });

}



carregarFichaHTML();





function atualizarLinha(idLinha, idTexto, valor){

    const linha =
    document.getElementById(idLinha);


    const texto =
    document.getElementById(idTexto);



    if(!linha || !texto) return;



    if(valor !== undefined && valor !== null && valor !== ""){

        texto.innerText = valor;

        linha.style.display = "";

    }else{

        linha.style.display = "none";

    }

}






window.abrirFicha = function(skill){

    console.log("ABRINDO FICHA:", skill);



    const modal =
    document.getElementById("ficha-modal");



    if(!modal){

        console.log("ERRO: ficha-modal não encontrado");

        return;

    }



    modal.style.display = "flex";



    // reseta linhas escondidas de outra skill

    document
    .querySelectorAll(".ficha-table tr")
    .forEach(linha=>{

        linha.style.display = "";

    });

    document
    .querySelectorAll(".ficha-atributo")
    .forEach(attr=>{
        attr.style.display = "";
    });





    const img =
    document.getElementById("ficha-img");


    if(img){

        img.src =
        `https://res.cloudinary.com/djh45admn/image/upload/v1781908673/${skill.img}.jpg`;

    }





    document.getElementById("ficha-nome").innerText =
    skill.nome || "-";



    document.getElementById("ficha-description").innerText =
    skill.description || "-";


    // =====================
    // ATRIBUTOS DA SKILL
    // =====================

    function atualizarAtributo(idBloco, idTexto, valor){

        const bloco = document.getElementById(idBloco);
        const texto = document.getElementById(idTexto);

        if(!bloco || !texto) return;


        if(valor !== undefined && valor !== null && valor !== ""){

            texto.innerText = valor;
            bloco.style.display = "";

        }else{

            texto.innerText = "";
            bloco.style.display = "none";

        }

    }


    atualizarAtributo(
        "atributo-atk",
        "ficha-atk",
        skill.atributos?.atk
    );


    atualizarAtributo(
        "atributo-def",
        "ficha-def",
        skill.atributos?.def
    );


    atualizarAtributo(
        "atributo-pow",
        "ficha-pow",
        skill.atributos?.pow
    );


    atualizarAtributo(
        "atributo-stm",
        "ficha-stm",
        skill.atributos?.stm
    );            


    atualizarLinha(
        "linha-cooldown",
        "ficha-cooldown",
        skill.cooldown
    );



    atualizarLinha(
        "linha-categoria",
        "ficha-categoria",
        skill.categoria
    );



    atualizarLinha(
        "linha-propriedade",
        "ficha-propriedade",
        skill.propriedade
    );



    atualizarLinha(
        "linha-alcance",
        "ficha-alcance",
        skill.alcance
    );



    atualizarLinha(
        "linha-alvos",
        "ficha-alvos",
        skill.alvos
    );



    atualizarLinha(
        "linha-degradation",
        "ficha-degradation",
        skill.degradation
    );



    atualizarLinha(
        "linha-antidodging",
        "ficha-antidodging",
        skill.antidodging
    );

};
