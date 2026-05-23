import { auth } from "./perfil.js";
import { getDatabase, ref, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const db = getDatabase();

/* =========================
   NORMALIZE (limpa value)
========================= */

function normalize(value) {
  if (!value) return "";

  return value
    .toLowerCase()
    .replace(/fator de linhagem:/g, "")
    .replace(/pergaminho de ensinamento:/g, "")
    .replace(/akuma no mi:/g, "")
    .replace(/personagem:/g, "")
    .trim();
}

/* =========================
   USAR ITEM
========================= */

export async function usarItem(item) {
  if (!item) return;

  const user = auth.currentUser;
  if (!user) return;

  const uid = user.uid;

  const type = item.category; // já vem separado pelas tuas abas
  const value = normalize(item.value);

  const charRef = ref(db, "players/" + uid + "/character");

  try {

    // =========================
    // PERSONAGEM (TROCA DE PÁGINA)
    // =========================
    if (type === "personagem") {
      window.location.href = item.value; // aqui NÃO normaliza
      return;
    }

    // =========================
    // LINHAGEM (FATOR DE LINHAGEM)
    // =========================
    if (type === "fator de linhagem" || type === "linhagem") {
      await update(charRef, {
        race: value
      });
      return;
    }

    // =========================
    // AKUMA NO MI
    // =========================
    if (type === "akuma no mi" || type === "akuma") {
      await update(charRef, {
        fruit: value
      });
      return;
    }

    // =========================
    // PERGAMINHO DE ENSINAMENTO (ESTILO DE LUTA)
    // =========================
    if (type === "pergaminho de ensinamento" || type === "pergaminho") {
      await update(charRef, {
        style: value
      });
      return;
    }

    // =========================
    // BAÚS (itens genéricos / futuros efeitos)
    // =========================
    if (type === "baus" || type === "baú") {
      console.log("Item de baú usado:", item.name);
      return;
    }

    console.warn("Categoria desconhecida:", type);

  } catch (err) {
    console.error("Erro ao usar item:", err);
  }
}
