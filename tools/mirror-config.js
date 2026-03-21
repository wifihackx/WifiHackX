export const MIRROR_SOURCE_OF_TRUTH = 'src';

export const MIRROR_MANAGED_ROOTS = [
  {
    id: 'js',
    sourceDir: 'src/js',
    publicDir: 'public/js',
    publicOnly: ['local-dev-config.js'],
  },
  {
    id: 'css',
    sourceDir: 'src/css',
    publicDir: 'public/css',
    publicOnly: [],
  },
];

export const MIRROR_BATCHES = [
  {
    id: 'announcement-foundation',
    label: 'Announcement foundation',
    status: 'active',
    files: [
      'announcement-admin-init.js',
      'announcement-form-handler.js',
      'announcement-public-modal.js',
      'announcement-system.js',
      'announcement-utils.js',
      'cart-manager.js',
      'post-checkout-handler.js',
      'ultimate-download-manager.js',
    ],
  },
];

export function toPosixPath(value) {
  return String(value || '').replace(/\\/g, '/');
}

export function getManagedRootById(id) {
  return MIRROR_MANAGED_ROOTS.find(root => root.id === id) || null;
}
