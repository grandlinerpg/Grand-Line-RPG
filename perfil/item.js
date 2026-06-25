import {
  ref,
  get,
  set,
  update,
  remove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// =========================
// CHANCE DOS TIERS
// =========================
const tierChance = {
  1: 60,
  2: 25,
  3: 11,
  4: 3,
  5: 1
};

// =========================
// FUNÇÃO GLOBAL
// =========================
window.usarItem = async function(item) {

  if (!item) return;

  console.log("TIPO ITEM:", item.tipo, item);

  switch (Number(item.tipo)) {

    // =====================
    // TIPO 1
    // SORTEIA ITEM
    // =====================
    case 1:
      await usarTipo1(item);
      break;

    // =====================
    // TIPO 2
    // ALTERA PERSONAGEM
    // =====================
    case 2:
      await usarTipo2(item);
      break;

    // =====================
    // TIPO 3
    // REDIRECIONA
    // =====================
    case 3:
      usarTipo3(item);
      break;

    // =====================
    // TIPO 4
    // BAÚ
    // =====================
    case 4:
      console.log("ENTROU NO TIPO 4");
      await usarTipo4(item);
      break;
  }
};

// =========================
// REMOVE ITEM
// =========================
async function removerItem(itemId) {

  const auth = window.auth;
  const db = window.db;

  const user = auth.currentUser;

  if (!user) return;

  const itemRef =
    ref(db, `players/${user.uid}/inventory/${itemId}`);

  const snap = await get(itemRef);

  if (!snap.exists()) return;

  const atual = snap.val();

  // 🔥 REMOVE DO FIREBASE
  if (atual <= 1) {

    await remove(itemRef);

  } else {

    await set(itemRef, atual - 1);
  }
}

// =========================
// ADICIONA ITEM
// =========================
async function adicionarItem(itemId) {

  const auth = window.auth;
  const db = window.db;

  const user = auth.currentUser;

  if (!user) return;

  const itemRef =
    ref(db, `players/${user.uid}/inventory/${itemId}`);

  const snap = await get(itemRef);

  let atual = 0;

  if (snap.exists()) {
    atual = snap.val();
  }

  await set(itemRef, atual + 1);
}

// =========================
// LIMPA PREFIXO
// =========================
function limparNome(nome) {

  if (!nome.includes(":")) {
    return nome.trim();
  }

  return nome.split(":")[1].trim();
}

// =========================
// SORTEAR TIER
// =========================
function sortearTier() {

  const total =
    Object.values(tierChance)
      .reduce((a, b) => a + b, 0);

  let rng = Math.random() * total;

  let acumulado = 0;

  for (const tier in tierChance) {

    acumulado += tierChance[tier];

    if (rng <= acumulado) {
      return Number(tier);
    }
  }

  return 1;
}

// =========================
// TIPO 1
// GERA ITEM ALEATÓRIO
// =========================
async function usarTipo1(item) {

  const db = window.db;

  const categoriaRef =
    ref(db, `itens/${item.categoria}`);

  const snap = await get(categoriaRef);

  if (!snap.exists()) return;

  const itens = snap.val();

  const lista = [];

  for (const itemId in itens) {

    if (itemId === item.id) continue;

    lista.push({
      id: itemId,
      ...itens[itemId]
    });
  }

  if (!lista.length) return;

  // sorteia tier
  const tierSorteado = sortearTier();

  // filtra tier
  let filtrados =
    lista.filter(i =>
      Number(i.tier) === tierSorteado
    );

  // fallback
  if (!filtrados.length) {

    filtrados =
      lista.filter(i =>
        Number(i.tier) < tierSorteado
      );
  }

  // fallback final
  if (!filtrados.length) {
    filtrados = lista;
  }

  // sorteia item
  const itemFinal =
    filtrados[
      Math.floor(Math.random() * filtrados.length)
    ];

  // remove usado
  await removerItem(item.id);

  // adiciona novo
  await adicionarItem(itemFinal.id);

  window.mostrarResultado(
    "ITEM SORTEADO!",
    `Você recebeu <b>${itemFinal.nome || itemFinal.id}</b>`,
    "🎁"
  );
}

// =========================
// TIPO 2
// ALTERA PERSONAGEM
// =========================
async function usarTipo2(item) {

  const auth = window.auth;
  const db = window.db;

  const user = auth.currentUser;

  if (!user) return;

  const charRef =
    ref(db, `players/${user.uid}/character`);

  const updates = {};

  const nomeLimpo = limparNome(item.nome);

  // =====================
  // AKUMA NO MI
  // =====================
  if (item.categoria === "akuma no mi") {
    updates.fruit = nomeLimpo;
  }

  // =====================
  // RAÇA
  // =====================
  if (item.categoria === "fator de linhagem") {
    updates.race = nomeLimpo;
  }

  // =====================
  // ESTILO
  // =====================
  if (item.categoria === "pergaminho de ensinamento") {
    updates.style = nomeLimpo;
  }

  await update(charRef, updates);

  await removerItem(item.id);

  window.mostrarResultado(
    "PERSONAGEM ALTERADO!",
    `
    ${item.categoria === "akuma no mi" ? "🍇 Fruta equipada" : ""}
    ${item.categoria === "fator de linhagem" ? "🧬 Raça alterada" : ""}
    ${item.categoria === "pergaminho de ensinamento" ? "📜 Estilo alterado" : ""}
    `,
    "⚡"
  );
}

// =========================
// TIPO 3
// REDIRECIONAMENTO
// =========================
function usarTipo3(item) {

  if (!item.value) return;

  window.location.href =
    `${item.value}.html`;
}

// =========================
// TIPO 4
// BAÚ
// =========================
async function usarTipo4(item) {

  console.log("USANDO BAÚ", item);

  const auth = window.auth;
  const db = window.db;

  const user = auth.currentUser;

  if (!user) return;

  // =====================
  // PEGA BAÚ
  // =====================
  const bauRef =
    ref(db, `itens/baus/${item.id}`);

  const snap = await get(bauRef);

  console.log("SNAP:", snap.exists(), snap.val());

  if (!snap.exists()) return;

  const bau = snap.val();

  // =====================
  // DINHEIRO
  // =====================
  const saldoRef =
    ref(db, `players/${user.uid}/info/saldo`);

  const saldoSnap = await get(saldoRef);

  let saldoAtual = 0;

  if (saldoSnap.exists()) {
    saldoAtual = Number(saldoSnap.val()) || 0;
  }

  const min =
    Number(bau.dinheiro?.min) || 0;

  const max =
    Number(bau.dinheiro?.max) || 0;

  const dinheiro =
    Math.floor(
      Math.random() * (max - min + 1)
    ) + min;

  console.log("DINHEIRO:", dinheiro);

  await set(
    saldoRef,
    saldoAtual + dinheiro
  );

  // =====================
  // CHANCE DE ITEM
  // =====================
  let itemRecebido = null;

  const prob =
    Number(bau.prob) || 0;

  console.log("PROB:", prob);

  const rngProb =
    Math.random() * 100;

  if (rngProb <= prob) {

    const drops =
      bau.drops || {};

    const lista =
      Object.entries(drops);

    if (lista.length) {

      const totalChance =
        lista.reduce(
          (acc, [, chance]) =>
            acc + (Number(chance) || 0),
          0
        );

      let rng =
        Math.random() * totalChance;

      let acumulado = 0;

      for (const [itemId, chance] of lista) {

        acumulado +=
          Number(chance) || 0;

        if (rng <= acumulado) {

          itemRecebido = itemId;

          break;
        }
      }

      console.log("DROP:", itemRecebido);

      if (itemRecebido) {
        await adicionarItem(itemRecebido);
      }
    }
  }

  // =====================
  // REMOVE BAÚ
  // =====================
  await removerItem(item.id);

  // =====================
  // ALERTA
  // =====================

  window.mostrarResultado(
     "BAÚ ABERTO!",
     `
    Você recebeu <b>${dinheiro} Berries</b><br>
    ${itemRecebido ? `🎁 Você recebeu: <b>${itemRecebido.nome}</b>` : "Sem item adicional"}
    `,
    "🧰"
   );
  }

  // =====================
  // RESULTADO
  // =====================
  window.mostrarResultado = function(titulo, texto, icon = "📦") {

    const modal = document.getElementById("result-modal");
    const title = document.getElementById("result-title");
    const content = document.getElementById("result-content");
    const iconBox = document.getElementById("result-icon");

    title.innerText = titulo;
    content.innerHTML = texto;
    iconBox.innerHTML = icon;

    modal.style.display = "flex";
  };

// =========================
// FECHAR RESULTADO
// =========================
document.getElementById("close-result")
  .addEventListener("click", () => {

    document.getElementById("result-modal")
      .style.display = "none";
});
