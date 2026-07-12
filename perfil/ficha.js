function abrirFicha(skill){

    document.getElementById("ficha-modal")
    .style.display = "flex";


    document.getElementById("ficha-img").src =
    skill.img;


    document.getElementById("ficha-nome").innerText =
    skill.nome;


    document.getElementById("ficha-description").innerText =
    skill.description;


    document.getElementById("ficha-alcance").innerText =
    skill.alcance || "-";


    document.getElementById("ficha-alvos").innerText =
    skill.alvos || "-";


    document.getElementById("ficha-degradation").innerText =
    skill.degradation || "-";


    document.getElementById("ficha-antidodge").innerText =
    skill["anti-dodge"] || "-";

}


document
.getElementById("close-ficha")
?.addEventListener("click",()=>{

 document.getElementById("ficha-modal")
 .style.display="none";

});
