/* @vitest-environment node */

import fs from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { beforeAll, beforeEach, afterAll, describe, it } from 'vitest';

const PROJECT_ID = 'demo-wifihackx-rules';
const RULES_PATH = 'firestore.rules';

let testEnv;

const authedDb = (uid, claims = {}) =>
  testEnv.authenticatedContext(uid, claims).firestore();
const anonDb = () => testEnv.unauthenticatedContext().firestore();

async function seedWithAdmin(seedFn) {
  await testEnv.withSecurityRulesDisabled(async context => {
    await seedFn(context.firestore());
  });
}

describe('Firestore Rules Matrix', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: fs.readFileSync(RULES_PATH, 'utf8'),
      },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it('allows public read on announcements', async () => {
    await seedWithAdmin(async db => {
      await setDoc(doc(db, 'announcements', 'ann-1'), {
        title: 'A',
        createdAt: serverTimestamp(),
      });
    });

    await assertSucceeds(getDoc(doc(anonDb(), 'announcements', 'ann-1')));
  });

  it('denies non-admin write on announcements', async () => {
    await assertFails(
      setDoc(doc(authedDb('user-1'), 'announcements', 'ann-x'), {
        title: 'Nope',
      })
    );
  });

  it('allows admin write on announcements', async () => {
    await assertSucceeds(
      setDoc(doc(authedDb('admin-1', { admin: true }), 'announcements', 'ann-a'), {
        title: 'OK',
      })
    );
  });

  it('allows user read own profile and denies reading others', async () => {
    await seedWithAdmin(async db => {
      await setDoc(doc(db, 'users', 'user-1'), {
        uid: 'user-1',
        email: 'u1@test.local',
        role: 'user',
        status: 'active',
      });
      await setDoc(doc(db, 'users', 'user-2'), {
        uid: 'user-2',
        email: 'u2@test.local',
        role: 'user',
        status: 'active',
      });
    });

    await assertSucceeds(getDoc(doc(authedDb('user-1'), 'users', 'user-1')));
    await assertFails(getDoc(doc(authedDb('user-1'), 'users', 'user-2')));
  });

  it('allows valid public analytics_visits create and denies invalid payload', async () => {
    const valid = {
      timestamp: serverTimestamp(),
      device: 'desktop',
      source: 'direct',
      path: '/',
      userAgent: 'ua',
      userType: 'anonymous',
      userId: null,
      isAdmin: false,
      sessionId: 'sess-1',
      siteHost: 'localhost',
      referrer: 'direct',
      viewport: { width: 1280, height: 720 },
      language: 'es-ES',
      eventType: 'pageview',
      engagementTimeMs: 0,
      pageViewIndex: 1,
      isBounce: true,
    };

    await assertSucceeds(setDoc(doc(anonDb(), 'analytics_visits', 'v1'), valid));

    await assertFails(
      setDoc(doc(anonDb(), 'analytics_visits', 'v2'), {
        ...valid,
        viewport: { width: 'bad', height: 720 },
      })
    );

    await assertFails(
      setDoc(doc(anonDb(), 'analytics_visits', 'v3'), {
        ...valid,
        engagementTimeMs: -10,
      })
    );
  });

  it('allows schema-valid security_logs create and denies oversized payload', async () => {
    await assertSucceeds(
      setDoc(doc(anonDb(), 'security_logs', 'log-1'), {
        timestamp: serverTimestamp(),
        type: 'download_guard',
        reason: 'cooldown_violation',
        userId: 'user-1',
      })
    );

    await assertFails(
      setDoc(doc(anonDb(), 'security_logs', 'log-2'), {
        timestamp: serverTimestamp(),
        type: 'download_guard',
        userAgent: 'x'.repeat(2000),
      })
    );
  });

  it('denies user read on security_logs and allows admin read', async () => {
    await seedWithAdmin(async db => {
      await setDoc(doc(db, 'security_logs', 'log-1'), {
        timestamp: serverTimestamp(),
        type: 'admin_claims_set',
      });
    });

    await assertFails(getDoc(doc(authedDb('user-1'), 'security_logs', 'log-1')));
    await assertSucceeds(
      getDoc(doc(authedDb('admin-1', { admin: true }), 'security_logs', 'log-1'))
    );
  });

  it('denies client create on root purchases', async () => {
    await assertFails(
      setDoc(doc(authedDb('user-1'), 'purchases', 'p-1'), {
        userId: 'user-1',
        amount: 20,
      })
    );
  });

  it('allows owner create in customers/{uid}/checkout_sessions and denies others', async () => {
    await assertSucceeds(
      setDoc(
        doc(authedDb('user-1'), 'customers', 'user-1', 'checkout_sessions', 's-1'),
        { price: 'price_123' }
      )
    );

    await assertFails(
      setDoc(
        doc(authedDb('user-2'), 'customers', 'user-1', 'checkout_sessions', 's-2'),
        { price: 'price_123' }
      )
    );
  });
});
