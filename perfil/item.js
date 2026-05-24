import {
  ref,
  get,
  set,
  update
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

console.log("ITEM.JS CARREGOU");

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

  console.log("BOTÃO USAR FUNCIONOU");
  console.log("ITEM RECEBIDO:", item);

  if (!item) {
    console.log("ITEM INVÁLIDO");
    return;
  }

  console.log("TIPO:", item.tipo);

  switch (Number(item.tipo)) {

    // =====================
    // TIPO 1
    // SORTEIA ITEM
    // =====================
    case 1:

      console.log("ENTROU NO TIPO 1");

      await usarTipo1(item);

      break;

    // =====================
    // TIPO 2
    // ALTERA PERSONAGEM
    // =====================
    case 2:

      console.log("ENTROU NO TIPO 2");

      await usarTipo2(item);

      break;

    // =====================
    // TIPO 3
    // REDIRECIONA
    // =====================
    case 3:

      console.log("ENTROU NO TIPO 3");

      usarTipo3(item);

      break;

    default:

      console.log("TIPO NÃO RECONHECIDO");
  }
};

// =========================
// REMOVE ITEM
// =========================
async function removerItem(itemId) {

  console.log("REMOVENDO ITEM:", itemId);

  const auth = window.auth;
  const db = window.db;

  const user = auth.currentUser;

  if (!user) {
    console.log("SEM USUÁRIO");
    return;
  }

  const itemRef =
    ref(db, `players/${user.uid}/inventory/${itemId}`);

  const snap = await get(itemRef);

  console.log("ITEM EXISTE?", snap.exists());

  if (!snap.exists()) return;

  const atual = snap.val();

  console.log("QUANTIDADE ATUAL:", atual);

  if (atual <= 1) {

    await set(itemRef, 0);

    console.log("ITEM ZERADO");

  } else {

    await set(itemRef, atual - 1);

    console.log("ITEM DIMINUÍDO");
  }
}

// =========================
// ADICIONA ITEM
// =========================
async function adicionarItem(itemId) {

  console.log("ADICIONANDO ITEM:", itemId);

  const auth = window.auth;
  const db = window.db;

  const user = auth.currentUser;

  if (!user) {
    console.log("SEM USUÁRIO");
    return;
  }

  const itemRef =
    ref(db, `players/${user.uid}/inventory/${itemId}`);

  const snap = await get(itemRef);

  let atual = 0;

  if (snap.exists()) {
    atual = snap.val();
  }

  console.log("QUANTIDADE ANTES:", atual);

  await set(itemRef, atual + 1);

  console.log("ITEM ADICIONADO");
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

      console.log("TIER SORTEADO:", tier);

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

  console.log("INICIANDO usarTipo1");

  const db = window.db;

  console.log("CATEGORIA:", item.categoria);

  const categoriaRef =
    ref(db, `itens/${item.categoria}`);

  console.log("BUSCANDO:", `itens/${item.categoria}`);

  const snap = await get(categoriaRef);

  console.log("SNAP EXISTS:", snap.exists());

  if (!snap.exists()) return;

  const itens = snap.val();

  console.log("ITENS DA CATEGORIA:", itens);

  const lista = [];

  for (const itemId in itens) {

    if (itemId === item.id) continue;

    lista.push({
      id: itemId,
      ...itens[itemId]
    });
  }

  console.log("LISTA FINAL:", lista);

  if (!lista.length) {

    console.log("SEM ITENS DISPONÍVEIS");

    return;
  }

  // sorteia tier
  const tierSorteado = sortearTier();

  // filtra tier
  let filtrados =
    lista.filter(i =>
      Number(i.tier) === tierSorteado
    );

  console.log("FILTRADOS:", filtrados);

  // fallback
  if (!filtrados.length) {

    filtrados =
      lista.filter(i =>
        Number(i.tier) < tierSorteado
      );

    console.log("FALLBACK 1:", filtrados);
  }

  // fallback final
  if (!filtrados.length) {

    filtrados = lista;

    console.log("FALLBACK FINAL");
  }

  // sorteia item
  const itemFinal =
    filtrados[
      Math.floor(Math.random() * filtrados.length)
    ];

  console.log("ITEM FINAL:", itemFinal);

  // remove usado
  await removerItem(item.id);

  // adiciona novo
  await adicionarItem(itemFinal.id);

  console.log("TIPO 1 FINALIZADO");
}

// =========================
// TIPO 2
// ALTERA PERSONAGEM
// =========================
async function usarTipo2(item) {

  console.log("INICIANDO usarTipo2");

  const auth = window.auth;
  const db = window.db;

  const user = auth.currentUser;

  if (!user) {
    console.log("SEM USUÁRIO");
    return;
  }

  const charRef =
    ref(db, `players/${user.uid}/character`);

  const updates = {};

  // =====================
  // AKUMA NO MI
  // =====================
  if (item.categoria === "akuma no mi") {

    updates.fruit = item.nome;

    console.log("SETANDO FRUIT");
  }

  // =====================
  // RAÇA
  // =====================
  if (item.categoria === "fator de linhagem") {

    updates.race = item.nome;

    console.log("SETANDO RACE");
  }

  // =====================
  // ESTILO
  // =====================
  if (item.categoria === "pergaminho de ensinamento") {

    updates.style = item.nome;

    console.log("SETANDO STYLE");
  }

  console.log("UPDATES:", updates);

  await update(charRef, updates);

  await removerItem(item.id);

  console.log("TIPO 2 FINALIZADO");
}

// =========================
// TIPO 3
// REDIRECIONAMENTO
// =========================
function usarTipo3(item) {

  console.log("REDIRECIONANDO");

  window.location.href =
    `item.html?id=${item.id}`;
}
