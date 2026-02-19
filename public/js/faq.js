(function () {
  // FAQ Specific Category Logic
  document.querySelectorAll('.category-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      const category = tag.dataset.category;
      document
        .querySelectorAll('.category-tag')
        .forEach(t => t.classList.remove('active'));
      tag.classList.add('active');

      document.querySelectorAll('.faq-item').forEach(item => {
        if (category === 'all' || item.dataset.category === category) {
          item.classList.remove('is-hidden');
        } else {
          item.classList.add('is-hidden');
        }
      });
    });
  });

  // FAQ Accordion Logic
  document.querySelectorAll('.faq-question').forEach(q => {
    q.addEventListener('click', () => {
      const item = q.parentElement;
      const isActive = item.classList.contains('active');
      document
        .querySelectorAll('.faq-item')
        .forEach(i => i.classList.remove('active'));
      if (!isActive) item.classList.add('active');
    });
  });
})();
