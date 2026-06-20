import {
  ref,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const marketContainer = document.getElementById("market-container");

let currentItem = null;

function resetMarketModal() {
  const modal = document.getElementById("market-item-modal");
  if (!modal) return;

  modal.querySelector("#market-item-emoji").innerHTML = "📦";
  modal.querySelector("#market-item-name").innerText = "";
  modal.querySelector("#market-item-description").innerHTML = "";
  modal.querySelector(".market-actions-container")?.innerHTML = "";
}

async function loadMarketHTML() {
  const response = await fetch("perfil/mercado.html");
  const html = await response.text();

  marketContainer.innerHTML = html;

  requestAnimationFrame(() => {
    initMarket();
  });
}

function initMarket() {
  const db = window.db;

  const marketModal = document.getElementById("market-modal");
  const closeMarket = document.getElementById("close-market");
  const categorySelect = document.getElementById("market-category");
  const marketList = document.getElementById("market-list");

  const itemModal = document.getElementById("market-item-modal");
  const buyConfirm = document.getElementById("buy-confirm-modal");

  let anuncios = {};
  let itensDB = {};

  window.openMarket = async () => {
    resetMarketModal();

    marketModal.style.display = "flex";

    const marketSnap = await get(ref(db, "mercado/itens"));
    const itensSnap = await get(ref(db, "itens"));

    if (!marketSnap.exists() || !itensSnap.exists()) return;

    anuncios = marketSnap.val();
    itensDB = itensSnap.val();

    categorySelect.innerHTML = `<option value="all">Todas</option>`;

    for (const c in itensDB) {
      categorySelect.innerHTML += `<option value="${c}">${c}</option>`;
    }

    render("all");

    categorySelect.onchange = () => render(categorySelect.value);
  };

  closeMarket.onclick = () => {
    marketModal.style.display = "none";
  };

  function render(filter) {
    marketList.innerHTML = "";

    const list = [];

    for (const id in anuncios) {
      const a = anuncios[id];
      const itemId = a.nome;

      let itemData = null;

      for (const cat in itensDB) {
        if (filter !== "all" && cat !== filter) continue;

        if (itensDB[cat][itemId]) {
          itemData = itensDB[cat][itemId];
          break;
        }
      }

      if (!itemData) continue;

      list.push({
        id,
        itemId,
        itemData,
        value: a.value
      });
    }

    for (const data of list) {
      const div = document.createElement("div");
      div.className = "inventory-item";

      div.innerHTML = `
        <div class="inventory-item-top">

          <span class="inventory-emoji">
            ${data.itemData.img
              ? `<img src="https://res.cloudinary.com/djh45admn/image/upload/v1778432202/${data.itemData.img}.png"
                class="inventory-item-img">`
              : "📦"}
          </span>

          <div class="inventory-text">
            <span class="inventory-name">${data.itemData.nome}</span>
            <span class="inventory-qty">฿ ${data.value}</span>
          </div>

        </div>
      `;

      div.onclick = () => {
        currentItem = data;

        resetMarketModal();

        itemModal.style.display = "flex";

        itemModal.querySelector("#market-item-name").innerText = data.itemData.nome;

        itemModal.querySelector("#market-item-description").innerHTML =
          data.itemData.description || "Sem descrição";

        const actions = itemModal.querySelector(".market-actions-container");

        actions.innerHTML = `
          <div class="market-actions">
            <div class="price-box">฿ ${data.value}</div>
            <button id="buy-btn">COMPRAR</button>
          </div>
        `;

        const buyBtn = actions.querySelector("#buy-btn");

        buyBtn.onclick = () => {
          buyConfirm.style.display = "flex";

          const yes = document.getElementById("buy-confirm-yes");
          const no = document.getElementById("buy-confirm-no");

          yes.onclick = () => {
            buyConfirm.style.display = "none";
            itemModal.style.display = "none";
            console.log("COMPRA:", currentItem);
          };

          no.onclick = () => {
            buyConfirm.style.display = "none";
          };
        };
      };

      marketList.appendChild(div);
    }
  }
}

loadMarketHTML();
