import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getDatabase,
    ref,
    get,
    update
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const app = getApp();
const db = getDatabase(app);

let listaEfeitosFirebase = {};

// Precisão base de cada rank de habilidade ofensiva (%)
const PRECISAO_BASE_RANK = { 1: 90, 2: 85, 3: 80, 4: 75, 5: 70 };

function precisaoBase(rank) {
    return PRECISAO_BASE_RANK[Number(rank)] ?? 90;
}

// Categorias que possuem precisão
const CATEGORIAS_COM_PRECISAO = ["Ofensivo", "Defensivo", "Suplementar"];

// Mostra o campo só nas categorias com precisão e atualiza o
// texto da opção "Padrão": base do rank (ofensivas) ou sem precisão
function atualizarCampoPrecisao() {

    const wrap = document.getElementById("edit-precisao-wrap");
    const select = document.getElementById("edit-precisao");

    if (!wrap || !select) return;

    const categoria = document.getElementById("edit-categoria").value;
    const rank = document.getElementById("edit-rank").value;

    wrap.style.display = CATEGORIAS_COM_PRECISAO.includes(categoria) ? "" : "none";

    select.options[0].text = categoria === "Ofensivo"
        ? `Padrão (${precisaoBase(rank)}%)`
        : "Padrão (sem precisão)";

}

console.log("FICHA-EDIT JS CARREGOU");



async function carregarFichaEditHTML() {


    const container =
        document.getElementById("ficha-edit-container");


    if (!container) return;



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
        .onclick = () => {

            document
                .getElementById("upload-img-input")
                .click();

        };


    document
        .getElementById("upload-img-input")
        .onchange = uploadImagem;

    document
        .getElementById("add-efeito-edit")
        .onclick = () => {

            criarSelectEfeito();

        };


}

async function carregarListaEfeitos() {

    const snap = await get(
        ref(db, "efeitos")
    );


    if (!snap.exists()) {

        console.log("Nenhum efeito encontrado");

        return;

    }


    listaEfeitosFirebase = snap.val();

    console.log(
        "Efeitos carregados:",
        listaEfeitosFirebase
    );

}

function carregarEfeitosEdit(skill) {


    const area =
        document.getElementById("efeitos-edit-area");


    if (!area) return;


    area.innerHTML = "";


    let efeitos = [];


    if (Array.isArray(skill.efeito)) {

        efeitos = skill.efeito;

    } else if (typeof skill.efeito === "object") {

        efeitos = Object.keys(skill.efeito);

    } else if (skill.efeito) {

        efeitos = [skill.efeito];

    }



    efeitos.forEach(efeito => {

        criarSelectEfeito(efeito);

    });


}



function criarSelectEfeito(valor = "") {


    const area =
        document.getElementById("efeitos-edit-area");


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
        .forEach(([uid, efeito]) => {


            options += `

<option value="${uid}">
${efeito.nome}
</option>

`;


        });



    row.innerHTML = `

<select class="efeito-select">

${options}

</select>


<button 
class="remove-efeito-edit">
×
</button>

`;



    const select =
        row.querySelector("select");


    // mantém o UID salvo
    select.value = valor;



    row.querySelector(".remove-efeito-edit")
        .onclick = () => {

            row.remove();

        };



    area.appendChild(row);


}



window.abrirFichaEdit = async function () {

    const skill =
        window.skillAtual;


    if (!document.getElementById("ficha-edit")) {

        await carregarFichaEditHTML();

    }



    if (!skill) {

        console.log("Nenhuma skill");

        return;

    }

    await carregarListaEfeitos();


    const modal =
        document.getElementById("ficha-edit");


    modal.style.display = "flex";


    if (skill.img) {

        document.getElementById("edit-img").src =
            `https://res.cloudinary.com/djh45admn/image/upload/${skill.img}`;

    } else {

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

    // ----- precisão ("" = Padrão do rank) -----
    const selectPrecisao = document.getElementById("edit-precisao");

    selectPrecisao.value =
        (skill.precisao !== undefined && skill.precisao !== null)
            ? String(skill.precisao)
            : "";

    // valor salvo fora da lista (ex.: 0 ou decimal) volta para Padrão
    if (selectPrecisao.selectedIndex === -1) {
        selectPrecisao.value = "";
    }

    document.getElementById("edit-rank").onchange = atualizarCampoPrecisao;
    document.getElementById("edit-categoria").onchange = atualizarCampoPrecisao;

    atualizarCampoPrecisao();

    carregarEfeitosEdit(skill);

}




function fecharFichaEdit() {


    document
        .getElementById("ficha-edit")
        .style.display = "none";


}

async function uploadImagem(e) {

    const file = e.target.files[0];

    if (!file) return;


    const formData = new FormData();


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
        "Grand Line RPG/Habilidades"
    );



    try {


        const res = await fetch(
            "https://api.cloudinary.com/v1_1/djh45admn/image/upload",
            {
                method: "POST",
                body: formData
            }
        );



        const data = await res.json();


        console.log("STATUS:", res.status);

        console.log(
            "ERRO CLOUDINARY:",
            data.error?.message
        );



        if (!data.secure_url) {

            console.error("Upload falhou:", data);
            return;

        }



        window.skillAtual.img =
            data.public_id;



        document
            .getElementById("edit-img")
            .src =
            data.secure_url;



        console.log("Imagem salva:", data.public_id);



    } catch (err) {

        console.error(
            "Erro upload:",
            err
        );

    }


}

function limparUID(nome) {

    return nome
        .trim()
        .replace(/[.#$[\]/]/g, "")
        .replace(/\s+/g, "_");

}


async function salvarFichaEdit() {


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

    // Precisão: "" = Padrão (base do rank nas ofensivas; nenhuma nas demais)
    if (CATEGORIAS_COM_PRECISAO.includes(skill.categoria)) {

        const valorPrecisao = document.getElementById("edit-precisao").value;

        skill.precisao =
            valorPrecisao === "" ? "" : Number(valorPrecisao);

    } else {

        delete skill.precisao;

    }

    const efeitos = [];

    document
        .querySelectorAll(".efeito-select")
        .forEach(select => {

            if (select.value) {

                efeitos.push(select.value);

            }

        });


    skill.efeito = efeitos;

    console.log(
        "SKILL EDITADA:",
        skill
    );

    if (!window.skillCategoria || !window.skillSub) {

        console.error("Categoria ou estilo faltando:", {
            categoria: window.skillCategoria,
            sub: window.skillSub
        });

        return;

    }


    // se for uma skill nova cria o UID pelo nome
    if (!window.skillUid) {

        window.skillUid =
            limparUID(skill.nome);

    }

    const skillSalvar = { ...skill };

    // null remove a chave no Firebase (ex.: categoria sem precisão)
    if (!CATEGORIAS_COM_PRECISAO.includes(skill.categoria)) {
        skillSalvar.precisao = null;
    }

    delete skillSalvar.id;
    delete skillSalvar.bancoCategoria;
    delete skillSalvar.estilo;

    await update(
        ref(
            db,
            `habilidades/${window.skillCategoria}/${window.skillSub}/${window.skillUid}`
        ),
        skillSalvar
    );

    console.log("Skill salva no Firebase!");

    fecharFichaEdit();



}