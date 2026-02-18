import { beforeEach, afterEach, vi } from 'vitest';

beforeEach(() => {
  if (typeof document !== 'undefined' && document.body) {
    document.body.innerHTML = '';
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.clear();
  }
  vi.restoreAllMocks();
});

afterEach(() => {
  if (typeof document !== 'undefined' && document.body) {
    document.body.innerHTML = '';
  }
});
