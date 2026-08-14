(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const INTERVAL = 3800;

  const start = (hero) => {
    const stage = hero.querySelector('[data-pl-stage]');
    const prod = hero.querySelector('[data-pl-prod]');
    const slides = stage ? [...stage.querySelectorAll('[data-pl-slide]')] : [];
    const dots = [...hero.querySelectorAll('[data-pl-dot]')];
    let i = 0;
    let timer = null;

    const show = (n) => {
      if (!slides.length) return;
      i = (n + slides.length) % slides.length;
      slides.forEach((s, x) => {
        const on = x === i;
        s.classList.toggle('is-on', on);
        /* inert takes the hidden slides out of the tab order and the
           accessibility tree together. Opacity alone left them reachable. */
        s.inert = !on;
      });
      dots.forEach((d, x) => {
        d.classList.toggle('is-on', x === i);
        d.setAttribute('aria-current', x === i ? 'true' : 'false');
      });
    };

    const play = () => {
      if (timer || reduce.matches || slides.length < 2) return;
      timer = setInterval(() => show(i + 1), INTERVAL);
    };

    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };

    dots.forEach((d, x) =>
      d.addEventListener('click', () => {
        stop();
        show(x);
        play();
      })
    );

    if (stage) {
      stage.addEventListener('mouseenter', stop);
      stage.addEventListener('mouseleave', play);
      /* Keyboard users get the same pause a mouse user gets on hover. */
      stage.addEventListener('focusin', stop);
      stage.addEventListener('focusout', (e) => {
        if (!stage.contains(e.relatedTarget)) play();
      });

      new IntersectionObserver(
        (entries) => entries.forEach((e) => (e.isIntersecting ? play() : stop())),
        { threshold: 0.2 }
      ).observe(stage);
    }

    /* hero product parallax */
    let raf = 0;
    const frame = () => {
      raf = 0;
      const f = Math.min(scrollY / 700, 1);
      prod.style.transform = `translate3d(0, ${(-f * 54).toFixed(1)}px, 0) scale(${(1 - f * 0.06).toFixed(3)})`;
      prod.style.opacity = (1 - f * 0.55).toFixed(3);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    if (prod && !reduce.matches) {
      addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    reduce.addEventListener('change', () => {
      if (reduce.matches) {
        stop();
        removeEventListener('scroll', onScroll);
        if (prod) prod.style.cssText = '';
      } else {
        play();
      }
    });

    show(0);
    hero.dataset.plStarted = '1';
  };

  const boot = () => document.querySelectorAll('[data-pl-hero]:not([data-pl-started])').forEach(start);

  boot();
  document.addEventListener('shopify:section:load', boot);
})();
