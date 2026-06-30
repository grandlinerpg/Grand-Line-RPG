import {
  ref,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const container = document.getElementById("skills-container");

async function loadSkillsHTML() {

  const res = await fetch("perfil/skills.html");
  const html = await res.text();

  container.insertAdjacentHTML(
    "beforeend",
    html
  );

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

  const categorySelect =
    document.getElementById("skills-category");

  if (!openBtn || !modal || !list) return;

  let playerSkills = {};
  let habilidadesDB = {};

  const newBtn = openBtn.cloneNode(true);
  openBtn.parentNode.replaceChild(newBtn, openBtn);

  function renderSkills() {

    list.innerHTML = "";

    const ranks = {};

    const nomesRank = {
      1: "INICIANTE",
      2: "APRENDIZ",
      3: "NOVATO",
      4: "INTERMEDIÁRIO",
      5: "VETERANO"
    };

    for (const skillId in playerSkills) {

      const skillPlayer = playerSkills[skillId];

      const categoria = skillPlayer.categoria;
      const sub = skillPlayer.sub;

      const data =
        habilidadesDB[categoria]?.[sub]?.[skillId];

      if (!data) continue;

      const filtro =
        categorySelect?.value || "all";

      if (filtro !== "all" && categoria !== filtro) {
        continue;
      }

      const rank = Number(data.rank || 1);

      if (!ranks[rank]) {
        ranks[rank] = [];
      }

      ranks[rank].push({
        nome: data.nome,
        img: skillId
      });
    }

    const ordemRanks = [1, 2, 3, 4, 5];

    ordemRanks.forEach(rank => {

      if (!ranks[rank] || ranks[rank].length === 0) return;

      const title = document.createElement("div");
      title.className = "skill-rank";
      title.innerText = nomesRank[rank];

      list.appendChild(title);

      ranks[rank].forEach(skill => {

        const div = document.createElement("div");
        div.className = "skill-item";

        div.innerHTML = `
          <img 
            src="https://res.cloudinary.com/djh45admn/image/upload/v1781908673/${skill.img}.jpg"
            class="skill-icon"
            alt="${skill.nome}"
          />
          <span>${skill.nome}</span>
        `;

        list.appendChild(div);
      });
    });

    if (!list.children.length) {
      list.innerHTML = "Nenhuma habilidade encontrada.";
    }
  }

  // 🔥 CORREÇÃO ÚNICA: espera o auth estabilizar antes de buscar dados
  newBtn.addEventListener("click", async () => {

    modal.style.display = "flex";
    list.innerHTML = "Carregando...";

    let user = auth.currentUser;

    if (!user) {
      await new Promise(resolve => {
        const unsub = auth.onAuthStateChanged(u => {

          if (!u) return;

          user = u;

          unsub();
          resolve();

        });
      });
    }

    if (!user) {
      list.innerHTML = "Você não está logado.";
      return;
    }

    const playerSnap =
      await get(ref(db, `players/${user.uid}`));

    const habSnap =
      await get(ref(db, `habilidades`));

    if (!playerSnap.exists() || !habSnap.exists()) {
      list.innerHTML = "Nenhuma habilidade encontrada.";
      return;
    }

    const player = playerSnap.val();

    playerSkills = player.skills || {};
    habilidadesDB = habSnap.val();

    const points = player.points || {};

    availableEl.innerText =
      points["skill-avaiable"] || 0;

    usedEl.innerText =
      points["skill-used"] || 0;

    if (categorySelect) {

      categorySelect.innerHTML =
        `<option value="all">Todas Categorias</option>`;

      for (const categoria in habilidadesDB) {

        categorySelect.innerHTML += `
          <option value="${categoria}">
            ${categoria}
          </option>
        `;
      }
    }

    renderSkills();
  });

  categorySelect?.addEventListener("change", renderSkills);

  closeBtn?.addEventListener("click", () => {
    modal.style.display = "none";
  });
}

loadSkillsHTML();
