import {
  ref,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import { usarItem } from "./item.js"; // 🔥 IMPORT DO ITEM SYSTEM

const modalContainer = document.getElementById("modal-container");

let currentItem = null; // 🔥 item selecionado

async function loadInventoryHTML(){

  const response = await fetch("perfil/inventario.html");
  const html = await response.text();

  modalContainer.innerHTML = html;

  initInventory();
}

function initInventory(){

  const auth = window.auth;
  const db = window.db;

  const openBtn = document.getElementById("open-inventory");

  const inventoryModal =
    document.getElementById("inventory-modal");

  const closeInventory =
    document.getElementById("close-inventory");

  const itemModal =
    document.getElementById("item-modal");

  const closeItem =
    document.getElementById("close-item");

  const inventoryList =
    document.getElementById("inventory-list");

  const useBtn =
    document.getElementById("use-item"); // 🔥 BOTÃO USAR

  const sellBtn =
    document.getElementById("sell-item"); // (futuro)

  // =========================
  // ABRIR INVENTÁRIO
  // =========================

  openBtn.addEventListener("click", async () => {

    inventoryModal.style.display = "flex";

    inventoryList.innerHTML = "Carregando...";

    const user = auth.currentUser;

    if(!user) return;

    const inventorySnap = await get(
      ref(db, `players/${user.uid}/inventory`)
    );

    if(!inventorySnap.exists()){
      inventoryList.innerHTML = "Inventário vazio.";
      return;
    }

    const inventory = inventorySnap.val();

    const itensSnap = await get(ref(db, "itens"));

    if(!itensSnap.exists()) return;

    const categorias = itensSnap.val();

    inventoryList.innerHTML = "";

    for(const itemId in inventory){

      const quantidade = inventory[itemId];

      let itemData = null;

      for(const categoria in categorias){

        if(categorias[categoria][itemId]){

          itemData = categorias[categoria][itemId];
          break;
        }
      }

      if(!itemData) continue;

      const div = document.createElement("div");

      div.className = "inventory-item";

      // =========================
      // ITEM SALVO PRA USO
      // =========================
      const itemObj = {
        id: itemId,
        name: itemData.nome,
        category: itemData.category, // IMPORTANTE
        value: itemData.value,       // IMPORTANTE
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

        currentItem = itemObj; // 🔥 salva item selecionado

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

  // =========================
  // FECHAR INVENTÁRIO
  // =========================

  closeInventory.addEventListener("click", () => {
    inventoryModal.style.display = "none";
  });

  // =========================
  // FECHAR ITEM
  // =========================

  closeItem.addEventListener("click", () => {
    itemModal.style.display = "none";
  });

  // =========================
  // USAR ITEM (🔥 AQUI USA item.js)
  // =========================

  useBtn.addEventListener("click", async () => {
    if (!currentItem) return;

    await usarItem(currentItem);

    itemModal.style.display = "none";
  });

  // =========================
  // VENDER (FUTURO)
  // =========================

  sellBtn.addEventListener("click", () => {
    console.log("Vender item ainda não implementado");
  });
}

loadInventoryHTML();
