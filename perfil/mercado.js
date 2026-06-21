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
let marketListener = null;

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
   💰 COMPRA
========================= */
async function comprarItem(db, item, quantidade, compradorUid) {
  try {
    const marketRef = ref(db, `mercado/itens/${item.marketId}`);
    const buyerRef = ref(db, `players/${compradorUid}/info/saldo`);
    const sellerRef = ref(db, `players/${item.jogador}/info/saldo`);
    const invRef = ref(db, `players/${compradorUid}/inventory`);

    const [buyerSnap, sellerSnap, marketSnap] = await Promise.all([
      get(buyerRef),
      get(sellerRef),
      get(marketRef)
    ]);

    if (!buyerSnap.exists()) throw new Error("Comprador inválido");
    if (!sellerSnap.exists()) throw new Error("Vendedor inválido");
    if (!marketSnap.exists()) throw new Error("Item não existe");

    const data = marketSnap.val();

    const qtdFinal = Math.max(1, Number(quantidade || 1));
    const total = Number(data.value) * qtdFinal;

    const buyerSaldo = Number(buyerSnap.val());
    const sellerSaldo = Number(sellerSnap.val());

    if (data.qtd < qtdFinal) throw new Error("Sem estoque");
    if (buyerSaldo < total) throw new Error("Saldo insuficiente");

    /* estoque */
    const result = await runTransaction(marketRef, (itemData) => {
      if (!itemData) return null;

      const atual = Number(itemData.qtd || 0);
      if (atual < qtdFinal) return itemData;

      const novo = atual - qtdFinal;
      if (novo <= 0) return null;

      return { ...itemData, qtd: novo };
    });

    if (!result.committed) throw new Error("Falha no estoque");

    /* saldo */
    let novoBuyer = buyerSaldo - total;
    let novoSeller = sellerSaldo + total;

    if (item.jogador === compradorUid) {
      novoSeller -= total;
    }

    await update(ref(db), {
      [`players/${compradorUid}/info/saldo`]: novoBuyer,
      [`players/${item.jogador}/info/saldo`]: novoSeller
    });

    /* inventário */
    const invSnap = await get(invRef);
    const invData = invSnap.exists() ? invSnap.val() : {};

    const key = data.nome;
    const atualQty = Number(invData?.[key] || 0);

    await update(invRef, {
      [key]: atualQty + qtdFinal
    });

  } catch (err) {
    console.error("💥 ERRO NA COMPRA:", err.message);
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

  const qtySelect = document.getElementById("market-quantity-select");

  let anuncios = {};
  let itensDB = {};
  let marketRef = ref(db, "mercado/itens");

  /* FECHAR MARKET -> VOLTA INVENTÁRIO */
  closeMarket.onclick = () => {
    marketModal.style.display = "none";

    const inv = document.getElementById("inventory-container");
    if (inv) inv.style.display = "flex";
  };

  /* FECHAR ITEM */
  closeItem.onclick = () => {
    itemModal.style.display = "none";
  };

  /* ABRIR MARKET */
  window.openMarket = async () => {
    resetItemModal();

    const inv = document.getElementById("inventory-container");
    if (inv) inv.style.display = "none";

    marketModal.style.display = "flex";

    const itensSnap = await get(ref(db, "itens"));
    if (!itensSnap.exists()) return;

    itensDB = itensSnap.val();

    categorySelect.innerHTML = `<option value="all">Todas</option>`;
    for (const c in itensDB) {
      categorySelect.innerHTML += `<option value="${c}">${c}</option>`;
    }

    if (marketListener) off(marketRef, "value", marketListener);

    marketListener = onValue(marketRef, (snap) => {
      const raw = snap.val() || {};

      for (const id in raw) {
        if (!raw[id] || raw[id].qtd <= 0) {
          remove(ref(db, `mercado/itens/${id}`));
        }
      }

      anuncios = raw;
      render(categorySelect.value || "all");
    });

    render("all");

    categorySelect.onchange = () => render(categorySelect.value);
  };

  function getEmoji(item) {
    return item.emoji || item.icon || "📦";
  }

  function render(filter) {
    marketList.innerHTML = "";

    for (const marketId in anuncios) {
      const a = anuncios[marketId];
      const itemId = a.nome;

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
              ? `<img src="https://res.cloudinary.com/djh45admn/image/upload/v1778432202/${itemData.img}.png">`
              : getEmoji(itemData)}
          </span>

          <div class="inventory-text">
            <div class="inventory-name-qty">
              <span class="inventory-name">${itemData.nome}</span>
              <span class="inventory-qty">฿ ${Number(a.value).toLocaleString("pt-BR")}</span>
            </div>
          </div>
        </div>
      `;

      div.onclick = () => openItem({
        marketId,
        ...a,
        nome: itemData.nome,
        descricao: itemData.description,
        img: itemData.img,
        emoji: getEmoji(itemData)
      });

      marketList.appendChild(div);
    }
  }

  function openItem(item) {
    resetItemModal();
    marketItem = item;

    const qty = qtySelect ? Number(qtySelect.value || 1) : 1;

    document.getElementById("market-item-emoji").innerHTML =
      item.img
        ? `<img src="https://res.cloudinary.com/djh45admn/image/upload/v1778432202/${item.img}.png">`
        : item.emoji;

    document.getElementById("market-item-name").innerText = item.nome;

    document.getElementById("market-item-description").innerHTML =
      item.descricao || "Sem descrição.";

    priceBox.innerText =
      `฿ ${(Number(item.value) * qty).toLocaleString("pt-BR")}`;

    if (qtySelect) {
      qtySelect.onchange = () => {
        const q = Number(qtySelect.value || 1);
        priceBox.innerText =
          `฿ ${(Number(item.value) * q).toLocaleString("pt-BR")}`;
      };
    }

    itemModal.style.display = "flex";
  }

  buyBtn.onclick = () => {
    if (!marketItem) return;
    confirmModal.style.display = "flex";
  };

  yesBtn.onclick = async () => {
    try {
      const qtd = Number(qtySelect?.value || 1);
      const uid = window.auth?.currentUser?.uid;

      if (!uid) throw new Error("Usuário não logado");

      await comprarItem(db, marketItem, qtd, uid);

      confirmModal.style.display = "none";
      itemModal.style.display = "none";

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
