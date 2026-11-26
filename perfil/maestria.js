import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getDatabase,
    ref,
    get,
    update,
    runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { MAESTRIA_VALORES, MAESTRIA_CUSTO_RANK } from "./ficha.js";

const app = getApp();
const db = getDatabase(app);

const NOMES_RANK = {
    1: "INICIANTE",
    2: "APRENDIZ",
    3: "NOVATO",
    4: "INTERMEDIÁRIO",
    5: "VETERANO"
};

function garantirModalMaestria() {
    let modal = document.getElementById("maestria-modal");
    if (modal) return modal;

    const html = `
        <div id="maestria-modal" class="maestria-modal">
            <div class="maestria-window">
                <button id="close-maestria" class="maestria-close-x">×</button>

                <div class="maestria-header">
                    <h2 id="maestria-title">MAESTRIA</h2>
                    <p id="maestria-subtitle">Rank 1 • Nível Atual: 1</p>
                </div>

                <div class="maestria-pontos-box">
                    Pontos Disponíveis: <b id="maestria-pontos-disponiveis">0</b> PTS
                </div>

                <table class="maestria-table">
                    <thead>
                        <tr>
                            <th>NÍVEL</th>
                            <th id="maestria-col-atributo">ATK</th>
                            <th>CUSTO</th>
                        </tr>
                    </thead>
                    <tbody id="maestria-tbody"></tbody>
                </table>

                <p id="maestria-aviso" class="maestria-aviso"></p>

                <div class="maestria-actions">
                    <button id="maestria-upgrade-btn">EVOLUIR</button>
                    <button id="maestria-close-btn">FECHAR</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML("beforeend", html);
    return document.getElementById("maestria-modal");
}

function obterChavePontoCategoria(categoria, sub) {
    const cat = String(categoria || "").toLowerCase();
    const s = String(sub || "").toLowerCase();

    if (cat.includes("estilo") || cat.includes("style") || s.includes("estilo") || s.includes("style")) {
        return "skill-style";
    }
    if (cat.includes("akuma") || cat.includes("fruit") || cat.includes("fruta") || s.includes("akuma") || s.includes("fruit")) {
        return "skill-fruit";
    }
    if (cat.includes("raça") || cat.includes("raca") || cat.includes("race") || s.includes("raça") || s.includes("raca") || s.includes("race")) {
        return "skill-race";
    }

    return "skill-others";
}

function fecharMaestria() {
    const modal = document.getElementById("maestria-modal");
    if (modal) {
        modal.style.display = "none";
    }
}

document.addEventListener("click", (e) => {
    if (
        e.target.id === "maestria-close-btn" ||
        e.target.id === "close-maestria" ||
        e.target.id === "maestria-modal"
    ) {
        fecharMaestria();
    }
});

window.abrirMaestria = async function (skill, skillUid) {
    const modal = garantirModalMaestria();

    const user = window.auth?.currentUser;
    if (!user || !skill || !skillUid) {
        return;
    }

    const rank = Math.min(Math.max(Number(skill.rank) || 1, 1), 5);
    const isDefensivo = skill.categoria === "Defensivo";
    const tipoAtributo = isDefensivo ? "DEF" : "ATK";
    const custoEvolucao = MAESTRIA_CUSTO_RANK[rank] || 2;
    const tabelaValores = MAESTRIA_VALORES[rank] || { 1: 2, 2: 5, 3: 10 };

    const [playerSnap, playerSkillSnap] = await Promise.all([
        get(ref(db, `players/${user.uid}`)),
        get(ref(db, `players/${user.uid}/skills/${skillUid}`))
    ]);

    if (!playerSnap.exists() || !playerSkillSnap.exists()) {
        return;
    }

    const player = playerSnap.val();
    const playerSkillData = playerSkillSnap.val();

    let nivelAtual = Number(playerSkillData?.level) || 1;
    nivelAtual = Math.min(Math.max(nivelAtual, 1), 3);

    const pontosDisponiveis = Number(player?.points?.["skill-available"]) || 0;

    document.getElementById("maestria-title").innerText = `MAESTRIA • ${skill.nome || ""}`;
    document.getElementById("maestria-subtitle").innerText =
        `${NOMES_RANK[rank] || "RANK " + rank} • NÍVEL ATUAL: ${nivelAtual}`;
    document.getElementById("maestria-col-atributo").innerText = tipoAtributo;
    document.getElementById("maestria-pontos-disponiveis").innerText = pontosDisponiveis;

    const tbody = document.getElementById("maestria-tbody");
    tbody.innerHTML = "";

    for (let lvl = 1; lvl <= 3; lvl++) {
        const tr = document.createElement("tr");

        if (lvl === nivelAtual) {
            tr.classList.add("nivel-atual");
        } else if (lvl < nivelAtual) {
            tr.classList.add("nivel-concluido");
        }

        let valorAtributo = tabelaValores[lvl];
        if (lvl === 1) {
            const manual = isDefensivo ? skill.atributos?.def : skill.atributos?.atk;
            if (manual !== "" && manual !== undefined && manual !== null) {
                valorAtributo = Number(manual);
            }
        }

        let textoCusto = "-";
        if (lvl === 1) {
            textoCusto = "BASE";
        } else if (lvl <= nivelAtual) {
            textoCusto = "DESBLOQUEADO";
        } else if (lvl === nivelAtual + 1) {
            textoCusto = `${custoEvolucao} PTS`;
        } else {
            textoCusto = `${custoEvolucao} PTS`;
        }

        const badgeAtual = lvl === nivelAtual ? `<span class="maestria-badge">ATUAL</span>` : "";

        tr.innerHTML = `
            <td>Nível ${lvl} ${badgeAtual}</td>
            <td><b>${valorAtributo}</b></td>
            <td>${textoCusto}</td>
        `;

        tbody.appendChild(tr);
    }

    const avisoEl = document.getElementById("maestria-aviso");
    const upgradeBtn = document.getElementById("maestria-upgrade-btn");

    avisoEl.innerText = "";
    avisoEl.className = "maestria-aviso";

    if (nivelAtual >= 3) {
        upgradeBtn.innerText = "NÍVEL MÁXIMO";
        upgradeBtn.disabled = true;
        upgradeBtn.onclick = null;
    } else if (pontosDisponiveis < custoEvolucao) {
        upgradeBtn.innerText = `EVOLUIR (${custoEvolucao} PTS)`;
        upgradeBtn.disabled = true;
        avisoEl.innerText = `Você precisa de ${custoEvolucao} pontos disponíveis para evoluir.`;
        upgradeBtn.onclick = null;
    } else {
        upgradeBtn.innerText = `EVOLUIR (${custoEvolucao} PTS)`;
        upgradeBtn.disabled = false;

        upgradeBtn.onclick = async () => {
            upgradeBtn.disabled = true;
            upgradeBtn.innerText = "EVOLUINDO...";

            try {
                const proximoNivel = nivelAtual + 1;
                const catBanco = playerSkillData.categoria || window.skillCategoria || "";
                const subBanco = playerSkillData.sub || window.skillSub || "";
                const chaveCategoria = obterChavePontoCategoria(catBanco, subBanco);

                const pointsRef = ref(db, `players/${user.uid}/points`);
                let pontosInsuficientes = false;

                await runTransaction(pointsRef, (points) => {
                    if (!points) points = {};
                    const disp = Number(points["skill-available"]) || 0;

                    if (disp < custoEvolucao) {
                        pontosInsuficientes = true;
                        return;
                    }

                    points["skill-available"] = disp - custoEvolucao;
                    points["skill-used"] = (Number(points["skill-used"]) || 0) + custoEvolucao;
                    points[chaveCategoria] = (Number(points[chaveCategoria]) || 0) + custoEvolucao;

                    return points;
                });

                if (pontosInsuficientes) {
                    avisoEl.innerText = "Pontos insuficientes!";
                    upgradeBtn.disabled = false;
                    upgradeBtn.innerText = `EVOLUIR (${custoEvolucao} PTS)`;
                    return;
                }

                await update(ref(db, `players/${user.uid}/skills/${skillUid}`), {
                    level: proximoNivel
                });

                skill.level = proximoNivel;
                if (window.abrirFicha) {
                    await window.abrirFicha(
                        skill,
                        false,
                        false,
                        false,
                        skillUid,
                        catBanco,
                        subBanco,
                        true
                    );
                }

                await window.abrirMaestria(skill, skillUid);

                const novoAviso = document.getElementById("maestria-aviso");
                if (novoAviso) {
                    novoAviso.className = "maestria-aviso sucesso";
                    novoAviso.innerText = `Habilidade evoluída para o Nível ${proximoNivel}!`;
                }
            } catch (err) {
                console.error("Erro ao evoluir maestria:", err);
                avisoEl.innerText = "Erro ao evoluir maestria. Tente novamente.";
                upgradeBtn.disabled = false;
                upgradeBtn.innerText = `EVOLUIR (${custoEvolucao} PTS)`;
            }
        };
    }

    modal.style.display = "flex";
};
