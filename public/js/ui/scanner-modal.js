// Scanner modal initializer (safe no-op if modal markup is absent).

const OPEN_SELECTORS = ['[data-action="openScanner"]', '[data-action="openScannerModal"]'];

const CLOSE_SELECTORS = ['[data-action="closeScanner"]', '[data-action="closeScannerModal"]'];

const resolveModal = () =>
  document.getElementById('scannerModal') || document.getElementById('scanner-modal');

const setOpen = isOpen => {
  const modal = resolveModal();
  if (!modal) return;
  const frame = document.getElementById('scannerFrame');
  if (isOpen) {
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('is-open');
    if (frame instanceof HTMLIFrameElement && !frame.getAttribute('src')) {
      const deferredSrc = frame.dataset.src;
      if (deferredSrc) frame.setAttribute('src', deferredSrc);
    }
    if (typeof modal.showModal === 'function') {
      if (!modal.open) modal.showModal();
    } else {
      window.DOMUtils.setDisplay(modal, 'flex');
    }
  } else {
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('is-open');
    if (typeof modal.close === 'function' && modal.open) {
      modal.close();
    } else {
      window.DOMUtils.setDisplay(modal, 'none');
    }
  }
};

let isBound = false;

export function initScannerModal() {
  if (isBound) return;
  isBound = true;

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    if (OPEN_SELECTORS.some(selector => target.closest(selector))) {
      event.preventDefault();
      setOpen(true);
      return;
    }

    if (CLOSE_SELECTORS.some(selector => target.closest(selector))) {
      event.preventDefault();
      setOpen(false);
      return;
    }

    const modal = resolveModal();
    if (modal && target === modal) {
      setOpen(false);
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      setOpen(false);
    }
  });
}
