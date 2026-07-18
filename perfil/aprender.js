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

function iniciarAprenderSkill() {

    const confirmModal =
        document.getElementById("confirm-skill-modal");

    const btnYes =
        document.getElementById("confirm-skill-yes");

    const btnNo =
        document.getElementById("confirm-skill-no");

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

        const playerRef =
            ref(db, `players/${user.uid}`);

        const playerSnap =
            await get(playerRef);

        if (!playerSnap.exists()) {

            abrirResultado(
                "ERRO",
                "Personagem não encontrado."
            );

            return;

        }

        const player =
            playerSnap.val();

        const custo =
            Number(skill.custo) || 0;

        const disponivel =
            Number(player?.points?.["skill-available"]) || 0;

        if (disponivel < custo) {

            abrirResultado(
                "ERRO",
                "Você não possui pontos suficientes."
            );

            return;

        }

        const skillRef =
            ref(db, `players/${user.uid}/skills/${skillUid}`);

        const skillSnap =
            await get(skillRef);

        if (skillSnap.exists()) {

            abrirResultado(
                "ERRO",
                "Você já aprendeu essa habilidade."
            );

            return;

        }

        await set(skillRef, {
            categoria,
            sub
        });

        await runTransaction(
            ref(db, `players/${user.uid}/points/skill-available`),
            valor => (Number(valor) || 0) - custo
        );

        await runTransaction(
            ref(db, `players/${user.uid}/points/skill-used`),
            valor => (Number(valor) || 0) + custo
        );

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
