import {
  ref,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const marketContainer =
  document.getElementById("market-container");

let currentItem = null;

async function loadMarketHTML() {

  const response =
    await fetch("perfil/mercado.html");

  const html =
    await response.text();

  marketContainer.innerHTML = html;

  requestAnimationFrame(() => {
    initMarket();
  });
}

function initMarket() {

  const db = window.db;

  const marketModal =
    document.getElementById("market-modal");

  const closeMarket =
    document.getElementById("close-market");

  const categorySelect =
    document.getElementById("market-category");

  const marketList =
    document.getElementById("market-list");

  const itemModal =
    document.getElementById("item-modal");

  let anuncios = {};
  let itensDB = {};

  window.openMarket = async function () {

    marketModal.style.display = "flex";

    const marketSnap =
      await get(ref(db, "mercado/itens"));

    if (!marketSnap.exists()) {
      marketList.innerHTML = "Nenhum item encontrado.";
      return;
    }

    const itensSnap =
      await get(ref(db, "itens"));

    if (!itensSnap.exists()) {
      marketList.innerHTML = "Nenhum item encontrado.";
      return;
    }

    anuncios = marketSnap.val();
    itensDB = itensSnap.val();

    categorySelect.innerHTML = `
      <option value="all">Todas as Categorias</option>
    `;

    for (const categoria in itensDB) {
      categorySelect.innerHTML += `
        <option value="${categoria}">
          ${categoria}
        </option>
      `;
    }

    renderMarket("all");

    categorySelect.onchange = () => {
      renderMarket(categorySelect.value);
    };
  };

  if (closeMarket) {
    closeMarket.addEventListener("click", () => {
      marketModal.style.display = "none";
    });
  }

  function renderMarket(filtro) {

    marketList.innerHTML = "";

    const lista = [];

    for (const anuncioId in anuncios) {

      const anuncio = anuncios[anuncioId];

      const itemId = anuncio.nome;
      const value = Number(anuncio.value || 0);

      let itemData = null;

      for (const categoria in itensDB) {

        if (filtro !== "all" && categoria !== filtro) continue;

        const itens = itensDB[categoria];

        if (itens[itemId]) {
          itemData = itens[itemId];
          break;
        }
      }

      if (!itemData) continue;

      lista.push({
        anuncioId,
        itemId,
        value,
        itemData
      });
    }

    lista.sort((a, b) => a.value - b.value);

    for (const data of lista) {

      const { anuncioId, itemId, value, itemData } = data;

      const div = document.createElement("div");

      div.className = "inventory-item";

      div.innerHTML = `
        <div class="inventory-item-top">

          <span class="inventory-emoji">

            ${
              itemData.img
                ? `<img 
                  src="https://res.cloudinary.com/djh45admn/image/upload/v1778432202/${itemData.img}.png"
                  class="inventory-item-img"
                >`
              : (itemData.item || "📦")
            }

          </span>

          <div class="inventory-text">

            <div class="inventory-name-qty">

              <span class="inventory-name">
                ${itemData.nome || itemId}
              </span>

              <span class="inventory-qty">
                ฿ ${Number(value || 0).toLocaleString("pt-BR")}
              </span>

            </div>

          </div>

        </div>
      `;

      div.addEventListener("click", () => {

        currentItem = {
          id: anuncioId,
          nome: itemData.nome,
          descricao: itemData.description,
          img: itemData.img,
          value,
          tier: itemData.tier
        };

        openMarketItemModal(currentItem);
      });

      marketList.appendChild(div);
    }

    if (!marketList.children.length) {
      marketList.innerHTML = "Nenhum item encontrado.";
    }
  }
}

// 🔥 ITEM MODAL (TIER IGUAL INVENTÁRIO, SEM HTML INVENTADO)
function openMarketItemModal(item) {

  const itemModal =
    document.getElementById("item-modal");

  document.getElementById("item-emoji").innerHTML =
    item.img
      ? `<img 
          src="https://res.cloudinary.com/djh45admn/image/upload/v1778432202/${item.img}.png"
          class="item-open-img"
        >`
      : "📦";

  document.getElementById("item-name").innerText =
    item.nome;

  // 🔥 AQUI O TIER SÓ USA O MESMO CSS DO INVENTÁRIO
  document.getElementById("item-description").innerHTML =
    `
      <div>${item.descricao || "Sem descrição."}</div>

      ${
        item.tier
          ? `<img 
              src="https://res.cloudinary.com/djh45admn/image/upload/v1779723072/tier-${item.tier}.png"
              class="inventory-item-img"
            />`
          : ""
      }
    `;

  const actions =
    document.querySelector(".item-actions");

  actions.innerHTML = `
    <div class="market-actions">

      <div class="price-box">
        ฿ ${Number(item.value || 0).toLocaleString("pt-BR")}
      </div>

      <button id="buy-item">
        COMPRAR
      </button>

    </div>
  `;

  document.getElementById("buy-item").onclick = () => {
    console.log("comprar:", item.id);
  };

  itemModal.style.display = "flex";
}

loadMarketHTML();
