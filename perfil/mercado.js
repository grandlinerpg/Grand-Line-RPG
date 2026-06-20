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

  window.openMarket = async function () {

    marketModal.style.display = "flex";

    // 🔥 1. mercado (somente anúncios)
    const marketSnap =
      await get(ref(db, "mercado/itens"));

    if (!marketSnap.exists()) {
      marketList.innerHTML =
        "Nenhum item encontrado.";
      return;
    }

    // 🔥 2. base de itens (dados completos)
    const itensSnap =
      await get(ref(db, "itens"));

    if (!itensSnap.exists()) {
      marketList.innerHTML =
        "Nenhum item encontrado.";
      return;
    }

    const marketItems =
      marketSnap.val();

    const itensDB =
      itensSnap.val();

    // categoria só visual
    categorySelect.innerHTML = `
      <option value="all">Todos</option>
    `;

    const cats = new Set();

    for (const id in marketItems) {
      const m = marketItems[id];
      if (m.categoria) cats.add(m.categoria);
    }

    cats.forEach(cat => {
      categorySelect.innerHTML += `
        <option value="${cat}">
          ${cat}
        </option>
      `;
    });

    renderMarket(marketItems, itensDB, "all", marketList);

    categorySelect.onchange = () => {
      renderMarket(
        marketItems,
        itensDB,
        categorySelect.value,
        marketList
      );
    };
  };

  if (closeMarket) {

    closeMarket.addEventListener("click", () => {

      marketModal.style.display = "none";

      const inventoryModal =
        document.getElementById("inventory-modal");

      if (inventoryModal) {
        inventoryModal.style.display = "flex";
      }

    });

  }
}

function renderMarket(
  marketItems,
  itensDB,
  filtro,
  marketList
) {

  marketList.innerHTML = "";

  for (const id in marketItems) {

    const anuncio =
      marketItems[id];

    const itemId = anuncio.item;
    const value = anuncio.value;

    // 🔥 procura o item em TODAS categorias
    let itemData = null;

    for (const cat in itensDB) {
      if (itensDB[cat][itemId]) {
        itemData = itensDB[cat][itemId];
        break;
      }
    }

    if (!itemData) continue;

    // filtro opcional por categoria
    if (
      filtro !== "all" &&
      anuncio.categoria !== filtro
    ) {
      continue;
    }

    const div =
      document.createElement("div");

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
              : "📦"
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
        id,
        nome: itemData.nome,
        descricao: itemData.description,
        img: itemData.img,
        value
      };

      openMarketItemModal(currentItem);
    });

    marketList.appendChild(div);
  }

  if (!marketList.children.length) {
    marketList.innerHTML =
      "Nenhum item encontrado.";
  }
}

// 🔥 MODAL
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

  document.getElementById("item-description").innerHTML =
    `<div>${item.descricao || "Sem descrição."}</div>`;

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

  document.getElementById("buy-item").addEventListener("click", () => {
    console.log("comprar:", item.id);
  });

  itemModal.style.display = "flex";
}

loadMarketHTML();
