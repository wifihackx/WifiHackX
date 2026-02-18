export function initScannerModal() {
  const modal = document.getElementById('scannerModal');
  const openers = document.querySelectorAll('[data-action="openScannerModal"]');
  const closers = modal ? modal.querySelectorAll('[data-action="closeScannerModal"]') : [];
  const frame = document.getElementById('scannerFrame');

  if (!modal || openers.length === 0) return;

  const openModal = event => {
    if (event) event.preventDefault();
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    if (frame && !frame.getAttribute('src')) {
      const src = frame.getAttribute('data-src');
      if (src) frame.setAttribute('src', src);
    }

    const closeBtn = modal.querySelector('.scanner-modal__close');
    if (closeBtn) closeBtn.focus();
  };

  const closeModal = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  };

  openers.forEach(link => link.addEventListener('click', openModal));
  closers.forEach(btn => btn.addEventListener('click', closeModal));

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal.classList.contains('is-open')) {
      closeModal();
    }
  });
}
