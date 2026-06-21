import {
  ref,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const marketContainer = document.getElementById("market-container");

let marketItem = null;

function resetItemModal() {
  const modal = document.getElementById("market-item-modal");
  if (!modal) return;

  modal.querySelector("#market-item-emoji").innerHTML = "📦";
  modal.querySelector("#market-item-name").innerText = "";
  modal.querySelector("#market-item-description").innerHTML = "";
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

  // 🔥 ELEMENTOS NOVOS (BOTÃO FIXO NO HTML)
  const buyBtn = document.getElementById("market-buy-btn");
  const priceBox = document.getElementById("market-item-price");

  const confirmModal = document.getElementById("market-confirm-modal");
  const yesBtn = document.getElementById("market-confirm-yes");
  const noBtn = document.getElementById("market-confirm-no");

  let anuncios = {};
  let itensDB = {};

  // eventos fixos (SEM duplicar)
  buyBtn.onclick = null;
  yesBtn.onclick = null;
  noBtn.onclick = null;

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

    marketItem = item;

    const emojiEl = document.getElementById("market-item-emoji");
    const nameEl = document.getElementById("market-item-name");
    const descEl = document.getElementById("market-item-description");

    emojiEl.innerHTML = item.img
      ? `<img src="https://res.cloudinary.com/djh45admn/image/upload/v1778432202/${item.img}.png"
          class="item-open-img">`
      : item.emoji;

    nameEl.innerText = item.nome;

    const tierImg =
      `https://res.cloudinary.com/djh45admn/image/upload/v1779723072/tier-${item.tier}.png`;

    descEl.innerHTML = `
      <div>${item.descricao || "Sem descrição."}</div>
      <img src="${tierImg}" style="width:210px;display:block;margin:12px auto 0 auto;">
    `;

    // 🔥 atualiza preço no botão fixo
    priceBox.innerText = `฿ ${item.value.toLocaleString("pt-BR")}`;

    // abre modal do item
    itemModal.style.display = "flex";
  }

  // 🔥 BOTÃO COMPRAR (FIXO, NÃO DINÂMICO)
  buyBtn.onclick = () => {
    if (!marketItem) return;

    confirmModal.style.display = "flex";
  };

  yesBtn.onclick = () => {
    confirmModal.style.display = "none";
    itemModal.style.display = "none";

    console.log("COMPRADO:", marketItem);
  };

  noBtn.onclick = () => {
    confirmModal.style.display = "none";
  };
}

loadMarketHTML();
