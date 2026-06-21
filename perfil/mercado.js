import {
  ref,
  get,
  update,
  remove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const marketContainer = document.getElementById("market-container");

let marketItem = null;

/* =========================
   RESET MODAL
========================= */
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
   💰 COMPRA (CORRIGIDA FINAL)
========================= */
async function comprarItem(db, item, quantidade, compradorUid) {

  const marketRef = ref(db, `mercado/itens/${item.marketId}`);

  const buyerRef = ref(db, `players/${compradorUid}/info/saldo`);
  const sellerRef = ref(db, `players/${item.jogador}/info/saldo`);
  const invRef = ref(db, `players/${compradorUid}/inventory/${item.nome}`);

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

  const total = Number(data.value) * quantidade;

  if (data.qtd < quantidade) throw new Error("Sem estoque");
  if (buyerSaldo < total) throw new Error("Saldo insuficiente");

  /* =========================
     🚫 BLOQUEIO AUTO-COMPRA
  ========================= */
  if (item.jogador === compradorUid) {
    throw new Error("Você não pode comprar seu próprio item");
  }

  /* =========================
     💰 SALDO
  ========================= */
  await update(ref(db), {
    [`players/${compradorUid}/info/saldo`]: buyerSaldo - total,
    [`players/${item.jogador}/info/saldo`]: sellerSaldo + total
  });

  /* =========================
     🎒 INVENTÁRIO (CORRETO)
  ========================= */
  const currentQty = invSnap.exists() ? Number(invSnap.val()) : 0;

  await update(invRef, {
    [item.nome]: currentQty + quantidade
  });

  /* =========================
     🏪 MERCADO
  ========================= */
  const newQtd = data.qtd - quantidade;

  if (newQtd <= 0) {
    await remove(marketRef);
  } else {
    await update(marketRef, { qtd: newQtd });
  }
}

/* =========================
   INIT MARKET
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

  if (closeMarket) {
    closeMarket.onclick = () => {
      marketModal.style.display = "none";
    };
  }

  if (closeItem) {
    closeItem.onclick = () => {
      itemModal.style.display = "none";
    };
  }

  /* =========================
     OPEN MARKET
  ========================= */
  window.openMarket = async () => {
    resetItemModal();

    marketModal.style.display = "flex";

    const marketSnap = await get(ref(db, "mercado/itens"));
    const itensSnap = await get(ref(db, "itens"));

    if (!marketSnap.exists() || !itensSnap.exists()) return;

    anuncios = marketSnap.val();
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

  /* =========================
     RENDER
  ========================= */
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

      div.onclick = () => openItem({
        marketId,
        nome: itemData.nome,
        descricao: itemData.description,
        img: itemData.img,
        value,
        tier: Number(itemData.tier || 1),
        emoji: getEmoji(itemData),
        jogador: a.jogador,
        qtd: a.qtd
      });

      marketList.appendChild(div);
    }
  }

  /* =========================
     OPEN ITEM
  ========================= */
  function openItem(item) {
    resetItemModal();

    marketItem = item;

    document.getElementById("market-item-emoji").innerHTML =
      item.img
        ? `<img src="https://res.cloudinary.com/djh45admn/image/upload/v1778432202/${item.img}.png"
            class="item-open-img">`
        : item.emoji;

    document.getElementById("market-item-name").innerText = item.nome;

    document.getElementById("market-item-description").innerHTML = `
      <div>${item.descricao || "Sem descrição."}</div>
      <img src="https://res.cloudinary.com/djh45admn/image/upload/v1779723072/tier-${item.tier}.png"
        style="width:210px;display:block;margin:12px auto 0 auto;">
    `;

    priceBox.innerText = `฿ ${item.value.toLocaleString("pt-BR")}`;

    itemModal.style.display = "flex";
  }

  /* =========================
     BUY
  ========================= */
  buyBtn.onclick = () => {
    if (!marketItem) return;
    confirmModal.style.display = "flex";
  };

  yesBtn.onclick = async () => {
    try {
      if (!marketItem) return;

      const qtd = Number(
        document.getElementById("market-quantity-select")?.value || 1
      );

      const comprador = window.auth?.currentUser?.uid;

      if (!comprador) {
        throw new Error("Usuário não carregado");
      }

      await comprarItem(window.db, marketItem, qtd, comprador);

      confirmModal.style.display = "none";
      itemModal.style.display = "none";

      console.log("COMPRA REALIZADA");

    } catch (err) {
      console.error("Erro na compra:", err.message);
    }
  };

  noBtn.onclick = () => {
    confirmModal.style.display = "none";
  };
}

loadMarketHTML();
