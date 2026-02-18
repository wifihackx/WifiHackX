'use strict';

function setupMobileHeaderMenu() {
  const header = document.querySelector('.main-header');
  const toggle = document.getElementById('mobileMenuToggle');
  const panel = document.getElementById('headerActionsPanel');
  const overlay = document.getElementById('mobileMenuOverlay');

  if (!header || !toggle || !panel || !overlay) {
    return;
  }

  if (toggle.dataset.mobileMenuBound === 'true') {
    return;
  }

  const mq = window.matchMedia('(max-width: 768px)');
  panel.setAttribute('aria-hidden', mq.matches ? 'true' : 'false');

  const setOpen = isOpen => {
    if (!mq.matches && isOpen) {
      return;
    }
    header.classList.toggle('mobile-menu-open', isOpen);
    document.body.classList.toggle('mobile-menu-open-body', isOpen);
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    panel.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    overlay.hidden = !isOpen;
  };

  const closeMenu = () => setOpen(false);
  const openMenu = () => setOpen(true);

  toggle.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  overlay.addEventListener('click', closeMenu);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeMenu();
    }
  });

  document.addEventListener('click', event => {
    if (toggle.getAttribute('aria-expanded') !== 'true') {
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
      return;
    }

    if (!header.contains(target)) {
      closeMenu();
      return;
    }

    const clickedAction = target.closest('[data-action]');
    const clickedLanguageToggle = target.closest('.language-toggle');
    if (clickedAction && !clickedLanguageToggle) {
      closeMenu();
    }
  });

  const onResize = () => {
    if (!mq.matches) {
      closeMenu();
      panel.setAttribute('aria-hidden', 'false');
    } else if (toggle.getAttribute('aria-expanded') !== 'true') {
      panel.setAttribute('aria-hidden', 'true');
    }
  };

  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', onResize);
  } else if (typeof mq.addListener === 'function') {
    mq.addListener(onResize);
  }

  toggle.dataset.mobileMenuBound = 'true';
}

export function initMobileHeaderMenu() {
  setupMobileHeaderMenu();
}
