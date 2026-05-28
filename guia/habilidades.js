/* 🔥 ABRIR JANELA DE TESTE */
export function abrirHabilidades(estiloNome){

  const modal = document.getElementById("habilidades-modal");
  const container = document.getElementById("habilidades-container");

  if(!modal || !container){
    console.error("Modal de habilidades não encontrado no HTML");
    return;
  }

  modal.style.display = "flex";

  container.innerHTML = `
    <div class="habilidade-tier-sep">
      <img src="https://res.cloudinary.com/djh45admn/image/upload/v1779847983/tier-1.png">
    </div>

    <div class="habilidade-item">
      <span>Teste de habilidade 1 - ${estiloNome}</span>
    </div>

    <div class="habilidade-item">
      <span>Teste de habilidade 2</span>
    </div>

    <div class="habilidade-item">
      <span>Teste de habilidade 3</span>
    </div>
  `;
}

/* 🔥 FECHAR JANELA */
export function fecharHabilidades(){

  const modal = document.getElementById("habilidades-modal");
  const container = document.getElementById("habilidades-container");

  if(modal) modal.style.display = "none";
  if(container) container.innerHTML = "";
}
