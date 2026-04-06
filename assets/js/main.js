(function () {
  const header = document.querySelector(".site-header");
  const anchorLinks = document.querySelectorAll('a[href^="#"]');

  function syncHeaderState() {
    if (!header) {
      return;
    }

    header.classList.toggle("is-scrolled", window.scrollY > 12);
  }

  anchorLinks.forEach(function (link) {
    link.addEventListener("click", function (event) {
      const href = link.getAttribute("href");
      if (!href || href === "#") {
        return;
      }

      const target = document.querySelector(href);
      if (!target) {
        return;
      }

      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", href);
    });
  });

  syncHeaderState();
  window.addEventListener("scroll", syncHeaderState, { passive: true });
})();
