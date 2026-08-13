/* Reveal-on-scroll for .pl-rv. The hiding lives behind
   @media (scripting: enabled) in purelane-base.css, so content stays visible if
   this never runs. */
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const io = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        obs.unobserve(e.target);
      });
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.12 }
  );

  const scan = (scope) => {
    (scope || document).querySelectorAll('.pl-rv:not(.is-in)').forEach((el) => io.observe(el));
  };

  scan();

  /* A section re-rendered by the theme editor arrives with fresh, unobserved
     nodes. Without this its content would stay hidden. */
  document.addEventListener('shopify:section:load', (e) => scan(e.target));
})();
