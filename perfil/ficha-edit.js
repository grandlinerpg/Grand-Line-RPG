import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const app = getApp();
const db = getDatabase(app);

let listaEfeitosFirebase = {};

const PRECISAO_BASE_RANK = { 1: 90, 2: 85, 3: 80, 4: 75, 5: 70 };
const CATEGORIAS_COM_PRECISAO = ["Ofensivo", "Suplementar"];

function precisaoBase(rank){
    return PRECISAO_BASE_RANK[Number(rank)] ?? 90;
}

function atualizarCampoPrecisao(){
    const wrap = document.getElementById("edit-precisao-wrap");
    const select = document.getElementById("edit-precisao");
    if(!wrap || !select) return;

    const categoria = document.getElementById("edit-categoria").value;
    const rank = document.getElementById("edit-rank").value;

    wrap.style.display = CATEGORIAS_COM_PRECISAO.includes(categoria) ? "" : "none";

    if(select.options && select.options.length){
        select.options[0].text = (categoria === "Ofensivo" || categoria === "Suplementar")
            ? `Padrão (${precisaoBase(rank)}%)`
            : "Padrão (sem precisão)";
    }
}

console.log("FICHA-EDIT JS CARREGOU");

function atualizarBotaoAddPropriedade(){
    const area = document.getElementById("propriedades-edit-area");
    const btnAdd = document.getElementById("add-propriedade-edit");
    if(!area || !btnAdd) return;

    const total = area.querySelectorAll(".propriedade-edit-row").length;
    btnAdd.style.display = total >= 2 ? "none" : "";
}

function criarSegundaPropriedade(valor = ""){
    const area = document.getElementById("propriedades-edit-area");
    if(!area) return;
    if(area.querySelectorAll(".propriedade-edit-row").length >= 2){
        atualizarBotaoAddPropriedade();
        return;
    }

    const row = document.createElement("div");
    row.className = "propriedade-edit-row propriedade-extra-row";
    row.innerHTML = `
        <select class="edit-propriedade edit-propriedade-extra">
            <option value="">Nenhuma</option>
            <option value="Contundente">Contundente</option>
            <option value="Cortante">Cortante</option>
            <option value="Perfurante">Perfurante</option>
            <option value="Sobrenatural">Sobrenatural</option>
        </select>
        <button class="remove-propriedade-edit" type="button">×</button>
    `;

    const selectExtra = row.querySelector("select");
    selectExtra.value = valor || "";

    row.querySelector(".remove-propriedade-edit").onclick = () => {
        row.remove();
        atualizarBotaoAddPropriedade();
    };

    area.appendChild(row);
    atualizarBotaoAddPropriedade();
}

function carregarPropriedadesEdit(skill){
    const area = document.getElementById("propriedades-edit-area");
    if(!area) return;

    area.querySelectorAll(".propriedade-extra-row").forEach(el => el.remove());

    let props = [];
    if(Array.isArray(skill.propriedade)){
        props = skill.propriedade.filter(Boolean);
    }else if(typeof skill.propriedade === "object" && skill.propriedade !== null){
        props = Object.values(skill.propriedade).filter(Boolean);
    }else if(skill.propriedade){
        props = [skill.propriedade];
    }

    document.getElementById("edit-propriedade").value = props[0] || "";

    if(props[1]){
        criarSegundaPropriedade(props[1]);
    }else{
        atualizarBotaoAddPropriedade();
    }
}

async function carregarFichaEditHTML(){
    const container = document.getElementById("ficha-edit-container");
    if(!container) return;

    const res = await fetch(
        location.pathname.includes("/guia/")
            ? "../perfil/ficha-edit.html"
            : "perfil/ficha-edit.html"
    );
    container.innerHTML = await res.text();

    document.getElementById("close-ficha-edit").onclick = fecharFichaEdit;
    document.getElementById("salvar-ficha-edit").onclick = salvarFichaEdit;
    document.getElementById("upload-img-btn").onclick = () => {
        document.getElementById("upload-img-input").click();
    };
    document.getElementById("upload-img-input").onchange = uploadImagem;
    document.getElementById("add-propriedade-edit").onclick = () => criarSegundaPropriedade("");
    document.getElementById("add-efeito-edit").onclick = () => criarSelectEfeito();
}

async function carregarListaEfeitos(){
    const snap = await get(ref(db, "efeitos"));
    if(!snap.exists()){
        console.log("Nenhum efeito encontrado");
        return;
    }
    listaEfeitosFirebase = snap.val();
    console.log("Efeitos carregados:", listaEfeitosFirebase);
}

function carregarEfeitosEdit(skill){
    const area = document.getElementById("efeitos-edit-area");
    if(!area) return;
    area.innerHTML = "";

    let efeitos = [];
    if(Array.isArray(skill.efeito)){
        efeitos = skill.efeito;
    }else if(typeof skill.efeito === "object"){
        efeitos = Object.keys(skill.efeito);
    }else if(skill.efeito){
        efeitos = [skill.efeito];
    }

    efeitos.forEach(efeito => criarSelectEfeito(efeito));
}

function criarSelectEfeito(valor = ""){
    const area = document.getElementById("efeitos-edit-area");
    const row = document.createElement("div");
    row.className = "efeito-edit-row";

    let options = `<option value="">Escolher efeito</option>`;
    Object.entries(listaEfeitosFirebase).forEach(([uid, efeito]) => {
        options += `<option value="${uid}">${efeito.nome}</option>`;
    });

    row.innerHTML = `
        <select class="efeito-select">${options}</select>
        <button class="remove-efeito-edit">×</button>
    `;

    row.querySelector("select").value = valor;
    row.querySelector(".remove-efeito-edit").onclick = () => row.remove();
    area.appendChild(row);
}

window.abrirFichaEdit = async function(){
    const skill = window.skillAtual;
    if(!document.getElementById("ficha-edit")){
        await carregarFichaEditHTML();
    }
    if(!skill){
        console.log("Nenhuma skill");
        return;
    }

    await carregarListaEfeitos();
    document.getElementById("ficha-edit").style.display = "flex";

    document.getElementById("edit-img").src = skill.img
        ? `https://res.cloudinary.com/djh45admn/image/upload/${skill.img}`
        : "";

    document.getElementById("edit-nome").value = skill.nome || "";
    document.getElementById("edit-description").value = skill.description || "";
    document.getElementById("edit-rank").value = skill.rank || 1;
    document.getElementById("edit-categoria").value = skill.categoria || "";
    document.getElementById("edit-alcance").value = skill.alcance || "";
    document.getElementById("edit-alvos").value = skill.alvos || "";
    document.getElementById("edit-cooldown").value = skill.cooldown || "";

    carregarPropriedadesEdit(skill);

    const selectPrecisao = document.getElementById("edit-precisao");
    selectPrecisao.value = (skill.precisao !== undefined && skill.precisao !== null)
        ? String(skill.precisao)
        : "";

    if(selectPrecisao.selectedIndex === -1){
        selectPrecisao.value = "";
    }

    document.getElementById("edit-rank").onchange = atualizarCampoPrecisao;
    document.getElementById("edit-categoria").onchange = atualizarCampoPrecisao;

    atualizarCampoPrecisao();
    carregarEfeitosEdit(skill);
};

function fecharFichaEdit(){
    document.getElementById("ficha-edit").style.display = "none";
}

async function uploadImagem(e){
    const file = e.target.files[0];
    if(!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "grandline-rpg");
    formData.append("folder", "Grand Line RPG/Habilidades");

    try{
        const res = await fetch("https://api.cloudinary.com/v1_1/djh45admn/image/upload", {
            method: "POST",
            body: formData
        });
        const data = await res.json();
        console.log("STATUS:", res.status);
        console.log("ERRO CLOUDINARY:", data.error?.message);

        if(!data.secure_url){
            console.error("Upload falhou:", data);
            return;
        }

        window.skillAtual.img = data.public_id;
        document.getElementById("edit-img").src = data.secure_url;
        console.log("Imagem salva:", data.public_id);
    }catch(err){
        console.error("Erro upload:", err);
    }
}

function limparUID(nome){
    return nome
        .trim()
        .replace(/[.#$[\]/]/g, "")
        .replace(/\s+/g, "_");
}

async function salvarFichaEdit(){
    const skill = window.skillAtual;
    skill.nome = document.getElementById("edit-nome").value;

    if(!skill.nome.trim()){
        alert("Informe o nome da habilidade antes de salvar.");
        return;
    }

    skill.description = document.getElementById("edit-description").value;
    skill.rank = Number(document.getElementById("edit-rank").value);
    skill.categoria = document.getElementById("edit-categoria").value;

    const props = [];
    document.querySelectorAll("#propriedades-edit-area .edit-propriedade").forEach(sel => {
        if(sel.value) props.push(sel.value);
    });
    skill.propriedade = props.length > 1 ? props : (props[0] || "");

    skill.alcance = document.getElementById("edit-alcance").value;
    skill.alvos = document.getElementById("edit-alvos").value;
    skill.cooldown = document.getElementById("edit-cooldown").value;

    if(CATEGORIAS_COM_PRECISAO.includes(skill.categoria)){
        const valorPrecisao = document.getElementById("edit-precisao").value;
        skill.precisao = valorPrecisao === "" ? "" : Number(valorPrecisao);
    }else{
        delete skill.precisao;
    }

    const efeitos = [];
    document.querySelectorAll(".efeito-select").forEach(select => {
        if(select.value) efeitos.push(select.value);
    });
    skill.efeito = efeitos;

    console.log("SKILL EDITADA:", skill);

    if(!window.skillCategoria || !window.skillSub){
        console.error("Categoria ou estilo faltando:", {
            categoria: window.skillCategoria,
            sub: window.skillSub
        });
        return;
    }

    const skillNova = !window.skillUid;
    if(skillNova){
        window.skillUid = limparUID(skill.nome);
    }

    const skillSalvar = { ...skill };
    if(!CATEGORIAS_COM_PRECISAO.includes(skill.categoria)){
        skillSalvar.precisao = null;
    }

    delete skillSalvar.id;
    delete skillSalvar.bancoCategoria;
    delete skillSalvar.estilo;

    try{
        await update(
            ref(db, `habilidades/${window.skillCategoria}/${window.skillSub}/${window.skillUid}`),
            skillSalvar
        );
    }catch(err){
        console.error("Erro ao salvar skill:", err);
        if(skillNova) window.skillUid = null;
        alert("Não foi possível salvar a habilidade: " + err.message);
        return;
    }

    console.log("Skill salva no Firebase!");
    fecharFichaEdit();

    const listaAberta = document.getElementById("habilidades-modal");
    if(
        listaAberta &&
        listaAberta.style.display === "flex" &&
        window.abrirHabilidades &&
        window.habilidadesEstiloAtual
    ){
        window.abrirHabilidades(
            window.habilidadesEstiloAtual,
            window.habilidadesCategoriaAtual
        );
    }
}
