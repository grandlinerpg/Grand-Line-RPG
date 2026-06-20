import {
  ref,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const container =
  document.getElementById("skills-container");

async function loadMarketSkillsHTML() {

  const response =
    await fetch("perfil/market-skills.html");

  const html =
    await response.text();

  container.insertAdjacentHTML(
    "beforeend",
    html
  );

  requestAnimationFrame(() => {
    initMarketSkills();
  });
}

function initMarketSkills() {

  const auth = window.auth;
  const db = window.db;

  const openBtn =
    document.getElementById("open-skill-tree");

  const modal =
    document.getElementById("market-skills-modal");

  const closeBtn =
    document.getElementById("close-market-skills");

  const list =
    document.getElementById("market-skills-list");

  const categorySelect =
    document.getElementById("market-skills-category");

  if (!openBtn || !modal || !list) return;

  let habilidadesDB = {};
  let allowedMap = {}; // 🔥 NOVO (categoria → sub)

  function renderSkills() {

    list.innerHTML = "";

    const filtro =
      categorySelect?.value || "all";

    const rankNames = {
      1: "INICIANTE",
      2: "APRENDIZ",
      3: "NOVATO",
      4: "INTERMEDIÁRIO",
      5: "VETERANO"
    };

    const skillsPorRank = {
      1: [],
      2: [],
      3: [],
      4: [],
      5: []
    };

    for (const categoria in habilidadesDB) {

      if (filtro !== "all" && categoria !== filtro) {
        continue;
      }

      for (const sub in habilidadesDB[categoria]) {

        const skills = habilidadesDB[categoria][sub];

        for (const skillId in skills) {

          const skill = skills[skillId];

          // 🔥 FILTRO CERTO AGORA
          const allowedSubs = allowedMap[categoria];

          if (allowedSubs && !allowedSubs.has(sub)) {
            continue;
          }

          const rank = Number(skill.rank) || 1;

          if (!skillsPorRank[rank]) {
            skillsPorRank[rank] = [];
          }

          skillsPorRank[rank].push({
            skill,
            skillId
          });
        }
      }
    }

    for (let rank = 1; rank <= 5; rank++) {

      if (!skillsPorRank[rank]?.length) continue;

      const rankTitle =
        document.createElement("div");

      rankTitle.className = "skill-rank";
      rankTitle.textContent = rankNames[rank];

      list.appendChild(rankTitle);

      skillsPorRank[rank].forEach(({ skill, skillId }) => {

        const div =
          document.createElement("div");

        div.className = "skill-item";

        div.innerHTML = `
          <img 
            src="https://res.cloudinary.com/djh45admn/image/upload/v1781908673/${skillId}.jpg"
            class="skill-icon"
            alt="${skill.nome}"
          />

          <span class="skill-name">
            ${skill.nome || skillId}
          </span>
        `;

        list.appendChild(div);
      });
    }

    if (!list.children.length) {
      list.innerHTML = "Nenhuma habilidade encontrada.";
    }
  }

  openBtn.addEventListener("click", async () => {

    modal.style.display = "flex";
    list.innerHTML = "Carregando...";

    const user = auth.currentUser;
    if (!user) return;

    const playerSnap =
      await get(ref(db, `players/${user.uid}`));

    const snap =
      await get(ref(db, "habilidades"));

    if (!snap.exists() || !playerSnap.exists()) {
      list.innerHTML = "Nenhuma habilidade encontrada.";
      return;
    }

    const player = playerSnap.val();

    // 🔥 MAPEAMENTO REAL DO PERSONAGEM
    allowedMap = {
      "estilo-de-luta": new Set([
        player?.character?.style
      ].filter(Boolean)),

      "raça/tribo": new Set([
        player?.character?.race
      ].filter(Boolean)),

      "akuma-no-mi": new Set([
        player?.character?.fruit
      ].filter(Boolean))
    };

    habilidadesDB = snap.val();

    categorySelect.innerHTML =
      `<option value="all">Todas Categorias</option>`;

    for (const categoria in habilidadesDB) {
      categorySelect.innerHTML += `
        <option value="${categoria}">
          ${categoria}
        </option>
      `;
    }

    renderSkills();
  });

  categorySelect?.addEventListener("change", renderSkills);

  closeBtn?.addEventListener("click", () => {
    modal.style.display = "none";
  });
}

loadMarketSkillsHTML();
