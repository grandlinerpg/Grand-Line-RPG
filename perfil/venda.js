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

  const modal = document.getElementById("sell-modal");
  const imgBox = document.getElementById("sell-item-image");
  const minText = document.getElementById("sell-min-price");
  const input = document.getElementById("sell-price-input");

  if (!modal || !item) return;

  const minPrice = getMinPrice(item.tier);

  input.value = "";

  imgBox.innerHTML = item.img
    ? `<img src="https://res.cloudinary.com/djh45admn/image/upload/v1778432202/${item.img}.png"
        style="width:120px;height:120px;object-fit:contain;">`
    : "📦";

  minText.innerText =
    `Preço mínimo: ฿ ${minPrice.toLocaleString("pt-BR")}`;

  modal.style.display = "flex";

  // CANCELAR
  document.getElementById("cancel-sell").onclick = () => {
    modal.style.display = "none";
  };

  // CONFIRMAR VENDA
  document.getElementById("confirm-sell").onclick = async () => {

    const price = Number(input.value || 0);

    if (price < minPrice) {
      alert("Preço abaixo do mínimo!");
      return;
    }

    console.log("🟢 ITEM À VENDA:", item);
    console.log("💰 PREÇO:", price);

    modal.style.display = "none";
  };
};

// =========================
// 🔥 PONTE DO EVENTO (ESSENCIAL)
// =========================
document.addEventListener("abrirVenda", (e) => {
  console.log("🔥 evento abrirVenda recebido:", e.detail);

  window.abrirVendaItem(e.detail);
});
