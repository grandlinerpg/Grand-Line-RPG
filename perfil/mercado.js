import {
  ref,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const marketContainer =
  document.getElementById("market-container");

let currentItem = null;

// 🔥 RESET GLOBAL DO ITEM MODAL
function resetItemModal() {
  const emoji = document.getElementById("item-emoji");
  const name = document.getElementById("item-name");
  const desc = document.getElementById("item-description");
  const actions = document.querySelector(".item-actions");

  if (emoji) emoji.innerHTML = "📦";
  if (name) name.innerText = "";
  if (desc) desc.innerHTML = "";
  if (actions) actions.innerHTML = "";
}

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

  // 🔥 FUNÇÃO GLOBAL
  window.openMarket = async function () {

    resetItemModal(); // evita herdar estado do inventário

    marketModal.style.display = "flex";

    const marketSnap =
      await get(ref(db, "mercado/itens"));

    const itensSnap =
      await get(ref(db, "itens"));

    if (!marketSnap.exists() || !itensSnap.exists()) {
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

  // 🔥 FECHAR MERCADO = VOLTAR PRO INVENTÁRIO (NÃO FECHA TUDO)
  if (closeMarket) {
    closeMarket.onclick = () => {

      marketModal.style.display = "none";

      // abre inventário de volta (se existir)
      const inv = document.getElementById("inventory-modal");
      if (inv) {
        inv.style.display = "flex";
      }
    };
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
                : "📦"
            }
          </span>

          <div class="inventory-text">

            <div class="inventory-name-qty">

              <span class="inventory-name">
                ${itemData.nome || itemId}
              </span>

              <span class="inventory-qty">
                ฿ ${value.toLocaleString("pt-BR")}
              </span>

            </div>

          </div>

        </div>
      `;

      div.onclick = () => {

        resetItemModal(); // 🔥 evita herdar estado antigo

        currentItem = {
          id: anuncioId,
          nome: itemData.nome,
          descricao: itemData.description,
          img: itemData.img,
          value,
          tier: Number(itemData.tier || 1)
        };

        openMarketItemModal(currentItem);
      };

      marketList.appendChild(div);
    }
  }
}

// 🔥 ITEM MODAL
function openMarketItemModal(item) {

  resetItemModal();

  const itemModal =
    document.getElementById("item-modal");

  const tierImg =
    `https://res.cloudinary.com/djh45admn/image/upload/v1779723072/tier-${item.tier}.png`;

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
      <div>${item.descricao || "Sem descrição."}</div>

      <img 
        src="${tierImg}"
        style="
          width:210px;
          display:block;
          margin:12px auto 0 auto;
        "
      />
    `;

  document.querySelector(".item-actions").innerHTML = `
    <div class="market-actions">

      <div class="price-box">
        ฿ ${item.value.toLocaleString("pt-BR")}
      </div>

      <button id="buy-item">
        COMPRAR
      </button>

    </div>
  `;

  const buyBtn = document.getElementById("buy-item");

  if (buyBtn) {
    buyBtn.onclick = () => {

      const buyConfirm =
        document.getElementById("buy-confirm-modal");

      if (!buyConfirm) return;

      buyConfirm.style.display = "flex";

      document.getElementById("buy-confirm-yes").onclick = () => {
        buyConfirm.style.display = "none";
        itemModal.style.display = "none";
        console.log("COMPRADO:", item.id);
      };

      document.getElementById("buy-confirm-no").onclick = () => {
        buyConfirm.style.display = "none";
      };
    };
  }

  itemModal.style.display = "flex";
}

loadMarketHTML();
