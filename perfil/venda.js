

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
// DEBUG EVENTO
// =========================

document.addEventListener("abrirVenda", (e) => {
  console.log("🔥 EVENTO CHEGOU:", e.detail);
});

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

  console.log("🟢 abrirVendaItem chamada");
  console.log("📦 item:", item);

  const modal =
    document.getElementById("sell-modal");

  const imgBox =
    document.getElementById("sell-item-image");

  const minText =
    document.getElementById("sell-min-price");

  const input =
    document.getElementById("sell-price-input");

  console.log("📌 modal:", modal);
  console.log("📌 imgBox:", imgBox);
  console.log("📌 minText:", minText);
  console.log("📌 input:", input);

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

  input.value = "";

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

  console.log("🚀 tentando abrir modal");

  modal.style.display = "flex";

  console.log(
    "✅ display atual:",
    getComputedStyle(modal).display
  );

  // CANCELAR

  document.getElementById("cancel-sell").onclick = () => {
    modal.style.display = "none";
  };

  // CONFIRMAR

  document.getElementById("confirm-sell").onclick =
    async () => {

      const price =
        Number(input.value || 0);

      if (price < minPrice) {
        alert("Preço abaixo do mínimo!");
        return;
      }

      console.log(
        "🟢 ITEM À VENDA:",
        item
      );

      console.log(
        "💰 PREÇO:",
        price
      );

      modal.style.display = "none";
    };
};

// =========================
// PONTE DO EVENTO
// =========================

document.addEventListener("abrirVenda", (e) => {

  console.log(
    "🔥 evento abrirVenda recebido:",
    e.detail
  );

  window.abrirVendaItem(
    e.detail
  );
});
