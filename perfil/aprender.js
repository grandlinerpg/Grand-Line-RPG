import {
    ref,
    get,
    set,
    runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

console.log("APRENDER.JS CARREGOU");

function abrirResultado(titulo, texto) {
    document.getElementById("skill-result-title").textContent = titulo;
    document.getElementById("skill-result-text").textContent = texto;
    document.getElementById("skill-result-modal").style.display = "flex";
}

function fecharResultado() {
    document.getElementById("skill-result-modal").style.display = "none";
}

document.addEventListener("click", (e) => {
    if (e.target.id === "skill-result-ok") {
        fecharResultado();
    }
});

function obterChavePontoCategoria(categoria, sub) {
    // Normaliza para caixa baixa para evitar problemas de maiúsculas/minúsculas
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

function iniciarAprenderSkill() {
    const confirmModal = document.getElementById("confirm-skill-modal");
    const btnYes = document.getElementById("confirm-skill-yes");
    const btnNo = document.getElementById("confirm-skill-no");

    if (!confirmModal || !btnYes || !btnNo) {
        return false;
    }

    btnNo.onclick = () => {
        confirmModal.style.display = "none";
    };

    btnYes.onclick = async () => {
        console.log("CLICOU SIM");

        const auth = window.auth;
        const db = window.db;

        const user = auth.currentUser;

        if (!user) {
            abrirResultado(
                "ERRO",
                "Você precisa estar logado."
            );
            return;
        }

        const skill = window.skillAtual;
        const skillUid = window.skillUid;
        const categoria = window.skillCategoria;
        const sub = window.skillSub;

        if (!skill || !skillUid) {
            abrirResultado(
                "ERRO",
                "Habilidade inválida."
            );
            return;
        }

        const playerRef = ref(db, `players/${user.uid}`);
        const playerSnap = await get(playerRef);

        if (!playerSnap.exists()) {
            abrirResultado(
                "ERRO",
                "Personagem não encontrado."
            );
            return;
        }

        const player = playerSnap.val();
        const custo = Number(skill.custo) || 0;
        const disponivel = Number(player?.points?.["skill-available"]) || 0;

        if (disponivel < custo) {
            abrirResultado(
                "ERRO",
                "Você não possui pontos suficientes."
            );
            return;
        }

        const skillRef = ref(db, `players/${user.uid}/skills/${skillUid}`);
        const skillSnap = await get(skillRef);

        if (skillSnap.exists()) {
            abrirResultado(
                "ERRO",
                "Você já aprendeu essa habilidade."
            );
            return;
        }

        // Salva a habilidade aprendida
        await set(skillRef, {
            categoria,
            sub
        });

        // Identifica qual propriedade de pontos deve ser incrementada
        const chaveCategoria = obterChavePontoCategoria(categoria, sub);

        // Atualiza todos os pontos do jogador numa única transação
        const pointsRef = ref(db, `players/${user.uid}/points`);
        await runTransaction(pointsRef, (points) => {
            if (!points) points = {};

            const disponivelAtual = Number(points["skill-available"]) || 0;
            const usadoAtual = Number(points["skill-used"]) || 0;
            const catAtual = Number(points[chaveCategoria]) || 0;

            points["skill-available"] = disponivelAtual - custo;
            points["skill-used"] = usadoAtual + custo;
            points[chaveCategoria] = catAtual + custo;

            return points;
        });

        confirmModal.style.display = "none";
        document.getElementById("ficha-modal").style.display = "none";

        abrirResultado(
            "SUCESSO",
            "Habilidade aprendida com sucesso!"
        );
    };

    return true;
}

const intervalo = setInterval(() => {
    if (iniciarAprenderSkill()) {
        clearInterval(intervalo);
    }
}, 100);
