import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { beforeAll, beforeEach, afterAll, describe, it } from 'vitest';
import {
  Timestamp,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  setLogLevel,
  updateDoc,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-wifihackx-rules';
const RULES_PATH = resolve(process.cwd(), 'firestore.rules');

describe('Firestore security rules', () => {
  /** @type {import('@firebase/rules-unit-testing').RulesTestEnvironment} */
  let testEnv;

  beforeAll(async () => {
    // Denied writes are expected in assertFails tests; keep CI output clean.
    setLogLevel('silent');

    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: readFileSync(RULES_PATH, 'utf8'),
      },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it('permite crear el propio usuario con payload valido', async () => {
    const aliceDb = testEnv.authenticatedContext('alice').firestore();

    await assertSucceeds(
      setDoc(doc(aliceDb, 'users/alice'), {
        email: 'alice@example.com',
        uid: 'alice',
        role: 'user',
        status: 'active',
      })
    );
  });

  it('deniega crear usuario con role=admin durante registro', async () => {
    const aliceDb = testEnv.authenticatedContext('alice').firestore();

    await assertFails(
      setDoc(doc(aliceDb, 'users/alice'), {
        email: 'alice@example.com',
        uid: 'alice',
        role: 'admin',
        status: 'active',
      })
    );
  });

  it('permite leer announcements en modo anonimo', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'announcements/a1'), {
        title: 'Public notice',
        body: 'Visible for everyone',
      });
    });

    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(anonDb, 'announcements/a1')));
  });

  it('deniega crear orders desde cliente autenticado', async () => {
    const aliceDb = testEnv.authenticatedContext('alice').firestore();

    await assertFails(
      setDoc(doc(aliceDb, 'orders/order-1'), {
        userId: 'alice',
        amount: 15,
        status: 'paid',
      })
    );
  });

  it('permite crear purchases propias con schema y status validos', async () => {
    const aliceDb = testEnv.authenticatedContext('alice').firestore();

    await assertSucceeds(
      setDoc(doc(aliceDb, 'users/alice/purchases/p1'), {
        userId: 'alice',
        productId: 'prod-123',
        status: 'paid',
        amount: 9.99,
        purchasedAt: Timestamp.now(),
      })
    );
  });

  it('deniega purchases propias con status invalido', async () => {
    const aliceDb = testEnv.authenticatedContext('alice').firestore();

    await assertFails(
      setDoc(doc(aliceDb, 'users/alice/purchases/p1'), {
        userId: 'alice',
        productId: 'prod-123',
        status: 'pending',
      })
    );
  });

  it('deniega crear processedEvents desde cliente aunque el payload sea valido', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();

    await assertFails(
      setDoc(doc(anonDb, 'processedEvents/evt_1'), {
        eventId: 'evt_1',
        type: 'checkout.session.completed',
        processedAt: Timestamp.now(),
      })
    );
  });

  it('deniega crear processedEvents con payload vacio', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();

    await assertFails(setDoc(doc(anonDb, 'processedEvents/evt_2'), {}));
  });

  it('deniega crear security_logs desde cliente aunque la estructura sea valida', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();

    await assertFails(
      setDoc(doc(anonDb, 'security_logs/log_ok'), {
        createdAt: Timestamp.now(),
        type: 'risk.signal',
        source: 'client',
        reason: 'suspicious-pattern',
      })
    );
  });

  it('deniega crear security_logs sin timestamp ni createdAt', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();

    await assertFails(
      setDoc(doc(anonDb, 'security_logs/log_bad'), {
        type: 'risk.signal',
      })
    );
  });

  it('permite lectura anonima de publicSettings', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'publicSettings/main'), {
        general: { siteName: 'WiFiHackX' },
      });
    });

    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(anonDb, 'publicSettings/main')));
  });

  it('deniega create de publicSettings para no-admin', async () => {
    const aliceDb = testEnv.authenticatedContext('alice').firestore();

    await assertFails(
      setDoc(doc(aliceDb, 'publicSettings/main'), {
        general: { siteName: 'WiFiHackX' },
      })
    );
  });

  it('permite create de publicSettings para admin', async () => {
    const adminDb = testEnv.authenticatedContext('root', { admin: true }).firestore();

    await assertSucceeds(
      setDoc(doc(adminDb, 'publicSettings/main'), {
        general: { siteName: 'WiFiHackX' },
      })
    );
  });

  it('permite crear analytics_visits con payload valido', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();

    await assertSucceeds(
      setDoc(doc(anonDb, 'analytics_visits/v1'), {
        timestamp: Timestamp.now(),
        device: 'desktop',
        source: 'organic',
        path: '/home',
        userAgent: 'Mozilla/5.0',
        userType: 'guest',
        sessionId: 'sess-1',
        referrer: 'https://example.com',
        viewport: {
          width: 1440,
          height: 900,
        },
        language: 'es-ES',
        isAdmin: false,
      })
    );
  });

  it('deniega analytics_visits con path mayor al limite', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();

    await assertFails(
      setDoc(doc(anonDb, 'analytics_visits/v2'), {
        timestamp: Timestamp.now(),
        device: 'desktop',
        source: 'organic',
        path: 'x'.repeat(301),
        userAgent: 'Mozilla/5.0',
        userType: 'guest',
        sessionId: 'sess-2',
        referrer: 'https://example.com',
        viewport: {
          width: 1440,
          height: 900,
        },
        language: 'es-ES',
        isAdmin: false,
      })
    );
  });

  it('deniega analytics_visits con viewport invalido', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();

    await assertFails(
      setDoc(doc(anonDb, 'analytics_visits/v3'), {
        timestamp: Timestamp.now(),
        device: 'desktop',
        source: 'organic',
        path: '/about',
        userAgent: 'Mozilla/5.0',
        userType: 'guest',
        sessionId: 'sess-3',
        referrer: 'https://example.com',
        viewport: {
          width: '1440',
          height: 900,
        },
        language: 'es-ES',
        isAdmin: false,
      })
    );
  });

  it('deniega security_logs con details map demasiado grande', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    const oversizedDetails = Object.fromEntries(
      Array.from({ length: 26 }, (_, idx) => [`k${idx}`, `v${idx}`])
    );

    await assertFails(
      setDoc(doc(anonDb, 'security_logs/log_oversized'), {
        createdAt: Timestamp.now(),
        type: 'risk.signal',
        details: oversizedDetails,
      })
    );
  });

  it('deniega security_logs con userEmail fuera de limite', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    const longEmail = `${'a'.repeat(321)}@example.com`;

    await assertFails(
      setDoc(doc(anonDb, 'security_logs/log_email_too_long'), {
        createdAt: Timestamp.now(),
        type: 'risk.signal',
        userEmail: longEmail,
      })
    );
  });

  it('permite al propietario actualizar campos no restringidos en users', async () => {
    const aliceDb = testEnv.authenticatedContext('alice').firestore();

    await assertSucceeds(
      setDoc(doc(aliceDb, 'users/alice'), {
        email: 'alice@example.com',
        uid: 'alice',
        role: 'user',
        status: 'active',
        displayName: 'Alice',
      })
    );

    await assertSucceeds(
      updateDoc(doc(aliceDb, 'users/alice'), {
        displayName: 'Alice Updated',
      })
    );
  });

  it('deniega al propietario actualizar role en users', async () => {
    const aliceDb = testEnv.authenticatedContext('alice').firestore();

    await assertSucceeds(
      setDoc(doc(aliceDb, 'users/alice'), {
        email: 'alice@example.com',
        uid: 'alice',
        role: 'user',
        status: 'active',
      })
    );

    await assertFails(
      updateDoc(doc(aliceDb, 'users/alice'), {
        role: 'admin',
      })
    );
  });

  it('deniega al propietario actualizar status en users', async () => {
    const aliceDb = testEnv.authenticatedContext('alice').firestore();

    await assertSucceeds(
      setDoc(doc(aliceDb, 'users/alice'), {
        email: 'alice@example.com',
        uid: 'alice',
        role: 'user',
        status: 'active',
      })
    );

    await assertFails(
      updateDoc(doc(aliceDb, 'users/alice'), {
        status: 'banned',
      })
    );
  });

  it('permite a admin actualizar role/status de un usuario', async () => {
    const adminDb = testEnv.authenticatedContext('root', { admin: true }).firestore();

    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'users/alice'), {
        email: 'alice@example.com',
        uid: 'alice',
        role: 'user',
        status: 'active',
      });
    });

    await assertSucceeds(
      updateDoc(doc(adminDb, 'users/alice'), {
        role: 'admin',
        status: 'active',
      })
    );
  });

  it('deniega lectura de user a otro usuario autenticado', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'users/alice'), {
        email: 'alice@example.com',
        uid: 'alice',
        role: 'user',
        status: 'active',
      });
    });

    const bobDb = testEnv.authenticatedContext('bob').firestore();
    await assertFails(getDoc(doc(bobDb, 'users/alice')));
  });

  it('permite list de users solo para admin', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'users/alice'), {
        email: 'alice@example.com',
        uid: 'alice',
        role: 'user',
        status: 'active',
      });
      await setDoc(doc(context.firestore(), 'users/bob'), {
        email: 'bob@example.com',
        uid: 'bob',
        role: 'user',
        status: 'active',
      });
    });

    const adminDb = testEnv.authenticatedContext('root', { admin: true }).firestore();
    const userDb = testEnv.authenticatedContext('alice').firestore();

    await assertSucceeds(getDocs(collection(adminDb, 'users')));
    await assertFails(getDocs(collection(userDb, 'users')));
  });

  it('permite lectura de orders al propietario y al admin', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'orders/o1'), {
        userId: 'alice',
        amount: 10,
        status: 'paid',
      });
    });

    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const adminDb = testEnv.authenticatedContext('root', { admin: true }).firestore();

    await assertSucceeds(getDoc(doc(aliceDb, 'orders/o1')));
    await assertSucceeds(getDoc(doc(adminDb, 'orders/o1')));
  });

  it('deniega lectura de orders a anonimo y usuario no propietario', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'orders/o2'), {
        userId: 'alice',
        amount: 10,
        status: 'paid',
      });
    });

    const anonDb = testEnv.unauthenticatedContext().firestore();
    const bobDb = testEnv.authenticatedContext('bob').firestore();

    await assertFails(getDoc(doc(anonDb, 'orders/o2')));
    await assertFails(getDoc(doc(bobDb, 'orders/o2')));
  });

  it('deniega create de purchases root para cliente', async () => {
    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(aliceDb, 'purchases/p-root-create'), {
        userId: 'alice',
        productId: 'prod-1',
        status: 'paid',
      })
    );
  });

  it('permite lectura de purchases root a propietario y admin; deniega a otros', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'purchases/p-root-read'), {
        userId: 'alice',
        productId: 'prod-1',
        status: 'paid',
      });
    });

    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const bobDb = testEnv.authenticatedContext('bob').firestore();
    const adminDb = testEnv.authenticatedContext('root', { admin: true }).firestore();
    const anonDb = testEnv.unauthenticatedContext().firestore();

    await assertSucceeds(getDoc(doc(aliceDb, 'purchases/p-root-read')));
    await assertSucceeds(getDoc(doc(adminDb, 'purchases/p-root-read')));
    await assertFails(getDoc(doc(bobDb, 'purchases/p-root-read')));
    await assertFails(getDoc(doc(anonDb, 'purchases/p-root-read')));
  });

  it('permite update/delete de purchases root solo a admin', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'purchases/p-root-admin'), {
        userId: 'alice',
        productId: 'prod-1',
        status: 'paid',
      });
    });

    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const adminDb = testEnv.authenticatedContext('root', { admin: true }).firestore();

    await assertFails(updateDoc(doc(aliceDb, 'purchases/p-root-admin'), { status: 'refunded' }));
    await assertSucceeds(updateDoc(doc(adminDb, 'purchases/p-root-admin'), { status: 'refunded' }));
    await assertFails(deleteDoc(doc(aliceDb, 'purchases/p-root-admin')));
    await assertSucceeds(deleteDoc(doc(adminDb, 'purchases/p-root-admin')));
  });

  it('permite collection group purchases solo para admin', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'users/alice/purchases/p-cg-1'), {
        userId: 'alice',
        productId: 'prod-1',
        status: 'paid',
      });
      await setDoc(doc(context.firestore(), 'users/bob/purchases/p-cg-2'), {
        userId: 'bob',
        productId: 'prod-2',
        status: 'paid',
      });
    });

    const adminDb = testEnv.authenticatedContext('root', { admin: true }).firestore();
    const aliceDb = testEnv.authenticatedContext('alice').firestore();

    await assertSucceeds(getDocs(collectionGroup(adminDb, 'purchases')));
    await assertFails(getDocs(collectionGroup(aliceDb, 'purchases')));
  });

  it('permite leer y eliminar customers doc al owner; deniega a no owner', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'customers/alice'), {
        stripeCustomerId: 'cus_1',
      });
    });

    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const bobDb = testEnv.authenticatedContext('bob').firestore();

    await assertSucceeds(getDoc(doc(aliceDb, 'customers/alice')));
    await assertFails(getDoc(doc(bobDb, 'customers/alice')));
    await assertSucceeds(deleteDoc(doc(aliceDb, 'customers/alice')));
  });

  it('permite eliminar customers doc al admin', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'customers/alice'), {
        stripeCustomerId: 'cus_2',
      });
    });

    const adminDb = testEnv.authenticatedContext('root', { admin: true }).firestore();
    await assertSucceeds(deleteDoc(doc(adminDb, 'customers/alice')));
  });

  it('checkout_sessions: owner puede create/read, update/delete denegado', async () => {
    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const bobDb = testEnv.authenticatedContext('bob').firestore();

    await assertSucceeds(
      setDoc(doc(aliceDb, 'customers/alice/checkout_sessions/s1'), {
        mode: 'payment',
        priceId: 'price_1',
      })
    );
    await assertSucceeds(getDoc(doc(aliceDb, 'customers/alice/checkout_sessions/s1')));
    await assertFails(getDoc(doc(bobDb, 'customers/alice/checkout_sessions/s1')));
    await assertFails(
      updateDoc(doc(aliceDb, 'customers/alice/checkout_sessions/s1'), {
        mode: 'subscription',
      })
    );
    await assertFails(deleteDoc(doc(aliceDb, 'customers/alice/checkout_sessions/s1')));
  });

  it('payments/subscriptions: solo read owner/admin, write denegado para todos', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'customers/alice/payments/pay1'), {
        amount: 10,
      });
      await setDoc(doc(context.firestore(), 'customers/alice/subscriptions/sub1'), {
        status: 'active',
      });
    });

    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const bobDb = testEnv.authenticatedContext('bob').firestore();
    const adminDb = testEnv.authenticatedContext('root', { admin: true }).firestore();

    await assertSucceeds(getDoc(doc(aliceDb, 'customers/alice/payments/pay1')));
    await assertSucceeds(getDoc(doc(adminDb, 'customers/alice/payments/pay1')));
    await assertFails(getDoc(doc(bobDb, 'customers/alice/payments/pay1')));

    await assertSucceeds(getDoc(doc(aliceDb, 'customers/alice/subscriptions/sub1')));
    await assertSucceeds(getDoc(doc(adminDb, 'customers/alice/subscriptions/sub1')));
    await assertFails(getDoc(doc(bobDb, 'customers/alice/subscriptions/sub1')));

    await assertFails(setDoc(doc(aliceDb, 'customers/alice/payments/pay2'), { amount: 20 }));
    await assertFails(setDoc(doc(adminDb, 'customers/alice/payments/pay3'), { amount: 30 }));
    await assertFails(
      setDoc(doc(aliceDb, 'customers/alice/subscriptions/sub2'), {
        status: 'active',
      })
    );
    await assertFails(
      setDoc(doc(adminDb, 'customers/alice/subscriptions/sub3'), {
        status: 'active',
      })
    );
  });

  it('deniega al propietario actualizar campos de baneo en users', async () => {
    const aliceDb = testEnv.authenticatedContext('alice').firestore();

    await assertSucceeds(
      setDoc(doc(aliceDb, 'users/alice'), {
        email: 'alice@example.com',
        uid: 'alice',
        role: 'user',
        status: 'active',
      })
    );

    await assertFails(
      updateDoc(doc(aliceDb, 'users/alice'), {
        banned: true,
      })
    );
    await assertFails(
      updateDoc(doc(aliceDb, 'users/alice'), {
        banReason: 'abuse',
      })
    );
    await assertFails(
      updateDoc(doc(aliceDb, 'users/alice'), {
        bannedBy: 'root',
      })
    );
  });

  it('deniega al propietario actualizar el resto de campos de baneo en users', async () => {
    const aliceDb = testEnv.authenticatedContext('alice').firestore();

    await assertSucceeds(
      setDoc(doc(aliceDb, 'users/alice'), {
        email: 'alice@example.com',
        uid: 'alice',
        role: 'user',
        status: 'active',
      })
    );

    await assertFails(
      updateDoc(doc(aliceDb, 'users/alice'), {
        banReasonCode: 'abuse_code',
      })
    );
    await assertFails(
      updateDoc(doc(aliceDb, 'users/alice'), {
        banDetails: 'details',
      })
    );
    await assertFails(
      updateDoc(doc(aliceDb, 'users/alice'), {
        banType: 'temporary',
      })
    );
    await assertFails(
      updateDoc(doc(aliceDb, 'users/alice'), {
        banExpires: Timestamp.now(),
      })
    );
    await assertFails(
      updateDoc(doc(aliceDb, 'users/alice'), {
        bannedAt: Timestamp.now(),
      })
    );
    await assertFails(
      updateDoc(doc(aliceDb, 'users/alice'), {
        bannedByEmail: 'root@example.com',
      })
    );
  });

  it('orders list query: solo admin', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'orders/o-list'), {
        userId: 'alice',
        amount: 12,
        status: 'paid',
      });
    });

    const adminDb = testEnv.authenticatedContext('root', { admin: true }).firestore();
    const aliceDb = testEnv.authenticatedContext('alice').firestore();

    await assertSucceeds(getDocs(collection(adminDb, 'orders')));
    await assertFails(getDocs(collection(aliceDb, 'orders')));
  });

  it('activities list query: solo admin', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'activities/a1'), {
        createdAt: Timestamp.now(),
        type: 'info',
      });
    });

    const adminDb = testEnv.authenticatedContext('root', { admin: true }).firestore();
    const aliceDb = testEnv.authenticatedContext('alice').firestore();

    await assertSucceeds(getDocs(collection(adminDb, 'activities')));
    await assertFails(getDocs(collection(aliceDb, 'activities')));
  });

  it('processedEvents list query: solo admin', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'processedEvents/evt_list_1'), {
        eventId: 'evt_list_1',
        processedAt: Timestamp.now(),
      });
    });

    const adminDb = testEnv.authenticatedContext('root', { admin: true }).firestore();
    const aliceDb = testEnv.authenticatedContext('alice').firestore();

    await assertSucceeds(getDocs(collection(adminDb, 'processedEvents')));
    await assertFails(getDocs(collection(aliceDb, 'processedEvents')));
  });

  it('security_logs list query: solo admin', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'security_logs/s-list-1'), {
        createdAt: Timestamp.now(),
        type: 'risk.signal',
      });
    });

    const adminDb = testEnv.authenticatedContext('root', { admin: true }).firestore();
    const aliceDb = testEnv.authenticatedContext('alice').firestore();

    await assertSucceeds(getDocs(collection(adminDb, 'security_logs')));
    await assertFails(getDocs(collection(aliceDb, 'security_logs')));
  });

  it('alerts list query: solo admin', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'alerts/al-1'), {
        message: 'x',
      });
    });

    const adminDb = testEnv.authenticatedContext('root', { admin: true }).firestore();
    const aliceDb = testEnv.authenticatedContext('alice').firestore();

    await assertSucceeds(getDocs(collection(adminDb, 'alerts')));
    await assertFails(getDocs(collection(aliceDb, 'alerts')));
  });

  it('fallback matcher deniega acceso a colecciones no declaradas', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    const aliceDb = testEnv.authenticatedContext('alice').firestore();

    await assertFails(getDoc(doc(anonDb, 'unknown_collection/x1')));
    await assertFails(setDoc(doc(aliceDb, 'unknown_collection/x1'), { value: 1 }));
  });

  it('deniega processedEvents con mas de 16 keys', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    const payload = {
      eventId: 'evt_overflow',
      k1: 1,
      k2: 2,
      k3: 3,
      k4: 4,
      k5: 5,
      k6: 6,
      k7: 7,
      k8: 8,
      k9: 9,
      k10: 10,
      k11: 11,
      k12: 12,
      k13: 13,
      k14: 14,
      k15: 15,
      k16: 16,
    };

    await assertFails(setDoc(doc(anonDb, 'processedEvents/evt_overflow'), payload));
  });

  it('deniega security_logs con mas de 20 keys', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    const payload = {
      createdAt: Timestamp.now(),
      k1: 1,
      k2: 2,
      k3: 3,
      k4: 4,
      k5: 5,
      k6: 6,
      k7: 7,
      k8: 8,
      k9: 9,
      k10: 10,
      k11: 11,
      k12: 12,
      k13: 13,
      k14: 14,
      k15: 15,
      k16: 16,
      k17: 17,
      k18: 18,
      k19: 19,
      k20: 20,
    };

    await assertFails(setDoc(doc(anonDb, 'security_logs/log_overflow'), payload));
  });

  it('permite analytics_visits con path exactamente en limite (300)', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();

    await assertSucceeds(
      setDoc(doc(anonDb, 'analytics_visits/v4'), {
        timestamp: Timestamp.now(),
        device: 'desktop',
        source: 'organic',
        path: 'x'.repeat(300),
        userAgent: 'Mozilla/5.0',
        userType: 'guest',
        sessionId: 'sess-4',
        referrer: 'https://example.com',
        viewport: {
          width: 1440,
          height: 900,
        },
        language: 'es-ES',
        isAdmin: false,
      })
    );
  });

  it('deniega security_logs desde cliente aunque userEmail este en limite (320)', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    const local = 'a'.repeat(308);
    const email320 = `${local}@x.com`;

    await assertFails(
      setDoc(doc(anonDb, 'security_logs/log_email_320'), {
        createdAt: Timestamp.now(),
        type: 'risk.signal',
        userEmail: email320,
      })
    );
  });

  it('deniega security_logs con reason de 201 caracteres', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();

    await assertFails(
      setDoc(doc(anonDb, 'security_logs/log_reason_201'), {
        createdAt: Timestamp.now(),
        type: 'risk.signal',
        reason: 'r'.repeat(201),
      })
    );
  });

  it('admin puede get en colecciones raiz restringidas; no-admin no-propietario denegado', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'orders/o-get'), {
        userId: 'alice',
        amount: 11,
        status: 'paid',
      });
      await setDoc(doc(context.firestore(), 'activities/a-get'), {
        createdAt: Timestamp.now(),
        type: 'info',
      });
      await setDoc(doc(context.firestore(), 'processedEvents/evt-get'), {
        eventId: 'evt-get',
        processedAt: Timestamp.now(),
      });
      await setDoc(doc(context.firestore(), 'security_logs/s-get'), {
        createdAt: Timestamp.now(),
        type: 'risk.signal',
      });
      await setDoc(doc(context.firestore(), 'alerts/al-get'), {
        message: 'hello',
      });
    });

    const adminDb = testEnv.authenticatedContext('root', { admin: true }).firestore();
    const userDb = testEnv.authenticatedContext('bob').firestore();

    await assertSucceeds(getDoc(doc(adminDb, 'orders/o-get')));
    await assertSucceeds(getDoc(doc(adminDb, 'activities/a-get')));
    await assertSucceeds(getDoc(doc(adminDb, 'processedEvents/evt-get')));
    await assertSucceeds(getDoc(doc(adminDb, 'security_logs/s-get')));
    await assertSucceeds(getDoc(doc(adminDb, 'alerts/al-get')));

    await assertFails(getDoc(doc(userDb, 'orders/o-get')));
    await assertFails(getDoc(doc(userDb, 'activities/a-get')));
    await assertFails(getDoc(doc(userDb, 'processedEvents/evt-get')));
    await assertFails(getDoc(doc(userDb, 'security_logs/s-get')));
    await assertFails(getDoc(doc(userDb, 'alerts/al-get')));
  });

  it('permite analytics_visits con source/userAgent/sessionId en limites exactos', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();

    await assertSucceeds(
      setDoc(doc(anonDb, 'analytics_visits/v5'), {
        timestamp: Timestamp.now(),
        device: 'desktop',
        source: 's'.repeat(120),
        path: '/limits',
        userAgent: 'u'.repeat(1024),
        userType: 'guest',
        sessionId: 'x'.repeat(120),
        referrer: 'https://example.com',
        viewport: {
          width: 1920,
          height: 1080,
        },
        language: 'es-ES',
        isAdmin: false,
      })
    );
  });

  it('deniega analytics_visits cuando source/userAgent/sessionId exceden limite', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();

    await assertFails(
      setDoc(doc(anonDb, 'analytics_visits/v6'), {
        timestamp: Timestamp.now(),
        device: 'desktop',
        source: 's'.repeat(121),
        path: '/limits',
        userAgent: 'Mozilla/5.0',
        userType: 'guest',
        sessionId: 'sess-ok',
        referrer: 'https://example.com',
        viewport: {
          width: 1920,
          height: 1080,
        },
        language: 'es-ES',
        isAdmin: false,
      })
    );

    await assertFails(
      setDoc(doc(anonDb, 'analytics_visits/v7'), {
        timestamp: Timestamp.now(),
        device: 'desktop',
        source: 'organic',
        path: '/limits',
        userAgent: 'u'.repeat(1025),
        userType: 'guest',
        sessionId: 'sess-ok',
        referrer: 'https://example.com',
        viewport: {
          width: 1920,
          height: 1080,
        },
        language: 'es-ES',
        isAdmin: false,
      })
    );

    await assertFails(
      setDoc(doc(anonDb, 'analytics_visits/v8'), {
        timestamp: Timestamp.now(),
        device: 'desktop',
        source: 'organic',
        path: '/limits',
        userAgent: 'Mozilla/5.0',
        userType: 'guest',
        sessionId: 'x'.repeat(121),
        referrer: 'https://example.com',
        viewport: {
          width: 1920,
          height: 1080,
        },
        language: 'es-ES',
        isAdmin: false,
      })
    );
  });

  it('permite users/{uid}/purchases con opcionales en limites exactos', async () => {
    const aliceDb = testEnv.authenticatedContext('alice').firestore();

    await assertSucceeds(
      setDoc(doc(aliceDb, 'users/alice/purchases/p-boundary-ok'), {
        userId: 'alice',
        productId: 'prod-boundary',
        status: 'completed',
        currency: 'X'.repeat(8),
        paymentMethod: 'm'.repeat(32),
        provider: 'p'.repeat(32),
        sessionId: 's'.repeat(255),
        paypalOrderId: 'o'.repeat(255),
        amount: 19999.99,
        purchasedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
    );
  });

  it('deniega users/{uid}/purchases cuando opcionales exceden limite', async () => {
    const aliceDb = testEnv.authenticatedContext('alice').firestore();

    await assertFails(
      setDoc(doc(aliceDb, 'users/alice/purchases/p-boundary-currency'), {
        userId: 'alice',
        productId: 'prod-boundary',
        status: 'completed',
        currency: 'X'.repeat(9),
      })
    );

    await assertFails(
      setDoc(doc(aliceDb, 'users/alice/purchases/p-boundary-payment'), {
        userId: 'alice',
        productId: 'prod-boundary',
        status: 'completed',
        paymentMethod: 'm'.repeat(33),
      })
    );

    await assertFails(
      setDoc(doc(aliceDb, 'users/alice/purchases/p-boundary-provider'), {
        userId: 'alice',
        productId: 'prod-boundary',
        status: 'completed',
        provider: 'p'.repeat(33),
      })
    );

    await assertFails(
      setDoc(doc(aliceDb, 'users/alice/purchases/p-boundary-session'), {
        userId: 'alice',
        productId: 'prod-boundary',
        status: 'completed',
        sessionId: 's'.repeat(256),
      })
    );

    await assertFails(
      setDoc(doc(aliceDb, 'users/alice/purchases/p-boundary-order'), {
        userId: 'alice',
        productId: 'prod-boundary',
        status: 'completed',
        paypalOrderId: 'o'.repeat(256),
      })
    );
  });

  it('permite activities con opcionales string en limites exactos', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();

    await assertSucceeds(
      setDoc(doc(anonDb, 'activities/act-boundary-ok'), {
        createdAt: Timestamp.now(),
        type: 't'.repeat(80),
        message: 'm'.repeat(500),
        severity: 's'.repeat(32),
        source: 'x'.repeat(120),
      })
    );
  });

  it('deniega activities cuando opcionales string exceden limites', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();

    await assertFails(
      setDoc(doc(anonDb, 'activities/act-boundary-type'), {
        createdAt: Timestamp.now(),
        type: 't'.repeat(81),
      })
    );

    await assertFails(
      setDoc(doc(anonDb, 'activities/act-boundary-message'), {
        createdAt: Timestamp.now(),
        message: 'm'.repeat(501),
      })
    );

    await assertFails(
      setDoc(doc(anonDb, 'activities/act-boundary-severity'), {
        createdAt: Timestamp.now(),
        severity: 's'.repeat(33),
      })
    );

    await assertFails(
      setDoc(doc(anonDb, 'activities/act-boundary-source'), {
        createdAt: Timestamp.now(),
        source: 'x'.repeat(121),
      })
    );
  });
});
