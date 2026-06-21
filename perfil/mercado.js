import {
  ref,
  get,
  update,
  remove,
  runTransaction,
  onValue,
  off
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

/* =========================
   LOAD HTML
========================= */
async function loadMarketHTML() {
  const response = await fetch("perfil/mercado.html");
  const html = await response.text();

  marketContainer.innerHTML = html;

  requestAnimationFrame(() => {
    initMarket();
  });
}

/* =========================
   💰 COMPRA
========================= */
async function comprarItem(db, item, quantidade, compradorUid) {
  try {

    const marketRef = ref(db, `mercado/itens/${item.marketId}`);
    const buyerRef = ref(db, `players/${compradorUid}/info/saldo`);
    const sellerRef = ref(db, `players/${item.jogador}/info/saldo`);
    const invRef = ref(db, `players/${compradorUid}/inventory`);

    const [buyerSnap, sellerSnap, marketSnap, invSnap] = await Promise.all([
      get(buyerRef),
      get(sellerRef),
      get(marketRef),
      get(invRef)
    ]);

    if (!buyerSnap.exists()) throw new Error("Comprador inválido");
    if (!sellerSnap.exists()) throw new Error("Vendedor inválido");
    if (!marketSnap.exists()) throw new Error("Item não existe");

    const data = marketSnap.val();

    const buyerSaldo = Number(buyerSnap.val());
    const sellerSaldo = Number(sellerSnap.val());

    const qtdFinal = Number.isFinite(Number(quantidade)) ? Number(quantidade) : 1;
    const total = Number(data.value) * qtdFinal;

    /* ❌ BLOQUEIO: comprar de si mesmo */
    if (item.jogador === compradorUid) {
      throw new Error("Você não pode comprar seu próprio item");
    }

    if (data.qtd < qtdFinal) throw new Error("Sem estoque");
    if (buyerSaldo < total) throw new Error("Saldo insuficiente");

    /* =========================
       ESTOQUE (TRANSACTION)
    ========================= */
    const result = await runTransaction(marketRef, (itemData) => {
      if (!itemData) return null;

      const atual = Number(itemData.qtd || 0);

      if (atual < qtdFinal) return itemData;

      const novaQtd = atual - qtdFinal;

      return {
        ...itemData,
        qtd: novaQtd
      };
    });

    if (!result.committed) throw new Error("Falha no estoque");

    const novoEstoque = result.snapshot.val()?.qtd ?? 0;

    /* 🧨 SE ZEROU, REMOVE ANÚNCIO */
    if (novoEstoque <= 0) {
      await remove(marketRef);
    }

    /* =========================
       SALDOS
    ========================= */
    await update(ref(db), {
      [`players/${compradorUid}/info/saldo`]: buyerSaldo - total,
      [`players/${item.jogador}/info/saldo`]: sellerSaldo + total
    });

    /* =========================
       INVENTÁRIO
    ========================= */

    const invData = invSnap.exists() ? invSnap.val() : {};

    const itemKey = data.nome;

    const currentQty = Number(invData?.[itemKey] || 0);

    await update(invRef, {
      [itemKey]: currentQty + qtdFinal
    });

    console.log("✅ COMPRA OK");

  } catch (err) {
    console.error("💥 ERRO:", err.message);
  }
}

/* =========================
   INIT MARKET (AO VIVO)
========================= */
function initMarket() {
  const db = window.db;

  const marketModal = document.getElementById("market-modal");
  const closeMarket = document.getElementById("close-market");
  const categorySelect = document.getElementById("market-category");
  const marketList = document.getElementById("market-list");

  const itemModal = document.getElementById("market-item-modal");
  const closeItem = document.getElementById("close-market-item");

  const buyBtn = document.getElementById("market-buy-btn");
  const priceBox = document.getElementById("market-item-price");

  const confirmModal = document.getElementById("market-confirm-modal");
  const yesBtn = document.getElementById("market-confirm-yes");
  const noBtn = document.getElementById("market-confirm-no");

  let anuncios = {};
  let itensDB = {};

  /* 🔥 AO VIVO */
  const marketRef = ref(db, "mercado/itens");

  onValue(marketRef, (snap) => {
    anuncios = snap.exists() ? snap.val() : {};
    render(categorySelect?.value || "all");
  });

  closeMarket.onclick = () => {
    marketModal.style.display = "none";
    window.openInventory?.();
  };

  closeItem.onclick = () => {
    itemModal.style.display = "none";
  };

  window.openMarket = async () => {
    resetItemModal();

    marketModal.style.display = "flex";

    const itensSnap = await get(ref(db, "itens"));
    if (!itensSnap.exists()) return;

    itensDB = itensSnap.val();

    categorySelect.innerHTML = `<option value="all">Todas</option>`;

    for (const c in itensDB) {
      categorySelect.innerHTML += `<option value="${c}">${c}</option>`;
    }

    render("all");
    categorySelect.onchange = () => render(categorySelect.value);
  };

  function getEmoji(itemData) {
    return itemData.emoji || itemData.icon || itemData.item || "📦";
  }

  function render(filter) {
    marketList.innerHTML = "";

    for (const marketId in anuncios) {
      const a = anuncios[marketId];

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

      div.onclick = () => {
        marketItem = {
          marketId,
          nome: itemData.nome,
          descricao: itemData.description,
          img: itemData.img,
          value,
          tier: Number(itemData.tier || 1),
          emoji: getEmoji(itemData),
          jogador: a.jogador
        };

        itemModal.style.display = "flex";
      };

      marketList.appendChild(div);
    }
  }

  buyBtn.onclick = () => {
    if (!marketItem) return;
    confirmModal.style.display = "flex";
  };

  yesBtn.onclick = async () => {
    try {
      const qtd = Number(document.getElementById("market-quantity-select")?.value || 1);
      const comprador = window.auth?.currentUser?.uid;

      if (!comprador) throw new Error("Não logado");

      await comprarItem(window.db, marketItem, qtd, comprador);

      confirmModal.style.display = "none";
      itemModal.style.display = "none";
      marketModal.style.display = "flex";

      marketItem = null;

    } catch (err) {
      console.error("💥 ERRO:", err.message);
    }
  };

  noBtn.onclick = () => {
    confirmModal.style.display = "none";
  };
}

loadMarketHTML();
