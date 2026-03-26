import { describe, expect, it } from 'vitest';

describe('workspace smoke', () => {
  it('has runtime config checked into the repo', async () => {
    const mod = await import('../../public/config/runtime-config.json', {
      with: { type: 'json' },
    });

    expect(mod.default).toHaveProperty('payments');
    expect(mod.default).toHaveProperty('firebase.projectId');
  });
});
