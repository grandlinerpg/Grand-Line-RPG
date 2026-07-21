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
    mostrarComprar = true,
    skillUid = null,
    categoria = "",
    sub = ""
){


    if(!document.getElementById("ficha-modal")){

        await carregarFichaHTML();

    }


    skillAtual = skill;
    window.skillAtual = skill;
    window.skillUid = skillUid;
    window.skillCategoria = categoria;
    window.skillSub = sub;

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
    // CUSTO DA SKILL
    // =====================

    const cost =
    document.getElementById("ficha-cost");

    if(cost){

        cost.innerText =
        `${skill.custo || 0} PTS`;

    }

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


    // STM sempre
    atualizarAtributo(
        "atributo-stm",
        "ficha-stm",
        skill.atributos?.stm ?? base.stm ?? "-"
    );


    // ATK somente ofensivo
    atualizarAtributo(
        "atributo-atk",
        "ficha-atk",
        skill.categoria === "Ofensivo"
        ? (skill.atributos?.atk ?? base.atk ?? "-")
        : null
    );


    // DEF somente defensivo
    atualizarAtributo(
        "atributo-def",
        "ficha-def",
        skill.categoria === "Defensivo"
        ? (skill.atributos?.def ?? base.def ?? "-")
        : null
    );


    // POW manual
    atualizarAtributo(
        "atributo-pow",
        "ficha-pow",
        skill.atributos?.pow ?? "-"
    );



    // =====================
    // COOLDOWN PADRÃO POR RANK
    // =====================

    const cooldownRank = {

        1:1,
        2:2,
        3:3,
        4:4,
        5:5

    };


    const cooldownBase =
    cooldownRank[skill.rank] ?? "-";


    atualizarLinha(
        "linha-cooldown",
        "ficha-cooldown",
        skill.cooldown ?? cooldownBase
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
