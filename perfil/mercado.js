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

    // 🔥 mercado (anúncios)
    const marketSnap =
      await get(ref(db, "mercado/itens"));

    if (!marketSnap.exists()) {
      marketList.innerHTML = "Nenhum item encontrado.";
      return;
    }

    // 🔥 catálogo (categorias reais)
    const itensSnap =
      await get(ref(db, "itens"));

    if (!itensSnap.exists()) {
      marketList.innerHTML = "Nenhum item encontrado.";
      return;
    }

    const anuncios = marketSnap.val();
    const itensDB = itensSnap.val();

    renderMarket(anuncios, itensDB, marketList);

  };

  if (closeMarket) {

    closeMarket.addEventListener("click", () => {
      marketModal.style.display = "none";
    });

  }
}

function renderMarket(anuncios, itensDB, marketList) {

  marketList.innerHTML = "";

  // 🔥 percorre categorias do catálogo
  for (const categoria in itensDB) {

    const categoriaDiv =
      document.createElement("div");

    categoriaDiv.className = "market-category-title";
    categoriaDiv.innerText = categoria;

    marketList.appendChild(categoriaDiv);

    let hasItems = false;

    const itens = itensDB[categoria];

    // 🔥 percorre itens da categoria
    for (const itemId in itens) {

      const itemData = itens[itemId];

      // 🔥 procura anúncios desse item
      for (const anuncioId in anuncios) {

        const anuncio = anuncios[anuncioId];

        if (anuncio.item !== itemId) continue;

        hasItems = true;

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
                  ฿ ${Number(anuncio.value || 0).toLocaleString("pt-BR")}
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
            value: anuncio.value
          };

          openMarketItemModal(currentItem);
        });

        marketList.appendChild(div);
      }
    }

    if (!hasItems) {
      const empty =
        document.createElement("div");

      empty.innerText = "Sem itens nessa categoria";
      empty.className = "empty-category";

      marketList.appendChild(empty);
    }
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
