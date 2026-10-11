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

    if (select.options && select.options.length) {

        select.options[0].text = categoria === "Ofensivo"
            ? `Padrão (${precisaoBase(rank)}%)`
            : "Padrão (sem precisão)";

    }

}

console.log("FICHA-EDIT JS CARREGOU");

async function carregarFichaEditHTML() {
    let container = document.getElementById("ficha-edit-container");

    if (!container) {
        container = document.createElement("div");
        container.id = "ficha-edit-container";
        document.body.appendChild(container);
    }

    const res = await fetch(
        location.pathname.includes("/guia/")
            ? "../perfil/ficha-edit.html"
            : "perfil/ficha-edit.html"
    );

    container.innerHTML = await res.text();

    const closeBtn = document.getElementById("close-ficha-edit");
    if (closeBtn) closeBtn.onclick = fecharFichaEdit;

    const salvarBtn = document.getElementById("salvar-ficha-edit");
    if (salvarBtn) salvarBtn.onclick = salvarFichaEdit;

    const uploadBtn = document.getElementById("upload-img-btn");
    if (uploadBtn) {
        uploadBtn.onclick = () => {
            const input = document.getElementById("upload-img-input");
            if (input) input.click();
        };
    }

    const uploadInput = document.getElementById("upload-img-input");
    if (uploadInput) uploadInput.onchange = uploadImagem;

    const addEfeitoBtn = document.getElementById("add-efeito-edit");
    if (addEfeitoBtn) {
        addEfeitoBtn.onclick = () => {
            criarSelectEfeito();
        };
    }
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


    if (modal) {
        modal.style.display = "flex";
    } else {
        console.error("ERRO: O elemento #ficha-edit não foi encontrado após o carregamento do HTML.");
        return;
    }


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
        skill.categoria || "Ofensivo";


    document.getElementById("edit-propriedade").value =
        skill.propriedade || "";


    document.getElementById("edit-alcance").value =
        skill.alcance || "";


    document.getElementById("edit-alvos").value =
        skill.alvos || "";


    document.getElementById("edit-cooldown").value =
        skill.cooldown || "";

    const selectPrecisao = document.getElementById("edit-precisao");

    if (selectPrecisao) {
        selectPrecisao.value =
            (skill.precisao !== undefined && skill.precisao !== null)
                ? String(skill.precisao)
                : "";

        if (selectPrecisao.selectedIndex === -1) {
            selectPrecisao.value = "";
        }
    }

    const editRankEl = document.getElementById("edit-rank");
    const editCatEl = document.getElementById("edit-categoria");

    if (editRankEl) editRankEl.onchange = atualizarCampoPrecisao;
    if (editCatEl) editCatEl.onchange = atualizarCampoPrecisao;

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

    if (!window.skillCategoria || !window.skillSub) {

        console.error("Categoria ou estilo faltando:", {
            categoria: window.skillCategoria,
            sub: window.skillSub
        });

        return;

    }


    if (!window.skillUid) {

        window.skillUid =
            limparUID(skill.nome);

    }

    const skillSalvar = { ...skill };

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

    if (window.abrirHabilidades && window.skillSub) {
        window.abrirHabilidades(window.skillSub);
    }
}