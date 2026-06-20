import {
  ref,
  get,
  onValue,
  off
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const modalContainer = document.getElementById("inventory-container");

let currentItem = null;

// 🔥 FIX GLOBAL: impede múltiplas inicializações
let inventoryInitialized = false;

// 🔥 listener controlado
let inventoryRef = null;
let inventoryListener = null;

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

  // 🔥 EVITA DUPLO INIT (ESSA É A CORREÇÃO PRINCIPAL)
  if (inventoryInitialized) return;
  inventoryInitialized = true;

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

    // 🔥 remove listener antigo corretamente
    if (inventoryRef) {
      off(inventoryRef);
    }

    inventoryRef = ref(db, `players/${user.uid}/inventory`);

    inventoryListener = onValue(inventoryRef, async (inventorySnap) => {

      inventoryList.innerHTML = "";

      if (!inventorySnap.exists()) {
        inventoryList.innerHTML = "Inventário vazio.";
        return;
      }

      const inventory = inventorySnap.val();

      const itensSnap = await get(ref(db, "itens"));
      if (!itensSnap.exists()) return;

      const categorias = itensSnap.val();

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
          quantidade
        };

        div.innerHTML = `
          <div class="inventory-item-top">

            <span class="inventory-emoji">
              ${
                itemData.img
                  ? `<img src="https://res.cloudinary.com/djh45admn/image/upload/v1778432202/${itemData.img}.png"
                       class="inventory-item-img">`
                  : (itemData.item || "📦")
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
              : "📦";

          document.getElementById("item-name").innerText =
            itemData.nome || itemId;

          document.getElementById("item-description").innerText =
            itemData.description || "Sem descrição.";

          document.querySelector(".item-actions").innerHTML = `
            <button id="use-item">USAR</button>
            <button id="sell-item">VENDER</button>
          `;

          document.getElementById("use-item").onclick = () => {
            if (confirmModal) confirmModal.style.display = "flex";
          };

          document.getElementById("sell-item").onclick = () => {
            window.abrirVendaItem?.(currentItem);
          };

          itemModal.style.display = "flex";
        });

        inventoryList.appendChild(div);
      }
    });
  });

  closeInventory?.addEventListener("click", () => {
    inventoryModal.style.display = "none";
  });

  closeItem?.addEventListener("click", () => {
    itemModal.style.display = "none";
  });

  marketBtn?.addEventListener("click", () => {
    inventoryModal.style.display = "none";
    window.openMarket?.();
  });

  confirmNo?.addEventListener("click", () => {
    confirmModal.style.display = "none";
  });

  confirmYes?.addEventListener("click", () => {
    confirmModal.style.display = "none";
    itemModal.style.display = "none";
    window.usarItem?.(currentItem);
  });
}

loadInventoryHTML();
