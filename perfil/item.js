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

    // =====================
    // TIPO 5
    // REMOVE AKUMA NO MI
    // =====================
    case 5:
      await usarTipo5(item);
      break;

    // =====================
    // TIPO 6
    // PONTOS PERDIDOS
    // =====================
    case 6:
      await usarTipo6(item);
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
function limparNome(nome, categoria) {

  if (!nome) return "";

  // Pergaminho de Ensinamento
  if (categoria === "Pergaminho de Ensinamento") {

    return nome
      .replace(/^Pergaminho do\s+/i, "")
      .replace(/^Pergaminho da\s+/i, "")
      .replace(/^Pergaminho de\s+/i, "")
      .replace(/^Pergaminho de Ensinamento:\s*/i, "")
      .trim();

  }

  // Outros itens
  if (nome.includes(":")) {
    return nome.split(":")[1].trim();
  }

  return nome.trim();
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
// GERA ITEM ALEATÓRIO (COM SUPORTE A UNICIDADE DE AKUMA NO MI)
// =========================
async function usarTipo1(item) {
  const db = window.db;

  const categoriaRef = ref(db, `itens/${item.categoria}`);
  const snap = await get(categoriaRef);

  if (!snap.exists()) return;

  const itens = snap.val();
  const lista = [];

  // ==========================================
  // SE FOR AKUMA NO MI: VERIFICA UNICIDADE
  // ==========================================
  let akumasExistentes = [];
  if (item.categoria === "Akuma no Mi") {
    const akumasSnap = await get(ref(db, "akumas-existentes"));
    if (akumasSnap.exists()) {
      // Cria uma lista de IDs de Akumas que já existem no jogo
      akumasExistentes = Object.keys(akumasSnap.val());
    }
  }

  for (const itemId in itens) {
    if (itemId === item.id) continue;

    // Se for Akuma no Mi e já existir no jogo, ignora este item
    if (item.categoria === "Akuma no Mi" && akumasExistentes.includes(itemId)) {
      continue;
    }

    lista.push({
      id: itemId,
      ...itens[itemId]
    });
  }

  // Caso todas as Akumas no Mi já tenham sido sorteadas
  if (!lista.length) {
    window.mostrarResultado(
      "AÇÃO NEGADA!",
      "Todas as <b>Akuma no Mi</b> desta categoria já foram encontradas no jogo!",
      "❌"
    );
    return;
  }

  // Sorteia tier
  const tierSorteado = sortearTier();

  // Filtra tier
  let filtrados = lista.filter(i => Number(i.tier) === tierSorteado);

  // Fallback 1: tiers menores
  if (!filtrados.length) {
    filtrados = lista.filter(i => Number(i.tier) < tierSorteado);
  }

  // Fallback 2: qualquer disponível da lista
  if (!filtrados.length) {
    filtrados = lista;
  }

  // Sorteia o item final
  const itemFinal = filtrados[Math.floor(Math.random() * filtrados.length)];

  // Se for Akuma no Mi, registra na lista de existentes no Firebase
  if (item.categoria === "Akuma no Mi") {
    await set(ref(db, `akumasExistentes/${itemFinal.id}`), true);
  }

  // Remove o item consumível usado (ex: baú/caixa de fruta)
  await removerItem(item.id);

  // Adiciona o novo item sorteado ao inventário
  await adicionarItem(itemFinal.id);

  window.mostrarResultado(
    "ITEM SORTEADO!",
    `Você recebeu um(a) <b>${itemFinal.nome || itemFinal.id}</b>.`,
    itemFinal.img
      ? `<img src="https://res.cloudinary.com/djh45admn/image/upload/v1778432202/${itemFinal.img}.png" class="item-open-img">`
      : (itemFinal.item || itemFinal.emoji || itemFinal.icon || "🎁")
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

  const nomeLimpo = limparNome(item.nome, item.categoria);

  // =====================
  // AKUMA NO MI
  // =====================
  if (item.categoria === "Akuma no Mi") {

    const charSnap = await get(charRef);

    if (!charSnap.exists()) return;

    const personagem = charSnap.val();

    if (personagem.fruit !== "—") {

      window.mostrarResultado(
        "AÇÃO NEGADA!",
        "Você já possui uma <b>Akuma no Mi</b>.",
        "❌"
      );

      return;
    }

    updates.fruit = nomeLimpo;
  }

  // =====================
  // RAÇA
  // =====================
  if (item.categoria === "Fator de Linhagem") {
    updates.race = nomeLimpo;
  }

  // =====================
  // ESTILO
  // =====================
  if (item.categoria === "Pergaminho de Ensinamento") {
    updates.style = nomeLimpo;
  }

  await update(charRef, updates);

  await removerItem(item.id);

  window.mostrarResultado(
    "PERSONAGEM ALTERADO!",
    `
    ${item.categoria === "Akuma no Mi"
      ? `Você despertou o poder da <b>${nomeLimpo}</b>.`
      : ""
    }

    ${item.categoria === "Fator de Linhagem"
      ? `Seu fator de linhagem foi reescrito para <b>${nomeLimpo}</b>.`
      : ""
    }

    ${item.categoria === "Pergaminho de Ensinamento"
      ? `Você alterou o seu estilo de luta para <b>${nomeLimpo}</b>.`
      : ""
    }
    `,
    item.img
      ? `<img src="https://res.cloudinary.com/djh45admn/image/upload/v1778432202/${item.img}.png"
          class="item-open-img">`
      : (item.item || item.emoji || item.icon || "⚡")
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
      ref(db, `itens/Baú do Tesouro/${item.id}`);

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

            itemRecebido = {
              id: itemId
            };

            break;
          }
        }

        console.log("DROP:", itemRecebido);

        if (itemRecebido) {
          await adicionarItem(itemRecebido.id);
        }
      }
    }

    // =====================
    // BUSCA DADOS DO ITEM
    // =====================
    if (itemRecebido) {

      const categoriasSnap =
        await get(ref(db, "itens"));

      if (categoriasSnap.exists()) {

        const categorias =
          categoriasSnap.val();

        for (const categoria in categorias) {

          if (categorias[categoria]?.[itemRecebido.id]) {

            itemRecebido = {
              id: itemRecebido.id,
              ...categorias[categoria][itemRecebido.id]
            };

            break;
          }
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
    console.log("REC:", item.rec);
    console.log(item);
    window.mostrarResultado(
      "BAÚ ABERTO!",
      `
      Você recebeu <b>${dinheiro} Berries</b>.<br>
      ${
        itemRecebido
          ? `Você encontrou um(a) <b>${itemRecebido.nome || itemRecebido.id}</b>.`
          : ""
      }
      `,
      itemRecebido?.img
        ? `<img src="https://res.cloudinary.com/djh45admn/image/upload/v1778432202/${itemRecebido.img}.png"
            class="item-open-img">`
        : itemRecebido
          ? (itemRecebido.item || itemRecebido.emoji || itemRecebido.icon || "📦")
          : `<img src="https://res.cloudinary.com/djh45admn/image/upload/v1778432202/${item.rec}.png"
              class="item-open-img">`
    );
  }

// =========================
// TIPO 5
// REMOVE AKUMA NO MI
// =========================
async function usarTipo5(item) {
  const auth = window.auth;
  const db = window.db;

  const user = auth.currentUser;
  if (!user) return;

  const charRef = ref(db, `players/${user.uid}/character`);
  const charSnap = await get(charRef);

  if (charSnap.exists()) {
    const personagem = charSnap.val();
    const nomeFruta = personagem.fruit;

    // Se o player possui uma fruta registrada
    if (nomeFruta && nomeFruta !== "—") {
      const itensSnap = await get(ref(db, "itens/Akuma no Mi"));

      if (itensSnap.exists()) {
        const akumas = itensSnap.val();

        // Encontra o ID do item que possui o mesmo nome limpo registrado no player
        for (const id in akumas) {
          const nomeLimpo = limparNome(akumas[id].nome || id, "Akuma no Mi");

          if (nomeLimpo === nomeFruta) {
            // 🔥 Libera a fruta para o mundo de novo
            await remove(ref(db, `akumasExistentes/${id}`));
            break;
          }
        }
      }
    }
  }

  // Reseta a fruta do personagem no Firebase
  await update(charRef, {
    fruit: "—"
  });

  // Consome o item de remoção
  await removerItem(item.id);

  window.mostrarResultado(
    "AKUMA NO MI REMOVIDA!",
    "Você renunciou ao poder da sua <b>Akuma no Mi</b>.",
    item.img
      ? `<img src="https://res.cloudinary.com/djh45admn/image/upload/v1778432202/${item.img}.png" class="item-open-img">`
      : (item.item || item.emoji || item.icon || "🍎")
  );
}
// =========================
// TIPO 6
// RECUPERA SKILL PERDIDA
// =========================
async function usarTipo6(item) {

  const auth = window.auth;
  const db = window.db;

  const user = auth.currentUser;

  if (!user) return;


  const perdidosRef =
    ref(db, `players/${user.uid}/points/perdidos`);

  const disponivelRef =
    ref(db, `players/${user.uid}/points/skill-available`);


  // pega pontos perdidos
  const perdidoSnap =
    await get(perdidosRef);


  let perdidos = 0;

  if (perdidoSnap.exists()) {
    perdidos = Number(perdidoSnap.val()) || 0;
  }


  if (perdidos <= 0) {

    window.mostrarResultado(
      "AÇÃO NEGADA!",
      "Você não possui pontos de habilidade perdidos.",
      "❌"
    );

    return;
  }


  // pega pontos atuais disponíveis
  const disponivelSnap =
    await get(disponivelRef);


  let disponivel = 0;

  if (disponivelSnap.exists()) {
    disponivel = Number(disponivelSnap.val()) || 0;
  }


  // adiciona perdido ao disponível
  await set(
    disponivelRef,
    disponivel + perdidos
  );


  // zera perdidos
  await set(
    perdidosRef,
    0
  );


  // remove item
  await removerItem(item.id);


  window.mostrarResultado(
    "PONTOS RESTAURADOS!",
    `
    Você recuperou <b>${perdidos}</b> pontos de habilidade.
    <br>
    Eles foram enviados para seus pontos disponíveis.
    `,
    item.img
      ? `<img src="https://res.cloudinary.com/djh45admn/image/upload/v1778432202/${item.img}.png"
          class="item-open-img">`
      : "💎"
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

