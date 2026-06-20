import {
  ref,
  get,
  onValue,
  off
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const modalContainer = document.getElementById("inventory-container");

let currentItem = null;
let inventoryRef = null;
let inventoryCallback = null;
let renderVersion = 0;

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

  const openBtn = document.getElementById("open-inventory");
  const inventoryModal = document.getElementById("inventory-modal");
  const closeInventory = document.getElementById("close-inventory");

  const itemModal = document.getElementById("item-modal");
  const inventoryList = document.getElementById("inventory-list");

  const saldoElement = document.getElementById("inventory-saldo");
  const marketBtn = document.getElementById("open-market");

  const confirmModal = document.getElementById("confirm-modal");

  const confirmYesOld = document.getElementById("confirm-yes");
  const confirmNoOld = document.getElementById("confirm-no");

  const confirmYes = confirmYesOld?.cloneNode(true);
  const confirmNo = confirmNoOld?.cloneNode(true);

  confirmYesOld?.replaceWith(confirmYes);
  confirmNoOld?.replaceWith(confirmNo);

  let userRef = null;

  const newOpenBtn = openBtn.cloneNode(true);
  openBtn.parentNode.replaceChild(newOpenBtn, openBtn);

  newOpenBtn.onclick = async () => {
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
      saldoElement.innerText = "฿ " + (playerSnap.val().saldo || 0).toLocaleString("pt-BR");
    }

    if (inventoryRef && inventoryCallback) {
      off(inventoryRef, "value", inventoryCallback);
    }

    inventoryRef = ref(db, `players/${user.uid}/inventory`);

    const itensSnap = await get(ref(db, "itens"));
    if (!itensSnap.exists()) return;

    const categorias = itensSnap.val();

    inventoryCallback = onValue(inventoryRef, snapshot => {
      const version = ++renderVersion;

      inventoryList.innerHTML = "";

      if (!snapshot.exists()) return;

      const inventory = snapshot.val();

      for (const itemId in inventory) {
        const quantidade = inventory[itemId];

        let itemData = null;
        let itemCategoria = null;

        for (const cat in categorias) {
          if (categorias[cat][itemId]) {
            itemData = categorias[cat][itemId];
            itemCategoria = cat;
            break;
          }
        }

        if (!itemData) continue;
        if (version !== renderVersion) return;

        const div = document.createElement("div");
        div.className = "inventory-item";

        const itemObj = {
          id: itemId,
          nome: itemData.nome,
          descricao: itemData.description,
          img: itemData.img,
          tier: itemData.tier,
          quantidade
        };

        div.innerHTML = `
          <div class="inventory-item-top">

            <span class="inventory-emoji">
              ${itemData.img
                ? `<img src="https://res.cloudinary.com/djh45admn/image/upload/v1778432202/${itemData.img}.png"
                    class="inventory-item-img">`
                : "📦"}
            </span>

            <div class="inventory-text">
              <span class="inventory-name">${itemData.nome}</span>
              <span class="inventory-qty">${quantidade}</span>
            </div>

          </div>
        `;

        div.onclick = () => {
          currentItem = itemObj;

          resetItemModal();

          itemModal.style.display = "flex";

          itemModal.querySelector("#item-emoji").innerHTML =
            itemData.img
              ? `<img src="https://res.cloudinary.com/djh45admn/image/upload/v1778432202/${itemData.img}.png"
                  class="item-open-img">`
              : "📦";

          itemModal.querySelector("#item-name").innerText = itemData.nome;

          itemModal.querySelector("#item-description").innerHTML = `
            ${itemData.description || "Sem descrição"}
          `;

          const actions = itemModal.querySelector(".item-actions");

          actions.innerHTML = `
            <button id="use-item">USAR</button>
            <button id="sell-item">VENDER</button>
          `;

          const useBtn = actions.querySelector("#use-item");
          const sellBtn = actions.querySelector("#sell-item");

          useBtn.onclick = () => {
            confirmModal.style.display = "flex";
          };

          sellBtn.onclick = () => {
            window.abrirVendaItem?.(currentItem);
          };
        };

        inventoryList.appendChild(div);
      }
    });
  };

  closeInventory.onclick = () => inventoryModal.style.display = "none";

  marketBtn.onclick = () => {
    inventoryModal.style.display = "none";
    window.openMarket?.();
  };

  confirmNo.onclick = () => {
    confirmModal.style.display = "none";
  };

  confirmYes.onclick = () => {
    confirmModal.style.display = "none";
    itemModal.style.display = "none";
    window.usarItem?.(currentItem);
  };
}

loadInventoryHTML();
