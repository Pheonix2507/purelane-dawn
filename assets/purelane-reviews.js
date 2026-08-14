(() => {
  const start = (btn) => {
    const section = btn.closest('.pl-section');
    const rail = section && section.querySelector('[data-pl-rail]');
    if (!rail) return;

    const idle = btn.textContent.trim();
    const active = btn.dataset.plResumeLabel || 'Play reviews';

    btn.addEventListener('click', () => {
      const paused = rail.classList.toggle('is-paused');
      btn.setAttribute('aria-pressed', String(paused));
      btn.textContent = paused ? active : idle;
    });

    btn.dataset.plStarted = '1';
  };

  const boot = () => document.querySelectorAll('[data-pl-rail-pause]:not([data-pl-started])').forEach(start);

  boot();
  document.addEventListener('shopify:section:load', boot);
})();
