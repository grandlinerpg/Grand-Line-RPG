import {
  ref,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const modalContainer = document.getElementById("inventory-container");

let currentItem = null;

async function loadInventoryHTML() {

  const response = await fetch("perfil/inventario.html");
  const html = await response.text();

  // limpa antes (evita restos de outros modais)
  modalContainer.innerHTML = "";

  modalContainer.innerHTML = html;

  // garante DOM pronto
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

  const useBtn = document.getElementById("use-item");
  const sellBtn = document.getElementById("sell-item");

  if (!openBtn || !inventoryModal || !inventoryList) {
    console.error("Inventário não carregou corretamente no DOM");
    return;
  }

  // evita duplicar evento se reinjetar HTML
  const newOpenBtn = openBtn.cloneNode(true);
  openBtn.parentNode.replaceChild(newOpenBtn, openBtn);

  newOpenBtn.addEventListener("click", async () => {

    inventoryModal.style.display = "flex";

    inventoryList.innerHTML = "Carregando...";

    const user = auth.currentUser;
    if (!user) return;

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

      for (const categoria in categorias) {
        if (categorias[categoria][itemId]) {
          itemData = categorias[categoria][itemId];
          break;
        }
      }

      if (!itemData) continue;

      const div = document.createElement("div");
      div.className = "inventory-item";

      const itemObj = {
        id: itemId,
        name: itemData.nome,
        category: itemData.category,
        value: itemData.value,
      };

      div.innerHTML = `
        <div class="inventory-item-top">
          <span class="inventory-emoji">
            ${itemData.item || "📦"}
          </span>

          <div>
            <div class="inventory-name">
              ${itemData.nome || itemId}
            </div>

            <div class="inventory-qty">
              Quantidade: ${quantidade}
            </div>
          </div>
        </div>
      `;

      div.addEventListener("click", () => {

        currentItem = itemObj;

        document.getElementById("item-emoji").innerText =
          itemData.item || "📦";

        document.getElementById("item-name").innerText =
          itemData.nome || itemId;

        document.getElementById("item-description").innerText =
          itemData.description || "Sem descrição.";

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

  if (useBtn) {
    useBtn.addEventListener("click", () => {
      if (!currentItem) return;

      console.log("USAR ITEM:", currentItem);

      itemModal.style.display = "none";
    });
  }

  if (sellBtn) {
    sellBtn.addEventListener("click", () => {
      console.log("Vender item ainda não implementado");
    });
  }
}

loadInventoryHTML();
