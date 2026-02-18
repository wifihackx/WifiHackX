function initReturnToFooter() {
  if (typeof window !== 'undefined' && window.__RETURN_TO_FOOTER_INITED__) {
    return;
  }
  if (typeof window !== 'undefined') {
    window.__RETURN_TO_FOOTER_INITED__ = true;
  }

  try {
    document.querySelectorAll('[data-back-to-footer]').forEach(link => {
      link.addEventListener('click', () => {
        try {
          localStorage.setItem('returnToFooter', '1');
        } catch (_e) {}
      });
    });

    if (localStorage.getItem('returnToFooter') === '1') {
      localStorage.removeItem('returnToFooter');
      const tryScroll = attempt => {
        const footer = document.getElementById('mainFooter');
        if (footer) {
          footer.scrollIntoView({ behavior: 'auto', block: 'start' });
          window.scrollTo(0, footer.offsetTop);
        }
        if (attempt < 4) {
          setTimeout(() => tryScroll(attempt + 1), attempt === 0 ? 0 : 150 * attempt);
        }
      };
      document.addEventListener('DOMContentLoaded', () => tryScroll(0));
      window.addEventListener('load', () => tryScroll(1));
    }
  } catch (_e) {}
}

initReturnToFooter();

