import {
  ref,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const container = document.getElementById("skills-container");

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

      const categoria =
        skillPlayer.categoria;

      const data =
        habilidadesDB[categoria]?.[skillId];

      if (!data) continue;

      const filtro =
        categorySelect?.value || "all";

      if (
        filtro !== "all" &&
        categoria !== filtro
      ) {
        continue;
      }

      const rank =
        Number(data.rank || 1);

      if (!ranks[rank]) {
        ranks[rank] = [];
      }

      ranks[rank].push(data.nome);
    }

    const ordemRanks = [1, 2, 3, 4, 5];

    ordemRanks.forEach(rank => {

      if (!ranks[rank]?.length) return;

      const title = document.createElement("div");

      title.className = "skill-rank";

      title.innerText =
        `${nomesRank[rank]}`;

      list.appendChild(title);

      ranks[rank].forEach(nome => {

        const div = document.createElement("div");

        div.className = "skill-item";

        div.innerHTML = `
          <span>${nome}</span>
        `;

        list.appendChild(div);

      });

    });

    if (list.innerHTML === "") {
      list.innerHTML =
        "Nenhuma habilidade encontrada.";
    }
  }

  newBtn.addEventListener("click", async () => {

    modal.style.display = "flex";
    list.innerHTML = "Carregando...";

    const user = auth.currentUser;
    if (!user) return;

    const playerSnap =
      await get(ref(db, `players/${user.uid}`));

    const habSnap =
      await get(ref(db, `habilidades`));

    if (!playerSnap.exists() || !habSnap.exists())
      return;

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

  categorySelect?.addEventListener(
    "change",
    renderSkills
  );

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });
  }
}

loadSkillsHTML();
