console.log("CARD.JS CARREGOU");

const cardContainer =
document.getElementById("card-container");

async function carregarCardHTML(){

    if(!cardContainer) return;

    const res =
    await fetch("perfil/card.html");

    cardContainer.insertAdjacentHTML(
        "beforeend",
        await res.text()
    );

    document
    .getElementById("close-card")
    ?.addEventListener("click",()=>{

        document.getElementById(
            "card-modal"
        ).style.display="none";

    });

}

carregarCardHTML();

window.abrirCard=function(skill){

    document.getElementById(
        "card-modal"
    ).style.display="flex";

    document.getElementById("card-img").src=
    `https://res.cloudinary.com/djh45admn/image/upload/v1781908673/${skill.img}.jpg`;

    document.getElementById("card-nome").innerText=
    skill.nome||"-";

    const ranks={
        1:"INICIANTE",
        2:"APRENDIZ",
        3:"NOVATO",
        4:"INTERMEDIÁRIO",
        5:"VETERANO"
    };

    document.getElementById("card-rank").innerText=
    ranks[skill.rank]||"-";

    document.getElementById("card-atk").innerText=
    `ATK ${skill.atributos?.atk ?? "-"}`;

    document.getElementById("card-def").innerText=
    `DEF ${skill.atributos?.def ?? "-"}`;

    document.getElementById("card-stm").innerText=
    `STM ${skill.atributos?.stm ?? "-"}`;

    document.getElementById("card-pow").innerText=
    `POW ${skill.atributos?.pow ?? "-"}`;

};
