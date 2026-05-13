// HP fake inicial (teste)
let p1HP = 100;
let p2HP = 100;

// update UI
function render() {
  document.getElementById("p1-hp").style.width = p1HP + "%";
  document.getElementById("p2-hp").style.width = p2HP + "%";

  document.getElementById("p1-hp-text").innerText = p1HP + " / 100";
  document.getElementById("p2-hp-text").innerText = p2HP + " / 100";
}

// ações fake

function atacar() {
  const dano = Math.floor(Math.random() * 15) + 5;
  p2HP -= dano;

  if (p2HP < 0) p2HP = 0;

  render();
}

function defender() {
  alert("Defesa ativada (teste)");
}

function skill() {
  const dano = Math.floor(Math.random() * 25) + 10;
  p2HP -= dano;

  if (p2HP < 0) p2HP = 0;

  render();
}

// inicial
render();
