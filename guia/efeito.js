import {
    initializeApp
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";


import {
    getDatabase,
    ref,
    get
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


const firebaseConfig = {

    apiKey:
    "AIzaSyC4kgy_L79WYFqr9XZhoDuZBfqG4AGTVUQ",

    authDomain:
    "grand-line-rpg-dcda9.firebaseapp.com",

    projectId:
    "grand-line-rpg-dcda9",

    storageBucket:
    "grand-line-rpg-dcda9.appspot.com",

    messagingSenderId:
    "172042779786",

    appId:
    "1:172042779786:web:ecdff9eaf4fee36eca8173",

    databaseURL:
    "https://grand-line-rpg-dcda9-default-rtdb.firebaseio.com"

};


const app =
initializeApp(firebaseConfig);


const db =
getDatabase(app);


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

    document.getElementById("editar-efeito-btn")
    .onclick = ()=>{

        window.efeitoAtual = efeito;

        abrirEfeitoEdit();

    };


};
