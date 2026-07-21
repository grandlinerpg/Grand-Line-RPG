import {
  ref,
  get,
  onValue,
  off
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

let playerRef = null;
let playerCallback = null;

let habilidadesRef = null;
let habilidadesCallback = null;

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
  let playerSkills = new Set();

  function normalize(str) {
    return (str || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g,"-");
  }

  async function getHabilidadesComHeranca(categoria, nome){

    const permitidos = new Set();

    const fila = [
      nome
    ];

    const visitados = new Set();


    while(fila.length){

      const atual = fila.shift();


      if(!atual || visitados.has(atual))
        continue;


      visitados.add(atual);


      const snap =
        await get(
          ref(
            db,
            `habilidades/${categoria}/${atual}`
          )
        );


      if(!snap.exists())
        continue;


      const data = snap.val();


      permitidos.add(atual);


      if(data.heranca)
        fila.push(data.heranca);


      if(data.heranca2)
        fila.push(data.heranca2);


      if(data.heranca3)
        fila.push(data.heranca3);

    }


    return permitidos;

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

            // IGNORA CONFIGURAÇÃO DE HERANÇA
            if(
              skillId === "heranca" ||
              skillId === "heranca2" ||
              skillId === "heranca3"
            ){
              continue;
            }


          const skill = habilidadesDB[categoria][sub][skillId];

          // Não mostrar skills que o jogador já possui
          if (playerSkills.has(skillId)) {
            continue;
          }

          const skillSub = sub;

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
            skillId,
            categoria,
            sub
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

      skillsPorRank[rank].forEach(({ skill, skillId, categoria, sub }) => {

        const div =
          document.createElement("div");

        div.className = "skill-item";

        div.innerHTML = `
          <img 
            src="https://res.cloudinary.com/djh45admn/image/upload/v1781908673/${skill.img}.jpg"
            class="skill-icon"
            alt="${skill.nome}"
          />
          <span class="skill-name">
            ${skill.nome || skillId}
          </span>
        `;

        div.onclick = () => {

          if(window.abrirFicha){

            window.abrirFicha(
              skill,
              true,
              true,
              false,
              skillId,
              categoria,
              sub
          );

          }else{

            console.log("ficha.js não carregado");

          }

        };

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


    if (playerRef && playerCallback) {
        off(playerRef, "value", playerCallback);
    }

    if (habilidadesRef && habilidadesCallback) {
        off(habilidadesRef, "value", habilidadesCallback);
    }

    playerRef = ref(db, `players/${user.uid}`);
    habilidadesRef = ref(db, "habilidades");

    playerCallback = onValue(playerRef, async (snapshot) => {

      if (!snapshot.exists()) return;

      const player = snapshot.val();

      playerSkills.clear();

      if (player.skills) {
        Object.keys(player.skills).forEach(id => {
          playerSkills.add(id);
        });
      }

      playerMap = {

        "Estilo de Luta":
          await getHabilidadesComHeranca(
            "Estilo de Luta",
            player.character?.style
          ),

        "Raças":
          await getHabilidadesComHeranca(
            "Raças",
            player.character?.race
          ),

        "Akuma no Mi":
          await getHabilidadesComHeranca(
            "Akuma no Mi",
            player.character?.fruit
          )

      };

      renderSkills();

    });

    habilidadesCallback = onValue(habilidadesRef, (snapshot) => {

      if (!snapshot.exists()) return;

      habilidadesDB = snapshot.val();

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
  
  });

  categorySelect?.addEventListener("change", renderSkills);

  closeBtn?.addEventListener("click", () => {

    modal.style.display = "none";

    if (playerRef && playerCallback) {
      off(playerRef, "value", playerCallback);
      playerRef = null;
      playerCallback = null;
    }

    if (habilidadesRef && habilidadesCallback) {
      off(habilidadesRef, "value", habilidadesCallback);
      habilidadesRef = null;
      habilidadesCallback = null;
    }  

  });
}

loadMarketSkillsHTML();
