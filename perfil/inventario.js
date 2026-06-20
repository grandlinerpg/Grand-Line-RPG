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
  const emoji = document.getElementById("item-emoji");
  const name = document.getElementById("item-name");
  const desc = document.getElementById("item-description");
  const actions = document.querySelector("#item-modal .item-actions");

  if (emoji) emoji.innerHTML = "📦";
  if (name) name.innerText = "";
  if (desc) desc.innerHTML = "";
  if (actions) actions.innerHTML = "";
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
  const closeItem = document.getElementById("close-item");

  const inventoryList = document.getElementById("inventory-list");

  const saldoElement = document.getElementById("inventory-saldo");
  const marketBtn = document.getElementById("open-market");

  const confirmModal = document.getElementById("confirm-modal");
  const confirmYes = document.getElementById("confirm-yes");
  const confirmNo = document.getElementById("confirm-no");

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

    if (!user) return;

    const playerSnap = await get(ref(db, `players/${user.uid}/info`));

    if (playerSnap.exists() && saldoElement) {
      const saldo = playerSnap.val().saldo || 0;
      saldoElement.innerText = "฿ " + saldo.toLocaleString("pt-BR");
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

      if (!snapshot.exists()) return;

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
          descricao: itemData.description,
          img: itemData.img,
          tier: itemData.tier
        };

        div.innerHTML = `
          <div class="inventory-item-top">
            <span class="inventory-emoji">
              ${itemData.img
                ? `<img src="https://res.cloudinary.com/djh45admn/image/upload/v1778432202/${itemData.img}.png" class="inventory-item-img">`
                : "📦"}
            </span>

            <div class="inventory-text">
              <span>${itemData.nome}</span>
              <span>${quantidade}</span>
            </div>
          </div>
        `;

        div.onclick = () => {

          currentItem = itemObj;

          resetItemModal();

          document.getElementById("item-emoji").innerHTML =
            itemData.img
              ? `<img src="https://res.cloudinary.com/djh45admn/image/upload/v1778432202/${itemData.img}.png" class="item-open-img">`
              : "📦";

          document.getElementById("item-name").innerText = itemData.nome;

          document.getElementById("item-description").innerHTML =
            itemData.description || "Sem descrição.";

          document.querySelector("#item-modal .item-actions").innerHTML = `
            <button id="use-item">USAR</button>
            <button id="sell-item">VENDER</button>
          `;

          document.getElementById("use-item").onclick = () => {
            confirmModal.style.display = "flex";
          };

          document.getElementById("sell-item").onclick = () => {
            window.abrirVendaItem?.(currentItem);
          };

          itemModal.style.display = "flex";
        };

        inventoryList.appendChild(div);
      }
    });
  });

  confirmYes.onclick = () => {
    confirmModal.style.display = "none";
    itemModal.style.display = "none";
    window.usarItem?.(currentItem);
  };

  confirmNo.onclick = () => {
    confirmModal.style.display = "none";
  };

  closeInventory.onclick = () => inventoryModal.style.display = "none";
  closeItem.onclick = () => itemModal.style.display = "none";

  marketBtn.onclick = () => {
    inventoryModal.style.display = "none";
    window.openMarket?.();
  };
}

loadInventoryHTML();
