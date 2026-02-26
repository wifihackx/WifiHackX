import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadModule = async path => import(`${path}?t=${Date.now()}_${Math.random()}`);

describe('AppState and migration adapters', () => {
  beforeEach(() => {
    localStorage.clear();
    delete window.AppState;
    delete window.stateManager;
    vi.restoreAllMocks();
  });

  it('inicializa AppState con estado por defecto', async () => {
    await loadModule('../../src/js/core/app-state.js');

    expect(window.AppState).toBeTruthy();
    expect(window.AppState.getState('user.isAuthenticated')).toBe(false);
    expect(window.AppState.getState('view.current')).toBe('homeView');
  });

  it('setState/getState persiste y recupera valores anidados', async () => {
    await loadModule('../../src/js/core/app-state.js');

    window.AppState.setState('user.email', 'alice@example.com');
    window.AppState.setState('admin.stats.totalUsers', 5);

    expect(window.AppState.getState('user.email')).toBe('alice@example.com');
    expect(window.AppState.getState('admin.stats.totalUsers')).toBe(5);
    expect(localStorage.getItem('wifiHackX_state_v1')).toContain('alice@example.com');
  });

  it('subscribe notifica cambios y unsubscribe detiene notificaciones', async () => {
    await loadModule('../../src/js/core/app-state.js');

    const handler = vi.fn();
    const unsubscribe = window.AppState.subscribe('user.uid', handler);

    window.AppState.setState('user.uid', 'alice');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenLastCalledWith('alice', '');

    unsubscribe();
    window.AppState.setState('user.uid', 'bob');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('migration adapter expone stateManager como alias de AppState', async () => {
    await loadModule('../../src/js/core/app-state.js');
    await loadModule('../../src/js/core/migration-adapters.js');

    expect(window.stateManager).toBe(window.AppState);
  });
});
