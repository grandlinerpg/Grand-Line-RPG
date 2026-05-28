import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export async function loadNavbar(targetSelector = "#navbar-placeholder") {

  const res = await fetch("/navbar.html");
  const html = await res.text();

  const target = document.querySelector(targetSelector);
  target.innerHTML = html;

  const menuToggle = document.getElementById("menu-toggle");
  const navMenu = document.getElementById("nav-menu");

  if (menuToggle && navMenu) {
    menuToggle.addEventListener("click", () => {
      navMenu.classList.toggle("active");
    });
  }

  const auth = getAuth();

  const home = document.getElementById("nav-home");
  const profile = document.getElementById("nav-profile");

  onAuthStateChanged(auth, (user) => {

    if (user) {
      if (home) home.style.display = "none";
      if (profile) profile.style.display = "block";
    } else {
      if (home) home.style.display = "block";
      if (profile) profile.style.display = "none";
    }

  });
}
