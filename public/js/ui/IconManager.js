export function initIconManager() {
  const manager = {
    initializeIcons() {
      if (typeof window.lucide !== 'undefined' && window.lucide.createIcons) {
        window.lucide.createIcons();
      }
    },
  };

  window.IconManager = manager;
  manager.initializeIcons();
  return manager;
}
