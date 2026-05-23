import { auth } from "./perfil.js";
import { getDatabase, ref, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const db = getDatabase();

/* =========================
   USAR ITEM
   (chamado pelo inventário)
========================= */

export async function usarItem(item) {
  if (!item) return;

  const user = auth.currentUser;
  if (!user) return;

  const uid = user.uid;
  const type = item.category;

  const charRef = ref(db, "players/" + uid + "/character");

  try {

    // =========================
    // TROCA DE PÁGINA (PERSONAGEM)
    // =========================
    if (type === "personagem") {
      window.location.href = item.value;
      return;
    }

    // =========================
    // RAÇA / LINHAGEM
    // =========================
    if (type === "linhagem") {
      await update(charRef, {
        race: item.value
      });
      return;
    }

    // =========================
    // AKUMA NO MI
    // =========================
    if (type === "akuma") {
      await update(charRef, {
        fruit: item.value
      });
      return;
    }

    // =========================
    // ESTILO DE LUTA
    // =========================
    if (type === "pergaminho") {
      await update(charRef, {
        style: item.value
      });
      return;
    }

  } catch (err) {
    console.error("Erro ao usar item:", err);
  }
}
