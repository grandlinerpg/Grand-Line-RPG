import {
  ref,
  get,
  onValue,
  off
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const modalContainer = document.getElementById("inventory-container");

let inventoryRef = null;
let inventoryCallback = null;
let renderVersion = 0;

// 🔥 ITEM LOCAL (ISOLADO)
let inventoryItem = null;

// 🔥 trava de confirmação (evita bug de clique duplo/stale state)
let isConfirmingUse = false;

function resetItemModal() {
  const itemModal = document.getElementById("item-modal");
  if (!itemModal) return;

  itemModal.querySelector("#item-emoji").innerHTML = "📦";
  itemModal.querySelector("#item-name").innerText = "";
  itemModal.querySelector("#item-description").innerHTML = "";
  itemModal.querySelector(".item-actions").innerHTML = "";
}

async function loadInventoryHTML() {
  const response = await fetch("perfil/inventario.html");
  const html = await response.text();

  modalContainer.innerHTML = html;

  requestAnimationFrame(() => {
    initInventory();
  });
}

function initInventory() {
  const auth = window.auth;
  const db = window.db;

  const inventoryModal = document.getElementById("inventory-modal");
  const inventoryList = document.getElementById("inventory-list");
  const saldoElement = document.getElementById("inventory-saldo");

  const itemModal = document.getElementById("item-modal");
  const confirmModal = document.getElementById("confirm-modal");

  const openBtn = document.getElementById("open-inventory");
  const closeInventory = document.getElementById("close-inventory");
  const closeItem = document.getElementById("close-item");

  const marketBtn = document.getElementById("open-market");

  const confirmYes = document.getElementById("confirm-yes");
  const confirmNo = document.getElementById("confirm-no");

  if (!openBtn || !inventoryModal || !inventoryList) {
    console.error("Inventário não carregou corretamente");
    return;
  }

  // 🔥 ABRIR INVENTÁRIO
  openBtn.onclick = async () => {
    inventoryModal.style.display = "flex";
    inventoryList.innerHTML = "Carregando...";

    const user = await new Promise(resolve => {
      const unsub = auth.onAuthStateChanged(u => {
        unsub();
        resolve(u);
      });
    });

    if (!user) return;

    const playerSnap = await get(ref(db, `players/${user.uid}/info`));

    if (playerSnap.exists() && saldoElement) {
      saldoElement.innerText =
        "฿ " + (playerSnap.val().saldo || 0).toLocaleString("pt-BR");
    }

    if (inventoryRef && inventoryCallback) {
      off(inventoryRef, "value", inventoryCallback);
    }

    inventoryRef = ref(db, `players/${user.uid}/inventory`);

    const itensSnap = await get(ref(db, "itens"));
    if (!itensSnap.exists()) return;

    const categorias = itensSnap.val();

    inventoryCallback = onValue(inventoryRef, (snapshot) => {
      const myVersion = ++renderVersion;

      inventoryList.innerHTML = "";

      if (!snapshot.exists()) {
        inventoryList.innerHTML = "Inventário vazio.";
        return;
      }

      const inventory = snapshot.val();

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
        if (myVersion !== renderVersion) return;

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
          description: itemData.description,
          item: itemData.item,
          emoji: itemData.emoji,
          icon: itemData.icon
        };

        div.innerHTML = `
          <div class="inventory-item-top">
            <span class="inventory-emoji">
              ${itemData.img
                ? `<img src="https://res.cloudinary.com/djh45admn/image/upload/v1778432202/${itemData.img}.png"
                    class="inventory-item-img">`
                : (itemData.item || itemData.emoji || itemData.icon || "📦")}
            </span>

            <div class="inventory-text">
              <div class="inventory-name-qty">
                <span class="inventory-name">${itemData.nome}</span>
                <span class="inventory-qty">${quantidade}</span>
              </div>
            </div>
          </div>
        `;

        div.onclick = () => {
          inventoryItem = itemObj;
          isConfirmingUse = false;

          resetItemModal();

          itemModal.querySelector("#item-emoji").innerHTML =
            itemData.img
              ? `<img src="https://res.cloudinary.com/djh45admn/image/upload/v1778432202/${itemData.img}.png"
                  class="item-open-img">`
              : (itemData.item || itemData.emoji || itemData.icon || "📦");

          itemModal.querySelector("#item-name").innerText = itemData.nome;

          const tier = Number(itemData.tier) || 1;

          itemModal.querySelector("#item-description").innerHTML = `
            <div>${itemData.description || "Sem descrição."}</div>
            <img src="https://res.cloudinary.com/djh45admn/image/upload/v1779723072/tier-${tier}.png"
              style="width:210px;margin:12px auto 0;">
          `;

          const actions = itemModal.querySelector(".item-actions");

          actions.innerHTML = `
            <button id="use-item">USAR</button>
            <button id="sell-item">VENDER</button>
          `;

          const useBtn = actions.querySelector("#use-item");
          const sellBtn = actions.querySelector("#sell-item");

          // 🔥 USAR (CORRIGIDO)
          useBtn.onclick = () => {
            if (!inventoryItem || isConfirmingUse) return;

            isConfirmingUse = true;
            confirmModal.style.display = "flex";

            confirmYes.onclick = null;
            confirmNo.onclick = null;

            confirmYes.onclick = () => {
              isConfirmingUse = false;

              confirmModal.style.display = "none";
              itemModal.style.display = "none";

              window.usarItem?.(inventoryItem);
            };

            confirmNo.onclick = () => {
              isConfirmingUse = false;
              confirmModal.style.display = "none";
            };
          };

          sellBtn.onclick = () => {
            window.abrirVendaItem?.(inventoryItem);
          };

          itemModal.style.display = "flex";
        };

        inventoryList.appendChild(div);
      }
    });
  };

  // 🔥 FECHAMENTOS
  closeInventory.onclick = () => {
    inventoryModal.style.display = "none";
  };

  closeItem.onclick = () => {
    itemModal.style.display = "none";
  };

  marketBtn.onclick = () => {
    inventoryModal.style.display = "none";
    window.openMarket?.();
  };

  confirmNo.onclick = () => {
    confirmModal.style.display = "none";
    isConfirmingUse = false;
  };

  confirmYes.onclick = () => {
    confirmModal.style.display = "none";
    itemModal.style.display = "none";

    if (inventoryItem) {
      window.usarItem?.(inventoryItem);
    }

    isConfirmingUse = false;
  };
}

loadInventoryHTML();
