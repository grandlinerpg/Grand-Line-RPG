import { auth } from "./perfil.js";
import { getDatabase, ref, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const db = getDatabase();

/* =========================
   NORMALIZE (SÓ REMOVE PREFIXO)
========================= */

function normalize(value) {
  if (!value) return "";

  return value
    .replace(/Fator de Linhagem:\s*/g, "")
    .replace(/Pergaminho de Ensinamento:\s*/g, "")
    .replace(/Akuma no Mi:\s*/g, "")
    .replace(/Troca de Personagem/g, "criacao-personagem.html")
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

  const type = (item.category || "").toLowerCase();
  const value = item.value;

  const charRef = ref(db, "players/" + uid + "/character");

  try {

    // =========================
    // PERSONAGEM (PÁGINA)
    // =========================
    if (type === "personagem") {
      window.location.href = "perfil/criacao-personagem.html";
      return;
    }

    // =========================
    // FATOR DE LINHAGEM
    // =========================
    if (type === "fator de linhagem") {
      await update(charRef, {
        race: normalize(value) // mantém "Gigante"
      });
      return;
    }

    // =========================
    // AKUMA NO MI
    // =========================
    if (type === "akuma no mi") {
      await update(charRef, {
        fruit: normalize(value) // mantém "Gomu Gomu no Mi"
      });
      return;
    }

    // =========================
    // PERGAMINHO
    // =========================
    if (type === "pergaminho de ensinamento") {
      await update(charRef, {
        style: normalize(value) // mantém "Espadachim"
      });
      return;
    }

    // =========================
    // BAÚS
    // =========================
    if (type === "baus") {
      console.log("Item de baú usado:", item.name);
      return;
    }

    console.warn("Categoria não reconhecida:", type);

  } catch (err) {
    console.error("Erro ao usar item:", err);
  }
}
