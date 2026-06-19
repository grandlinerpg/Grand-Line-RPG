import {
  ref,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const container = document.getElementById("atributos-container"); 
// pode trocar se quiser outro container

async function loadSkillsHTML() {

  const res = await fetch("perfil/skills.html");
  const html = await res.text();

  container.innerHTML = html;

  requestAnimationFrame(() => {
    initSkills();
  });
}

function initSkills() {

  const auth = window.auth;
  const db = window.db;

  const openBtn = document.getElementById("open-skills");
  const modal = document.getElementById("skills-modal");
  const closeBtn = document.getElementById("close-skills");

  const list = document.getElementById("skills-list");

  const availableEl = document.getElementById("skill-available");
  const usedEl = document.getElementById("skill-used");

  if (!openBtn || !modal || !list) return;

  const newBtn = openBtn.cloneNode(true);
  openBtn.parentNode.replaceChild(newBtn, openBtn);

  newBtn.addEventListener("click", async () => {

    modal.style.display = "flex";
    list.innerHTML = "Carregando...";

    const user = auth.currentUser;
    if (!user) return;

    const playerSnap = await get(ref(db, `players/${user.uid}`));
    const habSnap = await get(ref(db, `habilidades`));

    if (!playerSnap.exists() || !habSnap.exists()) return;

    const player = playerSnap.val();
    const habilidades = habSnap.val();

    const skills = player.skills || {};
    const points = player.points || {};

    availableEl.innerText = points["skill-avaiable"] || 0;
    usedEl.innerText = points["skill-used"] || 0;

    list.innerHTML = "";

    const categorias = {};

    // 🔥 organizar skills por categoria
    for (const skillId in skills) {

      const categoria = skills[skillId].categoria;
      const data = habilidades[categoria]?.[skillId];

      if (!data) continue;

      if (!categorias[categoria]) {
        categorias[categoria] = [];
      }

      categorias[categoria].push(data.nome);
    }

    // 🔥 render
    for (const categoria in categorias) {

      const title = document.createElement("div");
      title.className = "skill-category";
      title.innerText = categoria.toUpperCase();

      list.appendChild(title);

      categorias[categoria].forEach(nome => {

        const div = document.createElement("div");
        div.className = "skill-item";

        div.innerHTML = `
          <span>${nome}</span>
        `;

        list.appendChild(div);
      });
    }

    if (Object.keys(categorias).length === 0) {
      list.innerHTML = "Nenhuma habilidade desbloqueada.";
    }

  });

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });
  }
}

loadSkillsHTML();
