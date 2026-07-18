console.log("FICHA.JS CARREGOU");


const fichaContainer = document.getElementById("ficha-container");
let skillAtual = null;



async function carregarFichaHTML(){

    if(!fichaContainer){

        console.log("ERRO: ficha-container não encontrado");

        return;

    }


    const res = await fetch(
      location.pathname.includes("/guia/")
      ? "../perfil/ficha.html"
      : "perfil/ficha.html"
    );

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

    const img =
        document.getElementById("ficha-img");

        img?.addEventListener("click", () => {

            if(window.abrirCard && skillAtual){

                window.abrirCard(skillAtual);

            }

        });

}


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






window.abrirFicha = async function(
    skill,
    mostrarCusto = true,
    mostrarComprar = true
){


    if(!document.getElementById("ficha-modal")){

        await carregarFichaHTML();

    }


    skillAtual = skill;
    window.skillAtual = skill;

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
    // RANK DA SKILL
    // =====================

    const rankEl = document.getElementById("ficha-rank");
    const rankValor = document.getElementById("ficha-rank-valor");


    const nomesRank = {
        1: "INICIANTE",
        2: "APRENDIZ",
        3: "NOVATO",
        4: "INTERMEDIÁRIO",
        5: "VETERANO"
    };


    if(skill.rank){

        rankValor.innerText =
        nomesRank[skill.rank] || skill.rank;

        rankEl.style.display = "";

    }else{

        rankEl.style.display = "none";

    }

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

   const priceBox =
   document.querySelector("#ficha-modal .price-box");

   const fichaBottom =
   document.querySelector("#ficha-modal .ficha-bottom");

   const buyBtn =
   document.querySelector("#ficha-modal #ficha-buy-btn");


   if(priceBox){

       if(mostrarCusto){
           priceBox.style.display = "flex";
       }else{
           priceBox.style.display = "none";
       }

   }


   if(buyBtn){

    if(mostrarComprar){

        buyBtn.style.display = "block";

        buyBtn.onclick = () => {

            document
                .getElementById("confirm-skill-modal")
                .style.display = "flex";

        };

    }else{

        buyBtn.style.display = "none";
        buyBtn.onclick = null;

    }

}

    if(fichaBottom){

        if(!mostrarCusto && !mostrarComprar){

            fichaBottom.style.display = "none";

        }else{

            fichaBottom.style.display = "flex";

        }

    }
    
};
