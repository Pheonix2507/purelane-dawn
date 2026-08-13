(() => {
  const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const DEPTHS = [0.05, 0.09, 0.03, 0.02];

  const start = (scenes) => {
    const layers = [...scenes.querySelectorAll('[data-pl-scene]')];
    let zones = [];
    let wl = [];
    let raf = 0;
    let mx = 0;
    let my = 0;
    let depth = 1;

    const setDepth = (n) => {
      if (n === depth) return;
      depth = n;
      scenes.dataset.plDepth = String(n);
      layers.forEach((l) => l.classList.toggle('is-on', Number(l.dataset.plScene) === n));
    };

    /* A -50%/-50% root margin collapses the observer root to a line across the
       middle of the viewport, so a zone reports as intersecting only while it
       spans that line. Replaces the prototype's per-frame offsetTop walk, which
       also disagreed with its own rail sync about where a section starts. */
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          e.target.dataset.plCrossing = e.isIntersecting ? '1' : '';
        });
        const active = zones.filter((z) => z.dataset.plCrossing);
        if (active.length) setDepth(Number(active[active.length - 1].dataset.plZone) || 1);
      },
      { rootMargin: '-50% 0px -50% 0px' }
    );

    const rescan = () => {
      io.disconnect();
      zones = [...document.querySelectorAll('[data-pl-zone]')];
      zones.forEach((z) => io.observe(z));
    };

    const frame = () => {
      raf = 0;
      const y = scrollY;
      wl.forEach((el, i) => {
        const d = DEPTHS[i] ?? 0.05;
        el.style.setProperty('--pl-px', `${(mx * d * 130).toFixed(1)}px`);
        el.style.setProperty('--pl-py', `${(-y * d + my * d * 90).toFixed(1)}px`);
      });
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const bindParallax = () => {
      if (reduceQuery.matches || !wl.length) return;
      addEventListener('scroll', onScroll, { passive: true });
      addEventListener('resize', onScroll, { passive: true });
      if (matchMedia('(min-width: 1024px)').matches) {
        addEventListener(
          'pointermove',
          (e) => {
            if (e.pointerType !== 'mouse') return;
            mx = (e.clientX / innerWidth - 0.5) * 2;
            my = (e.clientY / innerHeight - 0.5) * 2;
            onScroll();
          },
          { passive: true }
        );
      }
      onScroll();
    };

    /* The water lives in a <template> until here. Template content is inert, so
       the two feTurbulence filters have cost nothing up to this point. Mounting
       after load keeps that rasterisation off the critical path. */
    const mountWater = () => {
      const tpl = scenes.querySelector('template[data-pl-water]');
      if (!tpl) return;
      const vig = scenes.querySelector('.pl-vig');
      scenes.insertBefore(tpl.content.cloneNode(true), vig);
      tpl.remove();
      wl = [...scenes.querySelectorAll('.pl-wl')];
      requestAnimationFrame(() => scenes.classList.add('is-ready'));
      bindParallax();
    };

    const deferMount = () => {
      if ('requestIdleCallback' in window) requestIdleCallback(mountWater, { timeout: 800 });
      else setTimeout(mountWater, 200);
    };

    rescan();
    if (document.readyState === 'complete') deferMount();
    else addEventListener('load', deferMount, { once: true });

    reduceQuery.addEventListener('change', () => {
      if (reduceQuery.matches) removeEventListener('scroll', onScroll);
      else bindParallax();
    });

    /* Sections can be added, removed and reordered under us in the theme editor,
       so the zone list is rebuilt rather than captured once. */
    ['shopify:section:load', 'shopify:section:unload', 'shopify:section:reorder'].forEach((evt) =>
      document.addEventListener(evt, rescan)
    );

    scenes.dataset.plStarted = '1';
  };

  const boot = () => {
    document.querySelectorAll('[data-pl-scenes]:not([data-pl-started])').forEach(start);
  };

  boot();
  document.addEventListener('shopify:section:load', boot);
})();
