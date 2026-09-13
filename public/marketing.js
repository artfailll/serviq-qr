(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nav = document.querySelector('.site-nav');
  const toggle = document.querySelector('[data-menu-toggle]');
  const mobileMenu = document.querySelector('[data-mobile-menu]');

  const setNavState = () => nav?.classList.toggle('is-scrolled', window.scrollY > 18);
  setNavState();
  window.addEventListener('scroll', setNavState, { passive: true });

  if (toggle && mobileMenu) {
    toggle.addEventListener('click', () => {
      const open = mobileMenu.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.innerHTML = open
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 6 12 12M18 6 6 18"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
    });
    mobileMenu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
      mobileMenu.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }));
  }

  const reveal = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !reduced) {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }), { threshold: 0.12, rootMargin: '0px 0px -34px' });
    reveal.forEach((element) => observer.observe(element));
  } else {
    reveal.forEach((element) => element.classList.add('is-visible'));
  }

  document.querySelectorAll('[data-tilt]').forEach((element) => {
    if (reduced || window.matchMedia('(pointer: coarse)').matches) return;
    element.addEventListener('pointermove', (event) => {
      const rect = element.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - .5;
      const y = (event.clientY - rect.top) / rect.height - .5;
      element.style.setProperty('--ry', `${x * 5}deg`);
      element.style.setProperty('--rx', `${-y * 5}deg`);
    });
    element.addEventListener('pointerleave', () => {
      element.style.setProperty('--ry', '0deg');
      element.style.setProperty('--rx', '0deg');
    });
  });

  const rotatingStatus = document.querySelector('[data-live-status]');
  if (rotatingStatus && !reduced) {
    const updates = [
      'Masa 12 · 3 ürün onaylandı',
      'Mutfak · Yeni adisyon hazır',
      'Kasa · Ödeme tamamlandı',
      'Stok · Kritik ürün yok'
    ];
    let index = 0;
    window.setInterval(() => {
      rotatingStatus.style.opacity = '0';
      window.setTimeout(() => {
        index = (index + 1) % updates.length;
        rotatingStatus.textContent = updates[index];
        rotatingStatus.style.opacity = '1';
      }, 180);
    }, 3100);
  }

  const form = document.querySelector('[data-contact-form]');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = form.querySelector('[name="name"]')?.value.trim() || 'Merhaba';
      const business = form.querySelector('[name="business"]')?.value.trim() || 'işletmem';
      const phone = form.querySelector('[name="phone"]')?.value.trim() || '-';
      const note = form.querySelector('[name="note"]')?.value.trim() || '-';
      const message = `Merhaba, ben ${name}. ${business} için Serviq demo ve kurulum bilgisi almak istiyorum. Telefon: ${phone}. Not: ${note}`;
      const target = `https://wa.me/905019406704?text=${encodeURIComponent(message)}`;
      const success = form.querySelector('.form-success');
      if (success) success.classList.add('is-visible');
      window.setTimeout(() => window.open(target, '_blank', 'noopener'), 450);
    });
  }
})();
