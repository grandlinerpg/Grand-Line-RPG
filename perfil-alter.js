import {
  ref,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

export function initPerfilAlter(){

  const modal = document.getElementById("perfil-alter-modal");

  const close =
    document.getElementById("close-perfil-alter");

  if(!modal) return;


  window.abrirPerfilAlter = async function(){

    const user = window.auth.currentUser;

    if(!user) return;


    const snap =
      await get(ref(window.db,`players/${user.uid}`));


    if(!snap.exists()) return;


    const player = snap.val();


    const charName =
      player.character?.charName || "Desconhecido";


    const nome =
      player.nome || "Sem nome";


    const img =
      buildImage(charName);


    document.getElementById("alter-img").src = img;

    document.getElementById("alter-charname").innerText =
      charName;

    document.getElementById("alter-nome").innerText =
      nome;

    document.getElementById("alter-level").innerText =
      player.info?.level || 1;

    document.getElementById("alter-exp").innerText =
      (player.info?.exp || 0)
      .toLocaleString("pt-BR");

    document.getElementById("alter-saldo").innerText =
      "฿ " + (player.info?.saldo || 0)
      .toLocaleString("pt-BR");


    modal.style.display = "flex";

  };


  close.onclick = ()=>{

    modal.style.display = "none";

  };


  modal.onclick = (e)=>{

    if(e.target === modal){

      modal.style.display = "none";

    }

  };

}



function buildImage(charName){

  const personagem =
    (charName || "default")
    .toLowerCase()
    .replaceAll(" ","-")
    .replaceAll(".","")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"");


  return `https://res.cloudinary.com/djh45admn/image/upload/v1778334616/${personagem}.png`;

}
