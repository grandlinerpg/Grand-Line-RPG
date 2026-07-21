import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getDatabase,
    ref,
    update
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyC4kgy_L79WYFqr9XZhoDuZBfqG4AGTVUQ",
    authDomain: "grand-line-rpg-dcda9.firebaseapp.com",
    projectId: "grand-line-rpg-dcda9",
    storageBucket: "grand-line-rpg-dcda9.appspot.com",
    messagingSenderId: "172042779786",
    appId: "1:172042779786:web:ecdff9eaf4fee36eca8173",
    databaseURL: "https://grand-line-rpg-dcda9-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

console.log("FICHA-EDIT JS CARREGOU");

async function carregarFichaEditHTML(){


const container =
document.getElementById("ficha-edit-container");


if(!container) return;



const res = await fetch(
    location.pathname.includes("/guia/")
    ? "../perfil/ficha-edit.html"
    : "perfil/ficha-edit.html"
);


container.innerHTML =
await res.text();



document
.getElementById("close-ficha-edit")
.onclick = fecharFichaEdit;



document
.getElementById("salvar-ficha-edit")
.onclick = salvarFichaEdit;

document
.getElementById("upload-img-btn")
.onclick = ()=>{

    document
    .getElementById("upload-img-input")
    .click();

};


document
.getElementById("upload-img-input")
.onchange = uploadImagem;


}




window.abrirFichaEdit = async function(){

const skill =
window.skillAtual;


if(!document.getElementById("ficha-edit")){

    await carregarFichaEditHTML();

}



if(!skill){

console.log("Nenhuma skill");

return;

}



const modal =
document.getElementById("ficha-edit");


modal.style.display="flex";


if(skill.img){

    document.getElementById("edit-img").src =
    `https://res.cloudinary.com/djh45admn/image/upload/${skill.img}`;

}else{

    document.getElementById("edit-img").src =
    "";

}


document.getElementById("edit-nome").value =
skill.nome || "";


document.getElementById("edit-description").value =
skill.description || "";


document.getElementById("edit-rank").value =
skill.rank || 1;


document.getElementById("edit-categoria").value =
skill.categoria || "";


document.getElementById("edit-propriedade").value =
skill.propriedade || "";


document.getElementById("edit-alcance").value =
skill.alcance || "";


document.getElementById("edit-alvos").value =
skill.alvos || "";


document.getElementById("edit-cooldown").value =
skill.cooldown || "";


}




function fecharFichaEdit(){


document
.getElementById("ficha-edit")
.style.display="none";


}

async function uploadImagem(e){


const file =
e.target.files[0];


if(!file) return;



const formData =
new FormData();


formData.append(
"file",
file
);


formData.append(
"upload_preset",
"grandline-rpg"
);



try{


const res =
await fetch(
"https://api.cloudinary.com/v1_1/djh45admn/image/upload",
{
method:"POST",
body:formData
}
);



const data =
await res.json();



console.log(
"UPLOAD:",
data
);



window.skillAtual.img =
data.public_id;



document
.getElementById("edit-img")
.src =
data.secure_url;



}catch(err){

console.error(
"Erro upload:",
err
);

}


}

function limparUID(nome){

    return nome
    .trim()
    .replace(/[.#$[\]/]/g,"")
    .replace(/\s+/g,"_");

}


async function salvarFichaEdit(){


const skill =
window.skillAtual;



skill.nome =
document.getElementById("edit-nome").value;


skill.description =
document.getElementById("edit-description").value;


skill.rank =
Number(document.getElementById("edit-rank").value);



skill.categoria =
document.getElementById("edit-categoria").value;


skill.propriedade =
document.getElementById("edit-propriedade").value;


skill.alcance =
document.getElementById("edit-alcance").value;


skill.alvos =
document.getElementById("edit-alvos").value;


skill.cooldown =
document.getElementById("edit-cooldown").value;

console.log(
"SKILL EDITADA:",
skill
);

if(!window.skillCategoria || !window.skillSub){

    console.error("Categoria ou estilo faltando:", {
        categoria: window.skillCategoria,
        sub: window.skillSub
    });

    return;

}


// se for uma skill nova cria o UID pelo nome
if(!window.skillUid){

    window.skillUid =
    limparUID(skill.nome);

}

await update(
    ref(
        db,
        `habilidades/${window.skillCategoria}/${window.skillSub}/${window.skillUid}`
    ),
    skill
);

console.log("Skill salva no Firebase!");

fecharFichaEdit();



}
