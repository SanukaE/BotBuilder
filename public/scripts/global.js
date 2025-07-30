// Common menu toggle logic for all pages
const menuToggle = document.getElementById("menuToggle");
const mobileMenu = document.getElementById("mobileMenu");
const menuOverlay = document.getElementById("menuOverlay");
const menuClose = document.getElementById("menuClose");

if (menuToggle && mobileMenu && menuOverlay) {
  menuToggle.addEventListener("click", () => {
    const isOpen = mobileMenu.classList.toggle("active");
    menuOverlay.classList.toggle("active");
    document.body.classList.toggle("menu-open", isOpen);
  });

  menuOverlay.addEventListener("click", closeMenu);
  if (menuClose) menuClose.addEventListener("click", closeMenu);

  function closeMenu() {
    mobileMenu.classList.remove("active");
    menuOverlay.classList.remove("active");
    document.body.classList.remove("menu-open");
    menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
  }
}

// Utility to get cookie value by name
function getCookie(name) {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

// Utility to set cookie
function setCookie(name, value, days = 365) {
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(
    value
  )}; path=/; max-age=${maxAge}`;
}

// Prompt for API key if not set
document.addEventListener("DOMContentLoaded", () => {
  if (!getCookie("apiKey")) {
    const userKey = prompt("Please enter your API Key:");
    if (userKey) setCookie("apiKey", userKey);
  }
});
