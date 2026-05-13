// ======================
// HP
// ======================
let p1HP = 100;
let p2HP = 100;

// ======================
// TURNOS
// ======================
let turn = 1;
let time = 30;

// UI
const turnEl = document.getElementById("turn");
const timeEl = document.getElementById("time");

const p1Bar = document.getElementById("p1-hp");
const p2Bar = document.getElementById("p2-hp");

const p1Text = document.getElementById("p1-hp-text");
const p2Text = document.getElementById("p2-hp-text");

// ======================
// RENDER
// ======================
function render() {

  if (p1HP < 0) p1HP = 0;
  if (p2HP < 0) p2HP = 0;

  p1Bar.style.width = p1HP + "%";
  p2Bar.style.width = p2HP + "%";

  p1Text.innerText = p1HP + " / 100";
  p2Text.innerText = p2HP + " / 100";
}

// ======================
// TURN SYSTEM
// ======================
function nextTurn() {
  turn++;
  time = 30;

  turnEl.textContent = turn;
}

// timer
setInterval(() => {
  time--;
  timeEl.textContent = time;

  if (time <= 0) {
    nextTurn();
  }

}, 1000);

// ======================
// AÇÕES
// ======================
function atacar() {
  const dano = Math.floor(Math.random() * 15) + 5;
  p2HP -= dano;
  render();
}

function defender() {
  alert("Defesa ativada (teste)");
}

function skill() {
  const dano = Math.floor(Math.random() * 25) + 10;
  p2HP -= dano;
  render();
}

// ======================
// INIT
// ======================
render();
