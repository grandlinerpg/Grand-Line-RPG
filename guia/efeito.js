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


const efeitoContainer =
document.getElementById("efeito-container");



async function carregarEfeitoHTML(){

    if(!efeitoContainer) return;


    if(document.getElementById("efeito-modal")) return;


    const caminhoEfeito =
    window.location.pathname.includes("/guia/")
    ? "efeito.html"
    : "guia/efeito.html";


    const res =
    await fetch(caminhoEfeito);

    const html =
    await res.text();


    efeitoContainer.insertAdjacentHTML(
        "beforeend",
        html
    );


    const close =
    document.querySelector(".efeito-close");


    close?.addEventListener("click",()=>{

        document
        .getElementById("efeito-modal")
        .style.display="none";

    });

}



window.abrirEfeito = async function(id){


    await carregarEfeitoHTML();



    const snap =
    await get(
        ref(db,"efeitos/"+id)
    );


    if(!snap.exists()){

        console.log("Efeito não encontrado:", id);
        return;

    }



    const efeito =
    snap.val();



    const modal =
    document.getElementById("efeito-modal");


    modal.style.display="flex";



    document.querySelector(".efeito-title")
    .innerText =
    efeito.nome || "-";



    document.querySelector(".efeito-desc")
    .innerText =
    efeito.description || "";



    document.querySelector(".efeito-func")
    .innerText =
    efeito.funcionamento || "";



    document.querySelector(".efeito-extras")
    .innerText =
    efeito.extras || "";



    const img =
    document.querySelector(".efeito-img");


    if(img){

        img.src =
        `https://res.cloudinary.com/djh45admn/image/upload/v1784283109/${efeito.img}.jpg`;

    }



    document.querySelector(".efeito-edit-btn")
    .onclick = ()=>{

        window.efeitoAtual = efeito;

        abrirEfeitoEdit();

    };


};
