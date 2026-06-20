import {
  ref,
  get,
  set
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// =========================
// CARREGAR HTML DA VENDA
// =========================

const sellContainer =
  document.getElementById("sell-container");

async function loadVendaHTML() {

  if (!sellContainer) {
    console.error("❌ sell-container não encontrado");
    return;
  }

  const response =
    await fetch("perfil/venda.html");

  const html =
    await response.text();

  sellContainer.innerHTML = html;

  console.log("✅ venda.html carregado");
}

loadVendaHTML();

// =========================
// PREÇO MÍNIMO POR TIER
// =========================

function getMinPrice(tier) {

  switch (Number(tier)) {
    case 1: return 30000;
    case 2: return 80000;
    case 3: return 150000;
    case 4: return 300000;
    case 5: return 1000000;
    default: return 30000;
  }
}

// =========================
// ABRIR MODAL DE VENDA
// =========================

window.abrirVendaItem = function(item) {

  const modal =
    document.getElementById("sell-modal");

  const imgBox =
    document.getElementById("sell-item-image");

  const minText =
    document.getElementById("sell-min-price");

  const priceInput =
    document.getElementById("sell-price-input");

  const qtyInput =
    document.getElementById("sell-qty-input");

  if (!modal) {
    console.error("❌ sell-modal NÃO encontrado");
    return;
  }

  if (!item) {
    console.error("❌ item inválido");
    return;
  }

  const minPrice =
    getMinPrice(item.tier);

  priceInput.value = "";
  qtyInput.value = "";

  imgBox.innerHTML = item.img
    ? `
      <img
        src="https://res.cloudinary.com/djh45admn/image/upload/v1778432202/${item.img}.png"
        style="
          width:120px;
          height:120px;
          object-fit:contain;
        "
      >
    `
    : "📦";

  minText.innerText =
    `Preço mínimo: ฿ ${minPrice.toLocaleString("pt-BR")}`;

  modal.style.display = "flex";

  // =========================
  // CANCELAR
  // =========================

  document.getElementById("cancel-sell").onclick = () => {
    modal.style.display = "none";
  };

  // =========================
  // CONFIRMAR
  // =========================

  document.getElementById("confirm-sell").onclick =
    async () => {

      try {

        const auth = window.auth;
        const db = window.db;

        if (!auth.currentUser) {
          alert("Usuário não logado.");
          return;
        }

        const price =
          Number(priceInput.value);

        const qtd =
          Number(qtyInput.value);

        if (!price || price < minPrice) {
          alert("Preço abaixo do mínimo!");
          return;
        }

        if (!qtd || qtd <= 0) {
          alert("Quantidade inválida!");
          return;
        }

        if (qtd > item.quantidade) {
          alert(
            `Você possui apenas ${item.quantidade} unidade(s).`
          );
          return;
        }

        // =========================
        // GERAR ID DO ANÚNCIO
        // =========================

        const mercadoSnap =
          await get(
            ref(db, "mercado/itens")
          );

        let nextId = "000001";

        if (mercadoSnap.exists()) {

          const ids =
            Object.keys(
              mercadoSnap.val()
            );

          const maior =
            Math.max(
              ...ids.map(id =>
                Number(id)
              )
            );

          nextId =
            String(maior + 1)
              .padStart(6, "0");
        }

        // =========================
        // DATA
        // =========================

        const data =
          new Date().toLocaleString(
            "pt-BR"
          );

        // =========================
        // CRIAR ANÚNCIO
        // =========================

        await set(
          ref(
            db,
            `mercado/itens/${nextId}`
          ),
          {
            nome: item.id,
            value: price,
            jogador: auth.currentUser.uid,
            qtd: qtd,
            data: data
          }
        );

        // =========================
        // REMOVER DO INVENTÁRIO
        // =========================

        const novoTotal =
          item.quantidade - qtd;

        if (novoTotal > 0) {

          await set(
            ref(
              db,
              `players/${auth.currentUser.uid}/inventory/${item.id}`
            ),
            novoTotal
          );

        } else {

          await set(
            ref(
              db,
              `players/${auth.currentUser.uid}/inventory/${item.id}`
            ),
            null
          );

        }

        console.log(
          "✅ anúncio criado:",
          nextId
        );

        modal.style.display = "none";

        const itemModal =
          document.getElementById("item-modal");

        if (itemModal) {
          itemModal.style.display = "none";
        }

        const inventoryModal =
          document.getElementById("inventory-modal");

        if (inventoryModal) {
          inventoryModal.style.display = "flex";
        }

        alert("Item anunciado com sucesso!");

      } catch (error) {

        console.error(
          "❌ erro ao anunciar item:",
          error
        );

        alert(
          "Erro ao anunciar item. Verifique o console."
        );
      }
    };
};
