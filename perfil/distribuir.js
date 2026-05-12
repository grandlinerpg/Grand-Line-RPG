fetch("perfil/distribuir.html")
  .then(res => res.text())
  .then(data => {

    document.getElementById("modal-container").innerHTML = data;

    const modal = document.querySelector(".points-modal");

    modal.style.display = "none";

    // 🔥 GARANTE QUE O BOTÃO JÁ EXISTE NO DOM
    const openBtn = document.getElementById("open-points");
    const closeBtn = document.querySelector(".close-btn");

    // ABRIR
    openBtn.addEventListener("click", () => {

      modal.style.display = "flex";

    });

    // FECHAR
    closeBtn.addEventListener("click", () => {

      modal.style.display = "none";

    });

  });
