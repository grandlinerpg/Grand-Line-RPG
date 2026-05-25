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
        quantidade: quantidade
      };

      div.innerHTML = `
        <div class="inventory-item-top">
          <span class="inventory-emoji">
            ${itemData.item || "📦"}
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

        document.getElementById("item-emoji").innerText =
          itemData.item || "📦";

        document.getElementById("item-name").innerText =
          itemData.nome || itemId;

        /* 🔥 NOVO: TIER AGORA COMO IMAGEM */
        const tier = Number(itemData.tier) || 1;

        const tierImgUrl =
          `https://res.cloudinary.com/djh45admn/image/upload/v1779723072/tier-${tier}.png`;

        document.getElementById("item-description").innerHTML =
          `<img src="${tierImgUrl}" style="
              width:120px;
              display:block;
              margin:0 auto 8px auto;
            "/>
          <div>
            ${itemData.description || "Sem descrição."}
          </div>`;

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

    useBtn.addEventListener("click", async () => {

      if (!currentItem) return;

      if (window.usarItem) {
        await window.usarItem(currentItem);
      }

      itemModal.style.display = "none";
      inventoryModal.style.display = "none";

      loadInventoryHTML();
    });
  }

  if (sellBtn) {
    sellBtn.addEventListener("click", () => {
      console.log("Vender item ainda não implementado");
    });
  }
}

loadInventoryHTML();
