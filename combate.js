// ======================
// HP inicial (teste)
// ======================
let p1HP = 100;
let p2HP = 100;

// ======================
// ELEMENTOS UI
// ======================
const p1Bar = document.getElementById("p1-hp");
const p2Bar = document.getElementById("p2-hp");

const p1Text = document.getElementById("p1-hp-text");
const p2Text = document.getElementById("p2-hp-text");

// ======================
// RENDER HP
// ======================
function render() {

  // trava valores
  if (p1HP < 0) p1HP = 0;
  if (p2HP < 0) p2HP = 0;
  if (p1HP > 100) p1HP = 100;
  if (p2HP > 100) p2HP = 100;

  // barra
  if (p1Bar) p1Bar.style.width = p1HP + "%";
  if (p2Bar) p2Bar.style.width = p2HP + "%";

  // texto
  if (p1Text) p1Text.innerText = p1HP + " / 100";
  if (p2Text) p2Text.innerText = p2HP + " / 100";
}

// ======================
// ATAQUE NORMAL
// ======================
function atacar() {

  const dano = Math.floor(Math.random() * 15) + 5;
  p2HP -= dano;

  console.log("Dano causado:", dano);

  render();
  checkGame();
}

// ======================
// DEFESA (teste simples)
// ======================
function defender() {
  console.log("Defesa ativada");
  alert("Defesa ativada (teste)");
}

// ======================
// SKILL (dano maior)
// ======================
function skill() {

  const dano = Math.floor(Math.random() * 25) + 10;
  p2HP -= dano;

  console.log("Skill usada:", dano);

  render();
  checkGame();
}

// ======================
// CHECAR FIM DE JOGO
// ======================
function checkGame() {

  if (p1HP <= 0) {
    alert("Você perdeu!");
    reset();
  }

  if (p2HP <= 0) {
    alert("Você venceu!");
    reset();
  }
}

// ======================
// RESET BATALHA
// ======================
function reset() {
  p1HP = 100;
  p2HP = 100;
  render();
}

// ======================
// INIT
// ======================
render();
