import {
  ref,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const modalContainer = document.getElementById("inventory-container");

let currentItem = null;

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
  const confirmModal = document.getElementById("confirm-modal");

  const closeItem = document.getElementById("close-item");

  const inventoryList = document.getElementById("inventory-list");

  const saldoElement = document.getElementById("inventory-saldo");
  const marketBtn = document.getElementById("open-market");

  const useBtn = document.getElementById("use-item");
  const sellBtn = document.getElementById("sell-item");

  const confirmYes = document.getElementById("confirm-yes");
  const confirmNo = document.getElementById("confirm-no");

  if (!openBtn || !inventoryModal || !inventoryList) return;

  const newOpenBtn = openBtn.cloneNode(true);
  openBtn.parentNode.replaceChild(newOpenBtn, openBtn);

  newOpenBtn.addEventListener("click", async () => {

    window.itemMode = "inventory";

    inventoryModal.style.display = "flex";
    inventoryList.innerHTML = "Carregando...";

    const user = auth.currentUser;
    if (!user) return;

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
        quantidade,
        img: itemData.img,
        description: itemData.description
      };

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
                ${quantidade}
              </span>
            </div>
          </div>

        </div>
      `;

      div.addEventListener("click", () => {

        currentItem = itemObj;

        document.getElementById("item-emoji").innerHTML =
          itemData.img
            ? `<img 
                src="https://res.cloudinary.com/djh45admn/image/upload/v1778432202/${itemData.img}.png"
                class="item-open-img"
              >`
            : "📦";

        document.getElementById("item-name").innerText =
          itemData.nome || itemId;

        document.getElementById("item-description").innerText =
          itemData.description || "Sem descrição.";

        itemModal.style.display = "flex";
      });

      inventoryList.appendChild(div);
    }
  });

  // ❌ fechar item
  if (closeItem) {
    closeItem.addEventListener("click", () => {
      itemModal.style.display = "none";
    });
  }

  // ❌ fechar inventário
  if (closeInventory) {
    closeInventory.addEventListener("click", () => {
      inventoryModal.style.display = "none";
    });
  }

  // 🟡 BOTÃO USAR → abre confirmação
  if (useBtn) {
    useBtn.addEventListener("click", () => {
      if (!currentItem) return;

      itemModal.style.display = "none";
      confirmModal.style.display = "flex";
    });
  }

  // ✅ CONFIRMAR SIM
  if (confirmYes) {
    confirmYes.addEventListener("click", async () => {

      if (window.usarItem) {
        await window.usarItem(currentItem);
      }

      confirmModal.style.display = "none";
      inventoryModal.style.display = "none";

      loadInventoryHTML();
    });
  }

  // ❌ CONFIRMAR NÃO
  if (confirmNo) {
    confirmNo.addEventListener("click", () => {
      confirmModal.style.display = "none";
    });
  }

  // mercado
  if (marketBtn) {
    marketBtn.addEventListener("click", () => {
      inventoryModal.style.display = "none";
      if (window.openMarket) window.openMarket();
    });
  }
}

loadInventoryHTML();
