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

let listaAtividadesFirebase = {};



function carregarExtrasEdit(atividade){

    const area =
    document.getElementById("atividade-extras-edit-area");

    if(!area) return;

    area.innerHTML = "";

    let extras = [];

    if(Array.isArray(atividade.extras)){

        extras = atividade.extras;

    }else if(atividade.extras){

        extras = [atividade.extras];

    }

    if(extras.length === 0){

        criarExtraTexto();

        return;

    }

    extras.forEach(extra=>{

        criarExtraTexto(extra);

    });

}



function criarExtraTexto(valor=""){

    const area =
    document.getElementById("atividade-extras-edit-area");

    const row =
    document.createElement("div");

    row.className =
    "efeito-edit-row";

    row.innerHTML = `
<textarea
class="extra-text"
placeholder="Digite um extra...">${valor}</textarea>

<button
class="remove-efeito-edit"
type="button">
×
</button>
`;

    row.querySelector(".remove-efeito-edit").onclick = ()=>{

        row.remove();

    };

    area.appendChild(row);

}



console.log("ATIVIDADE-EDIT JS CARREGOU");



async function carregarListaAtividades(){

    const snap = await get(
        ref(
            db,
            `faccoes/${window.faccaoAtualId}/atividades`
        )
    );

    if(!snap.exists()) return;

    listaAtividadesFirebase = snap.val();

}



async function carregarAtividadeEditHTML(){


    const res = await fetch(
        "atividade-edit.html"
    );


    document.body.insertAdjacentHTML(
        "beforeend",
        await res.text()
    );



    document
    .getElementById("close-atividade-edit")
    .onclick = fecharAtividadeEdit;



    document
    .getElementById("salvar-atividade-edit")
    .onclick = salvarAtividadeEdit;



    document
    .getElementById("upload-atividade-img-btn")
    .onclick = ()=>{

        document
        .getElementById("upload-atividade-img-input")
        .click();

    };



    document
    .getElementById("upload-atividade-img-input")
    .onchange = uploadImagem;



    document
    .getElementById("add-atividade-extra-edit")
    .onclick = ()=>{

        criarExtraTexto();

    };

}



window.abrirAtividadeEdit = async function(){


    const atividade =
    window.atividadeAtual;


    if(!document.getElementById("atividade-edit")){

        await carregarAtividadeEditHTML();

    }


    await carregarListaAtividades();


    if(!atividade){

        console.log("Nenhuma atividade");

        return;

    }


    document
    .getElementById("atividade-edit")
    .style.display="flex";


    if(atividade.img){

        document
        .getElementById("atividade-edit-img")
        .src =
        `https://res.cloudinary.com/djh45admn/image/upload/${atividade.img}`;

    }else{

        document
        .getElementById("atividade-edit-img")
        .src="";

    }


    document
    .getElementById("atividade-edit-nome")
    .value =
    atividade.nome || "";


    document
    .getElementById("atividade-edit-description")
    .value =
    atividade.description || "";


    document
    .getElementById("atividade-edit-funcionamento")
    .value =
    atividade.funcionamento || "";


    document
    .getElementById("atividade-edit-dinheiro")
    .value =
    atividade.recompensa?.dinheiro || 0;


    document
    .getElementById("atividade-edit-exp")
    .value =
    atividade.recompensa?.exp || 0;


    carregarExtrasEdit(atividade);

}



function fecharAtividadeEdit(){

    document
    .getElementById("atividade-edit")
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
"Grand Line RPG/Atividades"
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



window.atividadeAtual.img =
data.public_id;



document
.getElementById("atividade-edit-img")
.src =
data.secure_url;



}catch(err){

console.error(
"Erro upload:",
err
);

}


}




async function salvarAtividadeEdit(){


const atividade =
window.atividadeAtual;



atividade.nome =
document
.getElementById("atividade-edit-nome")
.value;



atividade.description =
document
.getElementById("atividade-edit-description")
.value;



atividade.funcionamento =
document
.getElementById("atividade-edit-funcionamento")
.value;



const extras = [];

document
.querySelectorAll(".extra-text")
.forEach(textarea=>{

    const texto =
    textarea.value.trim();

    if(texto){

        extras.push(texto);

    }

});

atividade.extras = extras;



atividade.recompensa = {

    dinheiro:Number(

        document
        .getElementById("atividade-edit-dinheiro")
        .value

    ) || 0,

    exp:Number(

        document
        .getElementById("atividade-edit-exp")
        .value

    ) || 0

};



await update(

    ref(

        db,

        `faccoes/${window.faccaoAtualId}/atividades/${window.atividadeAtualId}`

    ),

    atividade

);



console.log(
"Atividade salva:",
atividade
);



fecharAtividadeEdit();


}
