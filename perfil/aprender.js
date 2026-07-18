console.log("APRENDER.JS CARREGOU");

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

        confirmModal.style.display = "none";

        const skill = window.skillAtual;

        if (!skill) {
            console.log("Nenhuma habilidade selecionada.");
            return;
        }

        console.log("Aprendendo habilidade:", skill);

        // ====================================
        // AQUI VAI A LÓGICA DE APRENDER
        // ====================================

    };

    return true;

}

const intervalo = setInterval(() => {

    if (iniciarAprenderSkill()) {

        clearInterval(intervalo);

    }

}, 100);
