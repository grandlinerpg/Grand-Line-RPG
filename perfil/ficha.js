import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getDatabase,
    ref,
    get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const app = getApp();
const db = getDatabase(app);

const fichaContainer = document.getElementById("ficha-container");
let skillAtual = null;

// Precisão base de cada rank de habilidade ofensiva/suplementar (%)
const PRECISAO_BASE_RANK = { 1: 90, 2: 85, 3: 80, 4: 75, 5: 70 };

// Tabela de valores de ATK/DEF por Rank e Nível (1 a 3)
export const MAESTRIA_VALORES = {
    1: { 1: 2,  2: 5,  3: 10 },
    2: { 1: 4,  2: 10, 3: 20 },
    3: { 1: 8,  2: 15, 3: 30 },
    4: { 1: 10, 2: 20, 3: 40 },
    5: { 1: 15, 2: 30, 3: 50 }
};

// Custo por evolução conforme o Rank (1 a 5)
export const MAESTRIA_CUSTO_RANK = {
    1: 2,
    2: 4,
    3: 6,
    4: 8,
    5: 10
};

async function carregarFichaHTML(){
    if(!fichaContainer){
        console.log("ERRO: ficha-container não encontrado");
        return;
    }

    const res = await fetch(
      location.pathname.includes("/guia/")
      ? "../perfil/ficha.html"
      : "perfil/ficha.html"
    );
    const html = await res.text();

    fichaContainer.insertAdjacentHTML(
        "beforeend",
        html
    );

    const closeBtn = document.getElementById("close-ficha");

    closeBtn?.addEventListener("click",()=>{
        const modal = document.getElementById("ficha-modal");
        if(modal){
            modal.style.display = "none";
        }
    });

    const img = document.getElementById("ficha-img");

    img?.addEventListener("click", () => {
        if(window.abrirCard && skillAtual){
            window.abrirCard(skillAtual);
        }
    });
}

async function carregarEfeitos(skill){
    const efeitoBox = document.getElementById("ficha-efeitoss");

    if(!efeitoBox){
        console.log("ERRO: ficha-efeitoss não existe");
        return;
    }

    efeitoBox.innerHTML = "";

    if(!skill.efeito || skill.efeito.length === 0){
        efeitoBox.style.display = "none";
        return;
    }

    let listaEfeitos = [];

    // NOVO FORMATO ARRAY
    if(Array.isArray(skill.efeito)){
        listaEfeitos = skill.efeito;
    }
    // COMPATIBILIDADE COM ANTIGO
    else if(typeof skill.efeito === "object"){
        listaEfeitos = Object.keys(skill.efeito);
    }
    else{
        listaEfeitos = [skill.efeito];
    }

    for(const id of listaEfeitos){
        const efeitoRef = ref(db,"efeitos/"+id);
        const snap = await get(efeitoRef);

        if(snap.exists()){
            const efeito = snap.val();
            const span = document.createElement("span");

            if(efeito.figure){
                span.innerHTML = `
                    <img 
                    src="https://res.cloudinary.com/djh45admn/image/upload/v1784283109/${efeito.figure}.png"
                    class="efeito-icon">
                `;
            }else{
                span.innerHTML = efeito.emoji || "❔";
            }

            span.title = efeito.nome || "";

            // ABRIR FICHA DO EFEITO AO CLICAR
            span.style.cursor = "pointer";

            span.onclick = ()=>{
                if(window.abrirEfeito){
                    window.abrirEfeito(id);
                }else{
                    console.log("efeito.js não carregou");
                }
            };

            efeitoBox.appendChild(span);
        }
    }

    if(efeitoBox.children.length > 0){
        efeitoBox.style.display = "flex";
    }else{
        efeitoBox.style.display = "none";
    }
}

function atualizarLinha(idLinha, idTexto, valor){
    const linha = document.getElementById(idLinha);
    const texto = document.getElementById(idTexto);

    if(!linha || !texto) return;

    if(valor !== undefined && valor !== null && valor !== ""){
        texto.innerText = valor;
        linha.style.display = "";
    }else{
        linha.style.display = "none";
    }
}

window.abrirFicha = async function(
    skill,
    mostrarCusto = true,
    mostrarComprar = true,
    mostrarEditar = false,
    skillUid = null,
    bancoCategoria = "",
    sub = "",
    jaPossui = false
){
    if(!document.getElementById("ficha-modal")){
        await carregarFichaHTML();
    }

    skillAtual = skill;
    window.skillAtual = skill;
    window.skillUid = skillUid;
    window.skillCategoria = bancoCategoria;
    window.skillSub = sub;

    const modal = document.getElementById("ficha-modal");

    if(!modal){
        console.log("ERRO: ficha-modal não encontrado");
        return;
    }

    modal.style.display = "flex";

    // Busca nível atual da skill caso o jogador já possua
    let nivelSkill = 1;
    if(jaPossui){
        if(skill?.level !== undefined && skill?.level !== null && skill?.level !== ""){
            nivelSkill = Number(skill.level) || 1;
        }else{
            const uid = window.auth?.currentUser?.uid;
            if(uid && skillUid){
                const snapLevel = await get(ref(db, `players/${uid}/skills/${skillUid}/level`));
                nivelSkill = snapLevel.exists() ? (Number(snapLevel.val()) || 1) : 1;
            }
        }
    }
    nivelSkill = Math.min(Math.max(nivelSkill, 1), 3);

    // reseta linhas escondidas de outra skill
    document
    .querySelectorAll(".ficha-table tr")
    .forEach(linha=>{
        linha.style.display = "";
    });

    document
    .querySelectorAll(".ficha-atributo")
    .forEach(attr=>{
        attr.style.display = "";
    });

    const img = document.getElementById("ficha-img");

    if(img){
        img.src = `https://res.cloudinary.com/djh45admn/image/upload/v1781908673/${skill.img}.jpg`;
    }

    document.getElementById("ficha-nome").innerText = skill.nome || "-";
    document.getElementById("ficha-description").innerText = skill.description || "-";

    // =====================
    // EFEITO DA SKILL
    // =====================
    carregarEfeitos(skill);

    // =====================
    // CUSTO DA SKILL
    // =====================
    const cost = document.getElementById("ficha-cost");

    if(cost){
        cost.innerText = `${skill.custo || 0} PTS`;
    }

    // =====================
    // RANK DA SKILL
    // =====================
    const rankEl = document.getElementById("ficha-rank");
    const rankValor = document.getElementById("ficha-rank-valor");

    const nomesRank = {
        1: "INICIANTE",
        2: "APRENDIZ",
        3: "NOVATO",
        4: "INTERMEDIÁRIO",
        5: "VETERANO"
    };

    if(skill.rank){
        rankValor.innerText = nomesRank[skill.rank] || skill.rank;
        rankEl.style.display = "";
    }else{
        rankEl.style.display = "none";
    }

    // =====================
    // ATRIBUTOS DA SKILL
    // =====================
    function atualizarAtributo(idBloco, idTexto, valor){
        const bloco = document.getElementById(idBloco);
        const texto = document.getElementById(idTexto);

        if(!bloco || !texto) return;

        if(valor !== undefined && valor !== null && valor !== ""){
            texto.innerText = Number(valor).toLocaleString("pt-BR");
            bloco.style.display = "";
        }else{
            texto.innerText = "";
            bloco.style.display = "none";
        }
    }

    // =====================
    // VALORES PADRÃO POR RANK E MAESTRIA
    // =====================
    const stmRank = { 1: 2, 2: 4, 3: 8, 4: 15, 5: 20 };
    const rankNum = Number(skill.rank) || 1;
    const valorMaestriaAtual = MAESTRIA_VALORES[rankNum]?.[nivelSkill] ?? 2;

    // STM sempre
    atualizarAtributo(
        "atributo-stm",
        "ficha-stm",
        skill.atributos?.stm !== "" && skill.atributos?.stm !== undefined
            ? skill.atributos.stm
            : stmRank[rankNum]
    );

    // ATK somente ofensivo
    let atkFinal = null;
    if(skill.categoria === "Ofensivo"){
        const temAtkManual = skill.atributos?.atk !== "" && skill.atributos?.atk !== undefined && skill.atributos?.atk !== null;
        if(temAtkManual && nivelSkill === 1){
            atkFinal = skill.atributos.atk;
        }else{
            atkFinal = valorMaestriaAtual;
        }
    }
    atualizarAtributo("atributo-atk", "ficha-atk", atkFinal);

    // DEF somente defensivo
    let defFinal = null;
    if(skill.categoria === "Defensivo"){
        const temDefManual = skill.atributos?.def !== "" && skill.atributos?.def !== undefined && skill.atributos?.def !== null;
        if(temDefManual && nivelSkill === 1){
            defFinal = skill.atributos.def;
        }else{
            defFinal = valorMaestriaAtual;
        }
    }
    atualizarAtributo("atributo-def", "ficha-def", defFinal);

    // POW manual
    atualizarAtributo(
        "atributo-pow",
        "ficha-pow",
        skill.atributos?.pow
    );

    const cooldownRank = {
        1: 1,
        2: 2,
        3: 3,
        4: 4,
        5: 5
    };

    let cooldownValor;

    if (skill.categoria === "Equipamento") {
        cooldownValor = skill.cooldown || "";
    } else {
        const cooldownBase = cooldownRank[skill.rank] ?? "-";
        cooldownValor =
            skill.cooldown !== ""
                ? (skill.cooldown ?? cooldownBase)
                : cooldownBase;
    }

    atualizarLinha(
        "linha-cooldown",
        "ficha-cooldown",
        cooldownValor
    );

    atualizarLinha(
        "linha-categoria",
        "ficha-categoria",
        skill.categoria
    );

    let propriedadeTexto = "";
    if(Array.isArray(skill.propriedade)){
        propriedadeTexto = skill.propriedade.filter(Boolean).join("\n");
    }else if(typeof skill.propriedade === "object" && skill.propriedade !== null){
        propriedadeTexto = Object.values(skill.propriedade).filter(Boolean).join("\n");
    }else if(skill.propriedade){
        propriedadeTexto = String(skill.propriedade);
    }

    atualizarLinha(
        "linha-propriedade",
        "ficha-propriedade",
        propriedadeTexto
    );

    atualizarLinha(
        "linha-alcance",
        "ficha-alcance",
        skill.alcance
    );

    atualizarLinha(
        "linha-alvos",
        "ficha-alvos",
        skill.alvos
    );

    // Precisão: valor próprio; no padrão, ofensivas e suplementares usam a base do rank
    let precisaoValor =
    (skill.precisao !== undefined && skill.precisao !== null && skill.precisao !== "")
        ? skill.precisao
        : undefined;

    if(precisaoValor === undefined && (skill.categoria === "Ofensivo" || skill.categoria === "Suplementar")){
        precisaoValor = PRECISAO_BASE_RANK[Number(skill.rank)];
    }

    atualizarLinha(
        "linha-precisao",
        "ficha-precisao",
        precisaoValor !== undefined
            ? `${precisaoValor}%`
            : null
    );

    atualizarLinha(
        "linha-degradation",
        "ficha-degradation",
        skill.degradation
    );

    const costBox = document.getElementById("ficha-cost");
    const nivelInfo = document.getElementById("ficha-nivel-info");
    const fichaBottom = document.querySelector("#ficha-modal .ficha-bottom");
    const buyBtn = document.querySelector("#ficha-modal #ficha-buy-btn");
    const maestriaBtn = document.getElementById("ficha-maestria-btn");
    const editBtn = document.querySelector("#ficha-modal #ficha-edit-btn");

    if(costBox){
        if(mostrarCusto && !jaPossui){
            costBox.style.display = "flex";
        }else{
            costBox.style.display = "none";
        }
    }

    if(nivelInfo){
        if(jaPossui){
            nivelInfo.innerText = `NÍVEL ${nivelSkill}`;
            nivelInfo.style.display = "flex";
        }else{
            nivelInfo.style.display = "none";
        }
    }

    if(buyBtn){
        if(mostrarComprar && !jaPossui){
            buyBtn.style.display = "block";
            buyBtn.onclick = () => {
                document
                    .getElementById("confirm-skill-modal")
                    .style.display = "flex";
            };
        }else{
            buyBtn.style.display = "none";
            buyBtn.onclick = null;
        }
    }

    if(maestriaBtn){
        const temMaestria = jaPossui && (skill.categoria === "Ofensivo" || skill.categoria === "Defensivo");
        if(temMaestria){
            maestriaBtn.style.display = "block";
            maestriaBtn.onclick = () => {
                if(window.abrirMaestria){
                    window.abrirMaestria(skill, skillUid);
                }else{
                    console.log("abrirMaestria não definido");
                }
            };
        }else{
            maestriaBtn.style.display = "none";
            maestriaBtn.onclick = null;
        }
    }

    if(editBtn){
        const podeEditar = await verificarPermissao(3);

        if(mostrarEditar && podeEditar){
            editBtn.style.display = "block";
            editBtn.onclick = () => {
                if(window.abrirFichaEdit){
                    window.abrirFichaEdit();
                }else{
                    console.log("ficha-edit.js não carregou");
                }
            };
        }else{
            editBtn.style.display = "none";
            editBtn.onclick = null;
        }
    }

    if(fichaBottom){
        const temAlgoVisivel =
            (mostrarCusto && !jaPossui) ||
            (mostrarComprar && !jaPossui) ||
            jaPossui ||
            Boolean(editBtn && editBtn.style.display === "block");

        if(!temAlgoVisivel){
            fichaBottom.style.display = "none";
        }else{
            fichaBottom.style.display = "flex";
        }
    }
};
