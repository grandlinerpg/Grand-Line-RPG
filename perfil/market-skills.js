import {
  ref,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const container =
  document.getElementById("skills-container");

async function loadMarketSkillsHTML() {

  console.log("A - loadMarketSkillsHTML");

  const response =
    await fetch("perfil/market-skills.html");

  const html =
    await response.text();
  console.log("B - HTML carregado");

  container.insertAdjacentHTML(
    "beforeend",
    html
  );
  console.log("C - HTML inserido");

  requestAnimationFrame(() => {
    initMarketSkills();
  });
}

function initMarketSkills() {
console.log("D - initMarketSkills");
  const auth = window.auth;
  const db = window.db;

  const modal =
    document.getElementById("market-skills-modal");

  const closeBtn =
    document.getElementById("close-market-skills");

  const list =
    document.getElementById("market-skills-list");

  const categorySelect =
    document.getElementById("market-skills-category");

  if (!modal || !list) return;

  let habilidadesDB = {};
  let playerMap = {};

  function normalize(str) {
    return (str || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  }

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

      const allowed = playerMap[categoria];

      for (const sub in habilidadesDB[categoria]) {

        for (const skillId in habilidadesDB[categoria][sub]) {

          const skill = habilidadesDB[categoria][sub][skillId];

          const skillSub = normalize(sub);

          // 🔥 AGORA COMPARAÇÃO REALMENTE SEGURA
          if (allowed && !allowed.has(skillSub)) {
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

  document.addEventListener("click", async (e) => {

    if (!e.target.closest("#open-skill-tree")) {
      return;
    }
    
    modal.style.display = "flex";
    list.innerHTML = "Carregando...";

    let user = auth.currentUser;

    if (!user) {
      await new Promise(resolve => {
        const unsub = auth.onAuthStateChanged(u => {
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
    console.log("8 - Player existe:", playerSnap.exists());
    const snap =
      await get(ref(db, "habilidades"));

    if (!snap.exists() || !playerSnap.exists()) {
      list.innerHTML = "Nenhuma habilidade encontrada.";
      return;
    }

    const player = playerSnap.val();

    const normalize = (str) =>
      (str || "")
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();

    // 🔥 MAPEAMENTO CORRETO POR TIPO
    playerMap = {
      "estilo-de-luta": new Set([normalize(player?.character?.style)]),
      "raça/tribo": new Set([normalize(player?.character?.race)]),
      "akuma-no-mi": new Set([normalize(player?.character?.fruit)])
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
