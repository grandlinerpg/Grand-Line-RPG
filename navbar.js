document.addEventListener("DOMContentLoaded", async () => {
  const navbarContainer = document.getElementById("navbar-container");
  if (!navbarContainer) return;

  try {
    // Se o seu HTML da navbar estiver separado em uma pasta (ex: components/navbar.html), ajuste o caminho abaixo:
    const response = await fetch("navbar.html"); 
    
    // Se preferir manter o HTML direto no JS para evitar requisição extra, veja a alternativa abaixo.
    if (!response.ok) throw new Error("Não foi possível carregar a navbar.");
    
    const html = await response.text();
    navbarContainer.innerHTML = html;

    // Ativa o comportamento do menu mobile (hambúrguer)
    const menuToggle = document.getElementById("menu-toggle");
    const navMenu = document.getElementById("nav-menu");

    if (menuToggle && navMenu) {
      menuToggle.addEventListener("click", () => {
        navMenu.classList.toggle("active");
      });
    }
  } catch (error) {
    console.error("Erro ao carregar a barra de navegação:", error);
    
    // Fallback caso prefira injetar o HTML direto via JS caso o fetch dê erro de CORS local:
    navbarContainer.innerHTML = `
      <header class="navbar">
        <div class="logo-area">
          <img src="https://res.cloudinary.com/djh45admn/image/upload/v1778336777/logoglrpg.png" class="logo">
          <div class="logo-text">
            <h1>GRAND LINE</h1>
            <p>— RPG —</p>
          </div>
        </div>
        <button class="menu-toggle" id="menu-toggle">☰</button>
        <nav id="nav-menu">
          <a href="perfil.html">PERFIL</a>
          <a href="faccao.html">FACÇÃO</a>
          <a href="mapa.html">MAPA</a>
          <a href="guia.html">GUIA</a>
        </nav>
      </header>
    `;

    const menuToggle = document.getElementById("menu-toggle");
    const navMenu = document.getElementById("nav-menu");

    if (menuToggle && navMenu) {
      menuToggle.addEventListener("click", () => {
        navMenu.classList.toggle("active");
      });
    }
  }
});
