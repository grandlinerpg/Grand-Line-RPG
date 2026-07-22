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

    // =========================
// EDITOR DO CARD
// =========================


document.querySelectorAll(".color-picker").forEach(botao=>{


    botao.addEventListener("click",(e)=>{

        e.stopPropagation();


        const menu =
        botao.parentElement.querySelector(".color-menu");


        document.querySelectorAll(".color-menu")
        .forEach(m=>{

            if(m !== menu)
                m.style.display="none";

        });


        if(menu){

            menu.style.display =
            menu.style.display==="grid"
            ? "none"
            : "grid";

        }


    });


});





document.querySelectorAll(".color-menu button")
.forEach(cor=>{


    cor.addEventListener("click",()=>{


        const menu =
        cor.parentElement;


        const botao =
        menu.parentElement.querySelector(".color-picker");


        botao.style.background =
        cor.dataset.color;



        const alvo =
        botao.dataset.target;



        if(alvo==="nome"){


            document.getElementById("card-nome")
            .style.color =
            cor.dataset.color;


        }


        if(alvo==="atributo"){


            document.querySelector(".card-atributos")
            .style.color =
            cor.dataset.color;


        }



        menu.style.display="none";


    });


});





// =========================
// FONTES
// =========================


document.getElementById("fonte-nome")
?.addEventListener("change",function(){


    document.getElementById("card-nome")
    .style.fontFamily =
    this.value;


});




document.getElementById("fonte-atributo")
?.addEventListener("change",function(){


    document.querySelector(".card-atributos")
    .style.fontFamily =
    this.value;


});

// =========================
// TAMANHO DAS FONTES
// =========================


document.getElementById("tamanho-nome")
?.addEventListener("change",function(){

    document.getElementById("card-nome")
    .style.fontSize =
    this.value;

});



document.getElementById("tamanho-atributo")
?.addEventListener("change",function(){

    document.querySelector(".card-atributos")
    .style.fontSize =
    this.value;

});

// =========================
// POSIÇÃO DO CARD
// =========================

function mudarPosicaoCard(valor){

    const area =
    document.querySelector(".card-image-area");


    if(!area) return;


    area.classList.remove(
        "posicao-1",
        "posicao-2",
        "posicao-3",
        "posicao-4",
        "posicao-5",
        "posicao-6"
    );


    area.classList.add(
        "posicao-" + valor
    );

}


// mudança pelo menu

document.getElementById("posicao-card")
?.addEventListener("change",function(){

    mudarPosicaoCard(this.value);

});


// posição inicial

mudarPosicaoCard(1);

    // =========================
// BOTÃO EDITAR
// =========================

document
.getElementById("editar-card")
?.addEventListener("click",()=>{

    const editor =
    document.querySelector(".card-editor");


    if(editor.style.display === "block"){

        editor.style.display="none";

    }else{

        editor.style.display="block";

    }

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
            `${nome} ${Number(valor).toLocaleString("pt-BR")}`;

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
