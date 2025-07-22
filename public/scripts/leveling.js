const menuToggle = document.getElementById("menuToggle");
const mobileMenu = document.getElementById("mobileMenu");
const menuOverlay = document.getElementById("menuOverlay");

menuToggle.addEventListener("click", () => {
  const isOpen = mobileMenu.classList.toggle("active");
  menuOverlay.classList.toggle("active");
  document.body.classList.toggle("menu-open", isOpen);
});

menuOverlay.addEventListener("click", () => {
  mobileMenu.classList.remove("active");
  menuOverlay.classList.remove("active");
  document.body.classList.remove("menu-open");
  menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
});

document.getElementById("menuClose").addEventListener("click", function () {
  document.getElementById("mobileMenu").classList.remove("active");
  document.getElementById("menuOverlay").classList.remove("active");
  document.body.classList.remove("menu-open");
});
