import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getDatabase,
  ref,
  get,
  update
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ⚠️ NÃO inicializa Firebase aqui se já inicializa no perfil.js
const auth = getAuth();
const db = getDatabase();

// ======================
// CARREGA MODAL
// ======================
fetch("perfil/distribuir.html")
  .then(res => res.text())
  .then(html => {

    document.getElementById("modal-container").innerHTML = html;

    const modal = document.querySelector(".points-modal");
    modal.style.display = "none";

    const openBtn = document.getElementById("open-points");
    const closeBtn = document.querySelector(".close-btn");

    openBtn.addEventListener("click", () => {
      modal.style.display = "flex";
    });

    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });

    // ======================
    // FIREBASE DADOS (usa perfil do usuário logado)
    // ======================
    onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      const userRef = ref(db, `users/${user.uid}`);
      const snap = await get(userRef);

      if (!snap.exists()) return;

      const data = snap.val();

      // ======================
      // PREENCHER MODAL
      // ======================
      document.getElementById("modal-str").innerText = data.str || 0;
      document.getElementById("modal-res").innerText = data.res || 0;
      document.getElementById("modal-dex").innerText = data.dex || 0;
      document.getElementById("modal-agi").innerText = data.agi || 0;
      document.getElementById("modal-sta").innerText = data.sta || 0;
      document.getElementById("modal-hp").innerText  = data.hp  || 0;

      document.getElementById("available-points").innerText = data.availablePoints || 0;
      document.getElementById("used-points").innerText = data.usedPoints || 0;

    });

  });
