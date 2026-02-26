// Minimal icon manager bridge for legacy modules.
// Keeps the same global contract expected by components bootstrap.

function createIconsSafe(root) {
  try {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ attrs: {}, root });
      return true;
    }
  } catch (_error) {}
  return false;
}

const IconManager = {
  initializeIcons(root = document) {
    return createIconsSafe(root);
  },

  refresh(root = document) {
    return createIconsSafe(root);
  },
};

export function initIconManager() {
  if (!window.IconManager) {
    window.IconManager = IconManager;
  }
  IconManager.initializeIcons();
}
