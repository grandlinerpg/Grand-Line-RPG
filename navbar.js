document.addEventListener("DOMContentLoaded", async () => {
  const navbarContainer = document.getElementById("navbar-container");
  if (!navbarContainer) return;

  try {
    const response = await fetch("navbar.html");  
    if (!response.ok) throw new Error("Não foi possível carregar a navbar.");
    
    const html = await response.text();
    navbarContainer.innerHTML = html;

    setupMenuToggle();
  } catch (error) {
    console.error("Erro ao carregar a barra de navegação:", error);
    
    // Fallback com caminhos corrigidos com "/" na frente para apontar sempre para a raiz do site
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
          <a href="/perfil.html">PERFIL</a>
          <a href="/faccao.html">FACÇÃO</a>
          <a href="/ranking.html">RANKING</a>
          <a href="/mapa.html">MAPA</a>
          <a href="/guia.html">GUIA</a>
        </nav>
      </header>
    `;

    setupMenuToggle();
  }
});

function setupMenuToggle() {
  const menuToggle = document.getElementById("menu-toggle");
  const navMenu = document.getElementById("nav-menu");

  if (menuToggle && navMenu) {
    menuToggle.addEventListener("click", () => {
      navMenu.classList.toggle("active");
    });
  }
}
