import {
    getApp
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";


import {
    getDatabase,
    ref,
    get
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


const app = getApp();

const db = getDatabase(app);



const atividadeContainer =
document.getElementById("atividade-container");




async function carregarAtividadeHTML(){


    if(!atividadeContainer) return;


    if(document.getElementById("atividade-modal")) return;



    const caminhoAtividade =
    window.location.pathname.includes("/guia/")
    ? "atividade.html"
    : "guia/atividade.html";



    const res =
    await fetch(caminhoAtividade);



    const html =
    await res.text();



    atividadeContainer.insertAdjacentHTML(
        "beforeend",
        html
    );



    const close =
    document.querySelector(".efeito-close");



    close?.addEventListener("click",()=>{


        document
        .getElementById("atividade-modal")
        .style.display="none";


    });


}





window.abrirAtividade = async function(
    atividadeId,
    faccaoId
){


    await carregarAtividadeHTML();



    const snap =
    await get(
        ref(
            db,
            `faccoes/${faccaoId}/atividades/${atividadeId}`
        )
    );



    if(!snap.exists()){

        console.log(
            "Atividade não encontrada:",
            atividadeId
        );

        return;

    }



    const atividade =
    snap.val();



    const modal =
    document.getElementById("atividade-modal");



    modal.style.display="flex";





    document.querySelector(".efeito-title")
    .innerText =
    atividade.nome || "-";





    document.querySelector(".efeito-desc")
    .innerText =
    atividade.description || "";





    document.querySelector(".efeito-info")
    .innerText =
    atividade.funcionamento || "";





    const extras =
    document.querySelector(".efeito-extras");



    extras.innerHTML = "";



    Object.values(atividade.extras || {})
    .forEach(extra=>{


        extras.innerHTML += `

            <div class="efeito-extra-box">

                ${extra}

            </div>

        `;


    });





    const img =
    document.querySelector(".efeito-img");



    if(img){


        if(atividade.img){


            img.src =
            `https://res.cloudinary.com/djh45admn/image/upload/v1784283109/${atividade.img}.jpg`;


            img.style.display="block";


        }else{


            img.style.display="none";


        }


    }





    // RECOMPENSA


    const saldo =
    document.querySelector(".recompensa-saldo");


    const exp =
    document.querySelector(".recompensa-exp");



    if(saldo){

        saldo.innerText =
        atividade.recompensa?.dinheiro || 0;

    }



    if(exp){

        exp.innerText =
        atividade.recompensa?.exp || 0;

    }





    // EDITAR


    const editBtn =
    document.querySelector(".efeito-edit-btn");



    if(editBtn){


        const podeEditar =
        await verificarPermissao(3);



        if(podeEditar){


            editBtn.style.display="block";



            editBtn.onclick = ()=>{


                window.atividadeAtual =
                atividade;


                abrirAtividadeEdit();


            };


        }else{


            editBtn.style.display="none";

            editBtn.onclick=null;


        }


    }



};
