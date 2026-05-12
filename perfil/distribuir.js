fetch("perfil/distribuir.html")
  .then(res => res.text())
  .then(data => {

    document.getElementById("modal-container").innerHTML = data;

    const modal = document.querySelector(".points-modal");

    modal.style.display = "none";

    // ABRIR
    document
      .getElementById("open-points")
      .addEventListener("click", () => {

        modal.style.display = "flex";

      });

    // FECHAR
    document
      .querySelector(".close-btn")
      .addEventListener("click", () => {

        modal.style.display = "none";

      });

  });
