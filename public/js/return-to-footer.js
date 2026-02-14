(function () {
  document.querySelectorAll('[data-back-to-footer]').forEach(link => {
    link.addEventListener('click', () => {
      try {
        localStorage.setItem('returnToFooter', '1');
      } catch (_e) {}
    });
  });
})();
