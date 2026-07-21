console.log("FICHA-EDIT JS CARREGOU");



async function carregarFichaEditHTML(){


const container =
document.getElementById("ficha-edit-container");


if(!container) return;



const res =
await fetch("perfil/ficha-edit.html");


container.innerHTML =
await res.text();



document
.getElementById("close-ficha-edit")
.onclick = fecharFichaEdit;



document
.getElementById("salvar-ficha-edit")
.onclick = salvarFichaEdit;


}




window.abrirFichaEdit = function(){


const skill =
window.skillAtual;



if(!skill){

console.log("Nenhuma skill");

return;

}



const modal =
document.getElementById("ficha-edit");


modal.style.display="flex";



document.getElementById("edit-img").src =
`https://res.cloudinary.com/djh45admn/image/upload/v1781908673/${skill.img}.jpg`;



document.getElementById("edit-nome").value =
skill.nome || "";


document.getElementById("edit-description").value =
skill.description || "";


document.getElementById("edit-rank").value =
skill.rank || 1;


document.getElementById("edit-categoria").value =
skill.categoria || "";


document.getElementById("edit-propriedade").value =
skill.propriedade || "";


document.getElementById("edit-alcance").value =
skill.alcance || "";


document.getElementById("edit-alvos").value =
skill.alvos || "";


document.getElementById("edit-cooldown").value =
skill.cooldown || "";



document.getElementById("edit-stm").value =
skill.atributos?.stm || "";


document.getElementById("edit-atk").value =
skill.atributos?.atk || "";


document.getElementById("edit-def").value =
skill.atributos?.def || "";


document.getElementById("edit-pow").value =
skill.atributos?.pow || "";


}




function fecharFichaEdit(){


document
.getElementById("ficha-edit")
.style.display="none";


}




function salvarFichaEdit(){


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



skill.atributos = {

stm:
Number(document.getElementById("edit-stm").value || 0),

atk:
Number(document.getElementById("edit-atk").value || 0),

def:
Number(document.getElementById("edit-def").value || 0),

pow:
Number(document.getElementById("edit-pow").value || 0)

};



console.log(
"SKILL EDITADA:",
skill
);



fecharFichaEdit();



}
