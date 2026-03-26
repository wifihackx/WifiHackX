// Shared Vitest setup.

import { vi } from 'vitest';

if (typeof window !== 'undefined') {
  window.scrollTo = vi.fn();
}
