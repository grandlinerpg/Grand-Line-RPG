import {
    getDatabase,
    ref,
    get
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


const db = getDatabase();


const efeitoContainer =
document.getElementById("efeito-container");



async function carregarEfeitoHTML(){

    if(!efeitoContainer) return;


    if(document.getElementById("efeito-modal")) return;


    const res =
    await fetch("efeito.html");


    const html =
    await res.text();


    efeitoContainer.insertAdjacentHTML(
        "beforeend",
        html
    );


    const close =
    document.getElementById("close-efeito");


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



    document.getElementById("m-title")
    .innerText =
    efeito.nome || "-";



    document.getElementById("m-desc")
    .innerText =
    efeito.description || "";



    document.getElementById("m-func")
    .innerText =
    efeito.funcionamento || "";



    document.getElementById("m-extras")
    .innerText =
    efeito.extras || "";



    const img =
    document.getElementById("m-img");


    if(img){

        img.src =
        `https://res.cloudinary.com/djh45admn/image/upload/v1784283109/${efeito.img}.jpg`;

    }


};
