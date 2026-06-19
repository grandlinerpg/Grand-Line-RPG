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
    document.getElementById(
      "market-skills-category"
    );

  if (
    !openBtn ||
    !modal ||
    !list
  ) return;

  let habilidadesDB = {};

  function renderSkills() {

    list.innerHTML = "";

    const filtro =
      categorySelect?.value || "all";

    for (const categoria in habilidadesDB) {

      if (
        filtro !== "all" &&
        categoria !== filtro
      ) {
        continue;
      }

      const divider =
        document.createElement("div");

      divider.className =
        "skills-category";

      divider.innerText =
        categoria.toUpperCase();

      list.appendChild(divider);

      for (const skillId in habilidadesDB[categoria]) {

        const skill =
          habilidadesDB[categoria][skillId];

        const div =
          document.createElement("div");

        div.className =
          "inventory-item";

        div.innerHTML = `
          <div class="inventory-item-top">

            <div class="inventory-text">

              <div
                class="inventory-name-qty"
                style="
                  width:100%;
                  justify-content:space-between;
                "
              >

                <span class="inventory-name">
                  ${skill.nome || skillId}
                </span>

                <span class="inventory-qty">
                  ${skill.cost || 1} HA
                </span>

              </div>

            </div>

          </div>
        `;

        list.appendChild(div);
      }
    }
  }

  openBtn.addEventListener(
    "click",
    async () => {

      modal.style.display = "flex";

      list.innerHTML =
        "Carregando...";

      const snap =
        await get(
          ref(db, "habilidades")
        );

      if (!snap.exists()) {
        list.innerHTML =
          "Nenhuma habilidade encontrada.";
        return;
      }

      habilidadesDB =
        snap.val();

      categorySelect.innerHTML =
        `<option value="all">
          Todas Categorias
        </option>`;

      for (const categoria in habilidadesDB) {

        categorySelect.innerHTML += `
          <option value="${categoria}">
            ${categoria}
          </option>
        `;
      }

      renderSkills();
    }
  );

  categorySelect?.addEventListener(
    "change",
    renderSkills
  );

  closeBtn?.addEventListener(
    "click",
    () => {
      modal.style.display = "none";
    }
  );
}

loadMarketSkillsHTML();
