import {
  ref,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const marketContainer = document.getElementById("market-container");

let marketItem = null; // 🔥 isolado (não conflita com inventário)

function resetItemModal() {
  const modal = document.getElementById("market-item-modal");
  if (!modal) return;

  modal.querySelector("#market-item-emoji").innerHTML = "📦";
  modal.querySelector("#market-item-name").innerText = "";
  modal.querySelector("#market-item-description").innerHTML = "";
  modal.querySelector(".item-actions").innerHTML = "";
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
  const confirmModal = document.getElementById("buy-confirm-modal");

  const yesBtnOld = document.getElementById("buy-confirm-yes");
  const noBtnOld = document.getElementById("buy-confirm-no");

  const yesBtn = yesBtnOld.cloneNode(true);
  const noBtn = noBtnOld.cloneNode(true);

  yesBtnOld.replaceWith(yesBtn);
  noBtnOld.replaceWith(noBtn);
  
  let anuncios = {};
  let itensDB = {};

  window.openMarket = async () => {
    resetItemModal();

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

  function getEmoji(itemData) {
    return itemData.emoji || itemData.icon || itemData.item || "📦";
  }

  function render(filter) {
    marketList.innerHTML = "";

    for (const id in anuncios) {
      const a = anuncios[id];
      const itemId = a.nome;
      const value = Number(a.value || 0);

      let itemData = null;

      for (const cat in itensDB) {
        if (filter !== "all" && cat !== filter) continue;

        if (itensDB[cat][itemId]) {
          itemData = itensDB[cat][itemId];
          break;
        }
      }

      if (!itemData) continue;

      const div = document.createElement("div");
      div.className = "inventory-item";

      div.innerHTML = `
        <div class="inventory-item-top">
          <span class="inventory-emoji">
            ${itemData.img
              ? `<img src="https://res.cloudinary.com/djh45admn/image/upload/v1778432202/${itemData.img}.png"
                  class="inventory-item-img">`
              : getEmoji(itemData)}
          </span>

          <div class="inventory-text">
            <div class="inventory-name-qty">
              <span class="inventory-name">${itemData.nome}</span>
              <span class="inventory-qty">฿ ${value.toLocaleString("pt-BR")}</span>
            </div>
          </div>
        </div>
      `;

      div.onclick = () => openItem({
        id,
        nome: itemData.nome,
        descricao: itemData.description,
        img: itemData.img,
        value,
        tier: Number(itemData.tier || 1),
        emoji: getEmoji(itemData)
      });

      marketList.appendChild(div);
    }
  }

  function openItem(item) {
    resetItemModal();

    marketItem = item; // 🔥 isolado do inventário

    const emojiEl = document.getElementById("market-item-emoji");
    const nameEl = document.getElementById("market-item-name");
    const descEl = document.getElementById("market-item-description");
    const actions = itemModal.querySelector(".item-actions");

    emojiEl.innerHTML = item.img
      ? `<img src="https://res.cloudinary.com/djh45admn/image/upload/v1778432202/${item.img}.png"
          class="item-open-img">`
      : item.emoji;

    nameEl.innerText = item.nome;

    const tierImg =
      `https://res.cloudinary.com/djh45admn/image/upload/v1779723072/tier-${item.tier}.png`;

    descEl.innerHTML = `
      <div>${item.descricao || "Sem descrição."}</div>
      <div>Preço: ฿ ${item.value.toLocaleString("pt-BR")}</div>
      <img src="${tierImg}" style="width:210px;display:block;margin:12px auto 0 auto;">
    `;

    actions.innerHTML = `
      <div class="market-actions">
        <div class="price-box">฿ ${item.value.toLocaleString("pt-BR")}</div>
        <button id="buy-item">COMPRAR</button>
      </div>
    `;

    const buyBtn = actions.querySelector("#buy-item");

    buyBtn.onclick = () => {
      confirmModal.style.display = "flex";

      yesBtn.onclick = null;
      noBtn.onclick = null;

      yesBtn.onclick = () => {
        confirmModal.style.display = "none";
        itemModal.style.display = "none";

        // 🔥 usa ITEM DO MERCADO (não mistura com inventário)
        console.log("COMPRADO:", marketItem);
      };

      noBtn.onclick = () => {
        confirmModal.style.display = "none";
      };
    };

    itemModal.style.display = "flex";
  }
}

loadMarketHTML();
