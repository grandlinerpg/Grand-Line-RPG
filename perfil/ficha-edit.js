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

    const categoria = document.getElementById("edit-categoria")?.value || "Ofensivo";
    const rank = document.getElementById("edit-rank")?.value || 1;

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

    // Se já existir o modal no DOM, não precisa baixar de novo
    if (document.getElementById("ficha-edit")) return;

    const inGuia = location.pathname.includes("/guia/");
    const caminhos = inGuia 
        ? ["../perfil/ficha-edit.html", "perfil/ficha-edit.html", "/Grand-Line-RPG/perfil/ficha-edit.html", "ficha-edit.html"]
        : ["perfil/ficha-edit.html", "./perfil/ficha-edit.html", "/Grand-Line-RPG/perfil/ficha-edit.html", "ficha-edit.html"];

    let htmlCarregado = false;
    for (const caminho of caminhos) {
        try {
            const res = await fetch(caminho);
            if (res.ok) {
                container.innerHTML = await res.text();
                htmlCarregado = true;
                break;
            }
        } catch (e) {
            // Tenta o próximo caminho
        }
    }

    // Fallback absoluto caso o fetch falhe (garante que o modal sempre abra)
    if (!htmlCarregado || !document.getElementById("ficha-edit")) {
        container.innerHTML = `
        <div id="ficha-edit" class="ficha-edit-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; justify-content:center; align-items:center;">
            <div class="ficha-edit-window" style="background:#222; padding:20px; border-radius:8px; width:90%; max-width:500px; max-height:90vh; overflow-y:auto; color:#fff;">
                <button id="close-ficha-edit" class="close-ficha-edit" style="float:right; background:none; border:none; color:#fff; font-size:20px; cursor:pointer;">×</button>
                <h2>EDITAR FICHA</h2>
                <div class="ficha-edit-scroll">
                    <div class="img-upload-area" style="text-align:center; margin-bottom:10px;">
                        <img id="edit-img" class="edit-img" style="max-height:100px; display:block; margin:0 auto 5px;">
                        <button id="upload-img-btn" class="upload-img-btn" type="button">📤 Enviar Imagem</button>
                        <input type="file" id="upload-img-input" accept="image/*" hidden>
                    </div>
                    <label>Nome</label>
                    <input id="edit-nome" style="width:100%; margin-bottom:10px; padding:5px; box-sizing:border-box;">
                    <label>Descrição</label>
                    <textarea id="edit-description" style="width:100%; margin-bottom:10px; padding:5px; box-sizing:border-box;"></textarea>
                    <label>Rank</label>
                    <select id="edit-rank" style="width:100%; margin-bottom:10px; padding:5px; box-sizing:border-box;">
                        <option value="1">Iniciante</option>
                        <option value="2">Aprendiz</option>
                        <option value="3">Novato</option>
                        <option value="4">Intermediário</option>
                        <option value="5">Veterano</option>
                    </select>
                    <label>Cooldown</label>
                    <select id="edit-cooldown" style="width:100%; margin-bottom:10px; padding:5px; box-sizing:border-box;">
                        <option value="">Padrão</option>
                        <option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option>
                    </select>
                    <label>Categoria</label>
                    <select id="edit-categoria" style="width:100%; margin-bottom:10px; padding:5px; box-sizing:border-box;">
                        <option value="Ofensivo">Ofensivo</option>
                        <option value="Defensivo">Defensivo</option>
                        <option value="Suplementar">Suplementar</option>
                        <option value="Equipamento">Equipamento</option>
                    </select>
                    <label>Propriedade</label>
                    <select id="edit-propriedade" style="width:100%; margin-bottom:10px; padding:5px; box-sizing:border-box;">
                        <option value="Contundente">Contundente</option>
                        <option value="Cortante">Cortante</option>
                        <option value="Perfurante">Perfurante</option>
                        <option value="Sobrenatural">Sobrenatural</option>
                    </select>
                    <label>Alcance</label>
                    <select id="edit-alcance" style="width:100%; margin-bottom:10px; padding:5px; box-sizing:border-box;">
                        <option value="Pessoal">Pessoal</option>
                        <option value="Curto">Curto</option>
                        <option value="Médio">Médio</option>
                        <option value="Longo">Longo</option>
                    </select>
                    <label>Alvos</label>
                    <select id="edit-alvos" style="width:100%; margin-bottom:10px; padding:5px; box-sizing:border-box;">
                        <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option>
                    </select>
                    <div id="edit-precisao-wrap">
                        <label>Precisão</label>
                        <select id="edit-precisao" style="width:100%; margin-bottom:10px; padding:5px; box-sizing:border-box;">
                            <option value="">Padrão</option>
                        </select>
                    </div>
                    <label>Efeitos</label>
                    <div id="efeitos-edit-area" class="efeitos-edit-area" style="margin-bottom:10px;"></div>
                    <button id="add-efeito-edit" class="add-efeito-edit" type="button" style="width:100%; margin-bottom:10px; padding:5px;">+</button>
                </div>
                <button id="salvar-ficha-edit" style="width:100%; padding:10px; background:#4CAF50; color:#fff; border:none; cursor:pointer;">SALVAR</button>
            </div>
        </div>`;
    }

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
    try {
        const snap = await get(ref(db, "efeitos"));
        if (snap.exists()) {
            listaEfeitosFirebase = snap.val();
        }
    } catch (err) {
        console.log("Erro ao carregar efeitos:", err);
    }
}

function carregarEfeitosEdit(skill) {
    const area = document.getElementById("efeitos-edit-area");
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
    const area = document.getElementById("efeitos-edit-area");
    if (!area) return;

    const row = document.createElement("div");
    row.className = "efeito-edit-row";
    row.style.display = "flex";
    row.style.gap = "5px";
    row.style.marginBottom = "5px";

    let options = `<option value="">Escolher efeito</option>`;
    Object.entries(listaEfeitosFirebase).forEach(([uid, efeito]) => {
        options += `<option value="${uid}">${efeito.nome}</option>`;
    });

    row.innerHTML = `
        <select class="efeito-select" style="flex:1; padding:5px;">${options}</select>
        <button class="remove-efeito-edit" type="button" style="background:red; color:#fff; border:none; padding:2px 8px; cursor:pointer;">×</button>
    `;

    const select = row.querySelector("select");
    select.value = valor;

    row.querySelector(".remove-efeito-edit").onclick = () => {
        row.remove();
    };

    area.appendChild(row);
}

window.abrirFichaEdit = async function () {
    const skill = window.skillAtual;

    if (!document.getElementById("ficha-edit")) {
        await carregarFichaEditHTML();
    }

    if (!skill) {
        console.log("Nenhuma skill");
        return;
    }

    await carregarListaEfeitos();

    const modal = document.getElementById("ficha-edit");

    if (modal) {
        modal.style.display = "flex";
    } else {
        console.error("ERRO: O elemento #ficha-edit não foi encontrado.");
        return;
    }

    const editImg = document.getElementById("edit-img");
    if (editImg) {
        if (skill.img) {
            editImg.src = `https://res.cloudinary.com/djh45admn/image/upload/${skill.img}`;
        } else {
            editImg.src = "";
        }
    }

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val ?? "";
    };

    setVal("edit-nome", skill.nome);
    setVal("edit-description", skill.description);
    setVal("edit-rank", skill.rank || 1);
    setVal("edit-categoria", skill.categoria || "Ofensivo");
    setVal("edit-propriedade", skill.propriedade);
    setVal("edit-alcance", skill.alcance);
    setVal("edit-alvos", skill.alvos);
    setVal("edit-cooldown", skill.cooldown);

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
};

function fecharFichaEdit() {
    const modal = document.getElementById("ficha-edit");
    if (modal) modal.style.display = "none";
}

async function uploadImagem(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "grandline-rpg");
    formData.append("folder", "Grand Line RPG/Habilidades");

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

        window.skillAtual.img = data.public_id;
        const editImg = document.getElementById("edit-img");
        if (editImg) editImg.src = data.secure_url;

    } catch (err) {
        console.error("Erro upload:", err);
    }
}

function limparUID(nome) {
    return nome
        .trim()
        .replace(/[.#$[\]/]/g, "")
        .replace(/\s+/g, "_");
}

async function salvarFichaEdit() {
    const skill = window.skillAtual;

    skill.nome = document.getElementById("edit-nome")?.value || "";
    skill.description = document.getElementById("edit-description")?.value || "";
    skill.rank = Number(document.getElementById("edit-rank")?.value || 1);
    skill.categoria = document.getElementById("edit-categoria")?.value || "Ofensivo";
    skill.propriedade = document.getElementById("edit-propriedade")?.value || "";
    skill.alcance = document.getElementById("edit-alcance")?.value || "";
    skill.alvos = document.getElementById("edit-alvos")?.value || "1";
    skill.cooldown = document.getElementById("edit-cooldown")?.value || "";

    if (CATEGORIAS_COM_PRECISAO.includes(skill.categoria)) {
        const valorPrecisao = document.getElementById("edit-precisao")?.value;
        skill.precisao = (valorPrecisao === undefined || valorPrecisao === "") ? "" : Number(valorPrecisao);
    } else {
        delete skill.precisao;
    }

    const efeitos = [];
    document.querySelectorAll(".efeito-select").forEach(select => {
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
        window.skillUid = limparUID(skill.nome || "skill_nova");
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
