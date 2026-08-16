(function () {
  document.body.classList.add("mf-preview-mode");
  document.body.classList.remove("mf-preload-locked");
  document.body.classList.add("mf-site-entered", "mf-page-revealed", "mf-name-revealed");

  const loader = document.getElementById("mfLoader");
  if (loader) loader.classList.add("done");

  /* Cursor glow on guidance portals */
  document.querySelectorAll(".mf-guidance-portal").forEach((portal) => {
    portal.addEventListener("pointermove", (e) => {
      const rect = portal.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      portal.style.setProperty("--mx", x + "%");
      portal.style.setProperty("--my", y + "%");
      portal.classList.add("is-glow");
    });
    portal.addEventListener("pointerleave", () => {
      portal.classList.remove("is-glow");
    });
  });

  /* Jump straight to Guidance section */
  window.addEventListener("load", () => {
    const target = document.getElementById("guidance");
    if (target) {
      setTimeout(() => {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 400);
    }
  });
})();
