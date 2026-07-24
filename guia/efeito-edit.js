import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getDatabase,
    ref,
    get,
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

let listaEfeitosFirebase = {};

function carregarExtrasEdit(efeito){

    const area =
    document.getElementById("extras-edit-area");

    if(!area) return;

    area.innerHTML = "";

    let extras = [];

    if(Array.isArray(efeito.extras)){

        extras = efeito.extras;

    }else if(
    efeito.extras &&
    typeof efeito.extras === "object"
){

    extras = Object.keys(efeito.extras);

    }else if(efeito.extras){

        extras = [efeito.extras];

    }

    extras.forEach(extra=>{

        criarSelectExtra(extra);

    });

}

function criarSelectExtra(valor=""){

    const area =
    document.getElementById("extras-edit-area");

    const row =
    document.createElement("div");

    row.className =
    "efeito-edit-row";

    let options = `
<option value="">
Escolher efeito
</option>
`;

    Object.entries(listaEfeitosFirebase)
    .forEach(([uid, efeito])=>{

        options += `
<option value="${uid}">
${efeito.nome}
</option>
`;

    });

    row.innerHTML = `
<select class="extra-select">

${options}

</select>

<button
class="remove-efeito-edit">
×
</button>
`;

    row.querySelector("select").value = valor;

    row.querySelector(".remove-efeito-edit").onclick = ()=>{

        row.remove();

    };

    area.appendChild(row);

}


console.log("EFEITO-EDIT JS CARREGOU");

async function carregarListaEfeitos(){

    const snap = await get(
        ref(db,"efeitos")
    );

    if(!snap.exists()) return;

    listaEfeitosFirebase = snap.val();

}



async function carregarEfeitoEditHTML(){


const res = await fetch(
"efeito-edit.html"
);


document.body.insertAdjacentHTML(
"beforeend",
await res.text()
);



document
.getElementById("close-efeito-edit")
.onclick = fecharEfeitoEdit;



document
.getElementById("salvar-efeito-edit")
.onclick = salvarEfeitoEdit;



document
.getElementById("upload-efeito-img-btn")
.onclick = ()=>{

document
.getElementById("upload-efeito-img-input")
.click();

};



document
.getElementById("upload-efeito-img-input")
.onchange = uploadImagem;

document
.getElementById("add-extra-edit")
.onclick = ()=>{

    criarSelectExtra();

};


}




window.abrirEfeitoEdit = async function(){


const efeito =
window.efeitoAtual;



if(!document.getElementById("efeito-edit")){

    await carregarEfeitoEditHTML();

}

await carregarListaEfeitos();


if(!efeito){

console.log("Nenhum efeito");

return;

}



document
.getElementById("efeito-edit")
.style.display="flex";




if(efeito.img){


document
.getElementById("efeito-edit-img")
.src =
`https://res.cloudinary.com/djh45admn/image/upload/${efeito.img}`;


}else{


document
.getElementById("efeito-edit-img")
.src="";


}



document
.getElementById("efeito-edit-nome")
.value =
efeito.nome || "";



document
.getElementById("efeito-edit-description")
.value =
efeito.description || "";



document
.getElementById("efeito-edit-funcionamento")
.value =
efeito.funcionamento || "";



carregarExtrasEdit(efeito);



}




function fecharEfeitoEdit(){


document
.getElementById("efeito-edit")
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



formData.append(
"folder",
"Grand Line RPG/Efeitos"
);



try{


const res = await fetch(

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



if(!data.secure_url){

console.error(data);

return;

}



window.efeitoAtual.img =
data.public_id;



document
.getElementById("efeito-edit-img")
.src =
data.secure_url;



}catch(err){

console.error(
"Erro upload:",
err
);

}



}




async function salvarEfeitoEdit(){


const efeito =
window.efeitoAtual;



efeito.nome =
document
.getElementById("efeito-edit-nome")
.value;



efeito.description =
document
.getElementById("efeito-edit-description")
.value;



efeito.funcionamento =
document
.getElementById("efeito-edit-funcionamento")
.value;



const extras = [];

document
.querySelectorAll(".extra-select")
.forEach(select=>{

    if(select.value){

        extras.push(select.value);

    }

});

efeito.extras = extras;




await update(

ref(
db,
`efeitos/${efeito.id}`
),

efeito

);



console.log(
"Efeito salvo:",
efeito
);



fecharEfeitoEdit();


}
