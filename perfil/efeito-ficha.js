import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getDatabase,
    ref,
    get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


const app = getApp();
const db = getDatabase(app);



window.abrirEfeitoFicha = async function(id){


    const snap = await get(
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
    .innerText = efeito.nome || "-";


    document.getElementById("efeito-emoji")
    .innerText = efeito.emoji || "❔";


    document.getElementById("efeito-desc")
    .innerText = efeito.description || "";


    document.getElementById("efeito-func")
    .innerText = efeito.funcionamento || "";

}
