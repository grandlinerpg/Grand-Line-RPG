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

    const itensSnap =
      await get(ref(db, "itens"));

    if (!itensSnap.exists()) {
      marketList.innerHTML =
        "Nenhum item encontrado.";
      return;
    }

    const categorias =
      itensSnap.val();

    categorySelect.innerHTML = `
      <option value="all">
        Todas as Categorias
      </option>
    `;

    for (const categoria in categorias) {

      categorySelect.innerHTML += `
        <option value="${categoria}">
          ${categoria}
        </option>
      `;
    }

    renderMarket(
      categorias,
      "all",
      marketList
    );

    categorySelect.onchange = () => {

      renderMarket(
        categorias,
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
  categorias,
  filtro,
  marketList
) {

  marketList.innerHTML = "";

  for (const categoria in categorias) {

    if (
      filtro !== "all" &&
      filtro !== categoria
    ) {
      continue;
    }

    const itens =
      categorias[categoria];

    for (const itemId in itens) {

      const itemData =
        itens[itemId];

      const div =
        document.createElement("div");

      div.className =
        "inventory-item";

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
                ฿ ${Number(
                  itemData.value || 0
                ).toLocaleString("pt-BR")}
              </span>

            </div>

          </div>

        </div>
      `;

      // 🔥 CLIQUE NO ITEM (NOVO)
      div.addEventListener("click", () => {

        currentItem = {
          id: itemId,
          nome: itemData.nome,
          descricao: itemData.description,
          img: itemData.img,
          value: itemData.value
        };

        openMarketItemModal(currentItem);
      });

      marketList.appendChild(div);
    }
  }

  if (!marketList.innerHTML.trim()) {

    marketList.innerHTML =
      "Nenhum item encontrado.";

  }
}

// 🔥 MODAL DO ITEM NO MERCADO
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
    `
      <div>
        ${item.descricao || "Sem descrição."}
      </div>
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

  document.getElementById("buy-item").addEventListener("click", () => {
    console.log("comprar item:", item.id);
    // aqui depois entra lógica de compra
  });

  itemModal.style.display = "flex";
}

loadMarketHTML();
