import { auth } from "./perfil.js";
import { getDatabase, ref, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const db = getDatabase();

export async function usarItem(item) {
  if (!item) return;

  const user = auth.currentUser;
  if (!user) return;

  const uid = user.uid;

  const type = (item.category || "").toLowerCase();

  const charRef = ref(db, "players/" + uid + "/character");

  try {

    // =========================
    // PERSONAGEM (troca de página)
    // =========================
    if (type === "personagem") {
      window.location.href = item.value; // ex: criacao-personagem.html
      return;
    }

    // =========================
    // FATOR DE LINHAGEM
    // =========================
    if (type === "fator de linhagem") {
      await update(charRef, {
        race: item.name // "Fator de Linhagem: Gigante"
      });
      return;
    }

    // =========================
    // AKUMA NO MI
    // =========================
    if (type === "akuma no mi") {
      await update(charRef, {
        fruit: item.name // "Gomu Gomu no Mi"
      });
      return;
    }

    // =========================
    // PERGAMINHO DE ENSINAMENTO
    // =========================
    if (type === "pergaminho de ensinamento") {
      await update(charRef, {
        style: item.name
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

    console.warn("Categoria desconhecida:", type);

  } catch (err) {
    console.error("Erro ao usar item:", err);
  }
}
