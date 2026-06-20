import {
  ref,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const modalContainer = document.getElementById("inventory-container");

let currentItem = null;

// 🔥 RESET GLOBAL DO ITEM MODAL (ADICIONADO)
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

async function loadInventoryHTML() {

  const response = await fetch("perfil/inventario.html");
  const html = await response.text();

  modalContainer.innerHTML = "";
  modalContainer.innerHTML = html;

  requestAnimationFrame(() => {
    initInventory();
  });
}

function initInventory() {

  const auth = window.auth;
  const db = window.db;

  const openBtn = document.getElementById("open-inventory");
  const inventoryModal = document.getElementById("inventory-modal");
  const closeInventory = document.getElementById("close-inventory");

  const itemModal = document.getElementById("item-modal");
  const closeItem = document.getElementById("close-item");

  const inventoryList = document.getElementById("inventory-list");

  const saldoElement = document.getElementById("inventory-saldo");
  const marketBtn = document.getElementById("open-market");

  const confirmModal = document.getElementById("confirm-modal");
  const confirmYes = document.getElementById("confirm-yes");
  const confirmNo = document.getElementById("confirm-no");

  if (!openBtn || !inventoryModal || !inventoryList) {
    console.error("Inventário não carregou corretamente no DOM");
    return;
  }

  const newOpenBtn = openBtn.cloneNode(true);
  openBtn.parentNode.replaceChild(newOpenBtn, openBtn);

  newOpenBtn.addEventListener("click", async () => {

    inventoryModal.style.display = "flex";
    inventoryList.innerHTML = "Carregando...";

    const user = await new Promise(resolve => {
      const unsub = auth.onAuthStateChanged((u) => {
        unsub();
        resolve(u);
      });
    });

    if (!user) {
      inventoryList.innerHTML = "Usuário não logado.";
      return;
    }

    const playerSnap = await get(
      ref(db, `players/${user.uid}/info`)
    );

    if (playerSnap.exists() && saldoElement) {
      const saldo = playerSnap.val().saldo || 0;
      saldoElement.innerText =
        "฿ " + saldo.toLocaleString("pt-BR");
    }

    const inventorySnap = await get(
      ref(db, `players/${user.uid}/inventory`)
    );

    if (!inventorySnap.exists()) {
      inventoryList.innerHTML = "Inventário vazio.";
      return;
    }

    const inventory = inventorySnap.val();

    const itensSnap = await get(ref(db, "itens"));
    if (!itensSnap.exists()) return;

    const categorias = itensSnap.val();

    inventoryList.innerHTML = "";

    for (const itemId in inventory) {

      const quantidade = inventory[itemId];

      let itemData = null;
      let itemCategoria = null;

      for (const categoria in categorias) {
        if (categorias[categoria][itemId]) {
          itemData = categorias[categoria][itemId];
          itemCategoria = categoria;
          break;
        }
      }

      if (!itemData) continue;

      const div = document.createElement("div");
      div.className = "inventory-item";

      const itemObj = {
        id: itemId,
        nome: itemData.nome,
        tipo: itemData.tipo,
        tier: itemData.tier,
        value: itemData.value,
        categoria: itemCategoria,
        quantidade: quantidade,
        img: itemData.img,
        description: itemData.description,
        item: itemData.item,
        emoji: itemData.emoji,
        icon: itemData.icon
      };

      div.innerHTML = `
        <div class="inventory-item-top">

          <span class="inventory-emoji">
            ${
              itemData.img
                ? `<img src="https://res.cloudinary.com/djh45admn/image/upload/v1778432202/${itemData.img}.png"
                     class="inventory-item-img">`
                : (itemData.item || itemData.emoji || itemData.icon || "📦")
            }
          </span>

          <div class="inventory-text">

            <div class="inventory-name-qty">

              <span class="inventory-name">
                ${itemData.nome || itemId}
              </span>

              <span class="inventory-qty">
                ${quantidade}
              </span>

            </div>

          </div>

        </div>
      `;

      div.addEventListener("click", () => {

        currentItem = itemObj;

        resetItemModal();

        document.getElementById("item-emoji").innerHTML =
          itemData.img
            ? `<img src="https://res.cloudinary.com/djh45admn/image/upload/v1778432202/${itemData.img}.png"
                   class="item-open-img">`
            : (itemData.item || itemData.emoji || itemData.icon || "📦");

        document.getElementById("item-name").innerText =
          itemData.nome || itemId;

        const tier = Number(itemData.tier) || 1;

        const tierImgUrl =
          `https://res.cloudinary.com/djh45admn/image/upload/v1779723072/tier-${tier}.png`;

        document.getElementById("item-description").innerHTML = `
          <div>
            ${itemData.description || "Sem descrição."}
          </div>

          <img src="${tierImgUrl}" style="
            width:210px;
            display:block;
            margin:12px auto 0 auto;
          "/>
        `;

        // 🔥 BOTÕES (SEM LISTENER DUPLICADO)
        document.querySelector(".item-actions").innerHTML = `
          <button id="use-item">USAR</button>
          <button id="sell-item">VENDER</button>
        `;

        document.getElementById("use-item").onclick = () => {
          if (!currentItem) return;
          if (confirmModal) confirmModal.style.display = "flex";
        };

        document.getElementById("sell-item").onclick = () => {

          console.log("CLICK VENDER OK");

          window.abrirVendaItem?.(currentItem);
        };

        itemModal.style.display = "flex";
      });

      inventoryList.appendChild(div);
    }
  });

  if (closeInventory) {
    closeInventory.addEventListener("click", () => {
      inventoryModal.style.display = "none";
    });
  }

  if (closeItem) {
    closeItem.addEventListener("click", () => {
      itemModal.style.display = "none";
    });
  }

  if (marketBtn) {
    marketBtn.addEventListener("click", () => {
      inventoryModal.style.display = "none";
      if (window.openMarket) window.openMarket();
    });
  }

  confirmNo?.addEventListener("click", () => {
    if (confirmModal) confirmModal.style.display = "none";
  });

  confirmYes?.addEventListener("click", () => {

    if (confirmModal) confirmModal.style.display = "none";
    if (itemModal) itemModal.style.display = "none";

    window.usarItem?.(currentItem);
  });
}

loadInventoryHTML();
