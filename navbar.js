document.addEventListener("DOMContentLoaded", async () => {
  const navbarContainer = document.getElementById("navbar-container");
  if (!navbarContainer) return;

  // Descobre automaticamente se estamos dentro de uma subpasta (como /guia/)
  const isGuiaSubfolder = window.location.pathname.includes("/guia/");
  const prefix = isGuiaSubfolder ? "../" : "";

  try {
    const response = await fetch(`${prefix}navbar.html`);
    if (!response.ok) throw new Error("Não foi possível carregar a navbar.");
    
    const html = await response.text();
    navbarContainer.innerHTML = html;
  } catch (error) {
    console.warn("Usando fallback da navbar devido a restrição de fetch/CORS.");
    
    // Injeta o HTML com os links corrigidos dinamicamente pelo prefixo
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
          <a href="${prefix}perfil.html">PERFIL</a>
          <a href="${prefix}faccao.html">FACÇÃO</a>
          <a href="${prefix}ranking.html">RANKING</a>
          <a href="${prefix}mapa.html">MAPA</a>
          <a href="${prefix}guia.html">GUIA</a>
        </nav>
      </header>
    `;
  }

  // Ativa o comportamento do menu mobile (hambúrguer)
  const menuToggle = document.getElementById("menu-toggle");
  const navMenu = document.getElementById("nav-menu");

  if (menuToggle && navMenu) {
    menuToggle.replaceWith(menuToggle.cloneNode(true));
    const activeToggle = document.getElementById("menu-toggle");
    
    activeToggle.addEventListener("click", () => {
      navMenu.classList.toggle("active");
    });
  }
});
