import {
  ref,
  get,
  update,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

export async function comprarItem(db, item, quantidade, compradorUid) {
  const vendedorUid = item.jogador;
  const total = item.value * quantidade;

  const buyerRef = ref(db, `players/${compradorUid}/info/saldo`);
  const sellerRef = ref(db, `players/${vendedorUid}/info/saldo`);
  const marketRef = ref(db, `mercado/itens/${item.id}`);

  try {
    // 🔥 pega saldos atuais
    const buyerSnap = await get(buyerRef);
    const sellerSnap = await get(sellerRef);
    const marketSnap = await get(marketRef);

    if (!buyerSnap.exists()) throw new Error("Comprador não existe");
    if (!sellerSnap.exists()) throw new Error("Vendedor não existe");
    if (!marketSnap.exists()) throw new Error("Item não existe no mercado");

    const buyerSaldo = buyerSnap.val();
    const sellerSaldo = sellerSnap.val();
    const marketData = marketSnap.val();

    // 🔥 valida estoque
    if (marketData.qtd < quantidade) {
      throw new Error("Quantidade indisponível");
    }

    // 🔥 valida saldo
    if (buyerSaldo < total) {
      throw new Error("Saldo insuficiente");
    }

    // 💰 atualiza saldos
    await update(ref(db), {
      [`players/${compradorUid}/info/saldo`]: buyerSaldo - total,
      [`players/${vendedorUid}/info/saldo`]: sellerSaldo + total
    });

    // 📦 atualiza mercado com segurança
    await runTransaction(marketRef, (data) => {
      if (!data) return data;

      data.qtd -= quantidade;

      // se acabar estoque, remove anúncio
      if (data.qtd <= 0) return null;

      return data;
    });

    console.log("COMPRA REALIZADA COM SUCESSO");

    return true;

  } catch (err) {
    console.error("ERRO NA COMPRA:", err.message);
    return false;
  }
}
