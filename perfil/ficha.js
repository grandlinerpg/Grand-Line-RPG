import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getDatabase,
    ref,
    get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


const app = getApp();
const db = getDatabase(app);

window.abrirEfeitoFicha = async function(id){


    const snap =
    await get(
        ref(db,"efeitos/"+id)
    );


    if(!snap.exists()){

        console.log("Efeito não encontrado");
        return;

    }


    const efeito = snap.val();



    document.getElementById("efeito-modal")
    .style.display = "flex";


    document.getElementById("efeito-nome")
    .innerText =
    efeito.nome || "-";


    document.getElementById("efeito-emoji")
    .innerText =
    efeito.emoji || "✨";


    document.getElementById("efeito-desc")
    .innerText =
    efeito.description || "";


    document.getElementById("efeito-func")
    .innerText =
    efeito.funcionamento || "";


};


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

async function carregarEfeitos(skill){

    const efeitoBox =
    document.getElementById("ficha-efeitoss");


    if(!efeitoBox){
        console.log("ERRO: ficha-efeitoss não existe");
        return;
    }


    efeitoBox.innerHTML = "";


    if(!skill.efeito || skill.efeito.length === 0){

        efeitoBox.style.display = "none";
        return;

    }


    let listaEfeitos = [];


    // NOVO FORMATO ARRAY
    if(Array.isArray(skill.efeito)){

        listaEfeitos = skill.efeito;

    }
    // COMPATIBILIDADE COM ANTIGO
    else if(typeof skill.efeito === "object"){

        listaEfeitos = Object.keys(skill.efeito);

    }
    else{

        listaEfeitos = [skill.efeito];

    }



    for(const id of listaEfeitos){


        const efeitoRef =
        ref(db,"efeitos/"+id);



        const snap =
        await get(efeitoRef);



        if(snap.exists()){


            const efeito = snap.val();


            const span =
            document.createElement("span");


            span.innerHTML =
            efeito.emoji || "❔";


            span.title =
            efeito.nome || "";


            // ABRIR FICHA DO EFEITO AO CLICAR
            span.style.cursor = "pointer";

            span.onclick = ()=>{

                if(window.abrirEfeitoFicha){

                    window.abrirEfeitoFicha(id);

                }else{

                    console.log("efeito-ficha.js não carregou");

                }

            };


            efeitoBox.appendChild(span);


                    }

                }



                if(efeitoBox.children.length > 0){

                    efeitoBox.style.display = "flex";

                }else{

                    efeitoBox.style.display = "none";

                }

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
    mostrarEditar = false,
    skillUid = null,
    bancoCategoria = "",
    sub = ""
){


    if(!document.getElementById("ficha-modal")){

        await carregarFichaHTML();

    }


    skillAtual = skill;
    window.skillAtual = skill;
    window.skillUid = skillUid;
    window.skillCategoria = bancoCategoria;
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
    // EFEITO DA SKILL
    // =====================

    carregarEfeitos(skill);

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

            texto.innerText = Number(valor).toLocaleString("pt-BR");
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
        skill.atributos?.stm !== ""
            ? (skill.atributos?.stm ?? base.stm)
            : base.stm
    );


    // ATK somente ofensivo
    atualizarAtributo(
        "atributo-atk",
        "ficha-atk",
        skill.categoria === "Ofensivo"
        ? (
            skill.atributos?.atk !== ""
                ? (skill.atributos?.atk ?? base.atk)
                : base.atk
        )
        : null
    );


    // DEF somente defensivo
    atualizarAtributo(
        "atributo-def",
        "ficha-def",
        skill.categoria === "Defensivo"
        ? (
            skill.atributos?.def !== ""
                ? (skill.atributos?.def ?? base.def)
                : base.def
        )        
        : null
    );


    // POW manual
    atualizarAtributo(
        "atributo-pow",
        "ficha-pow",
        skill.atributos?.pow
    );



    const cooldownRank = {
        1: 1,
        2: 2,
        3: 3,
        4: 4,
        5: 5
    };

    let cooldownValor;

    console.log(skill);
    console.log("Categoria:", skill.categoria);
    console.log("Cooldown:", skill.cooldown);
    if (skill.categoria === "Equipamento") {

        // Equipamentos não usam cooldown padrão
        cooldownValor = skill.cooldown || "";
    
    } else {

        const cooldownBase = cooldownRank[skill.rank] ?? "-";
    
        cooldownValor =
            skill.cooldown !== ""
                ? (skill.cooldown ?? cooldownBase)
                : cooldownBase;

    }

    atualizarLinha(
        "linha-cooldown",
        "ficha-cooldown",
        cooldownValor
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

   const editBtn =
   document.querySelector("#ficha-modal #ficha-edit-btn");


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

    if(editBtn){

        if(mostrarEditar){

            editBtn.style.display = "block";

            editBtn.onclick = () => {

                if(window.abrirFichaEdit){

                    window.abrirFichaEdit();

                }else{

                    console.log("ficha-edit.js não carregou");

                }

            };


        }else{

            editBtn.style.display = "none";
            editBtn.onclick = null;

        }

    }
    
    if(fichaBottom){

        if(!mostrarCusto && !mostrarComprar && !mostrarEditar){

            fichaBottom.style.display = "none";

        }else{

            fichaBottom.style.display = "flex";

        }

    }
    
};
