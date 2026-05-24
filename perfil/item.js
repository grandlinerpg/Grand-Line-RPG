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
  1: 50,
  2: 30,
  3: 15,
  4: 4,
  5: 1
};

// =========================
// FUNÇÃO GLOBAL
// =========================
window.usarItem = async function(item) {

  if (!item) return;

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
