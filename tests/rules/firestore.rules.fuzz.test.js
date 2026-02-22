import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { Timestamp, doc, setDoc, setLogLevel } from "firebase/firestore";

const PROJECT_ID = "demo-wifihackx-rules";
const RULES_PATH = resolve(process.cwd(), "firestore.rules");

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomString(rng, len) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i += 1) {
    out += chars[Math.floor(rng() * chars.length)];
  }
  return out;
}

describe("Firestore rules fuzz suite", () => {
  let testEnv;

  beforeAll(async () => {
    setLogLevel("silent");
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: readFileSync(RULES_PATH, "utf8")
      }
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it("fuzz analytics_visits: acepta en limite y rechaza overflow", async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    const rng = mulberry32(20260222);

    for (let i = 0; i < 25; i += 1) {
      const over = rng() > 0.5;
      const sourceLen = over ? 121 : Math.floor(rng() * 121);
      const pathLen = over ? 301 : Math.floor(rng() * 301);
      const userAgentLen = over ? 1025 : Math.floor(rng() * 1025);
      const sessionLen = over ? 121 : Math.floor(rng() * 121);

      const payload = {
        timestamp: Timestamp.now(),
        device: "desktop",
        source: randomString(rng, Math.max(1, sourceLen)),
        path: `/${randomString(rng, Math.max(1, pathLen))}`,
        userAgent: randomString(rng, Math.max(1, userAgentLen)),
        userType: "guest",
        sessionId: randomString(rng, Math.max(1, sessionLen)),
        referrer: "https://example.com",
        viewport: { width: 1920, height: 1080 },
        language: "es-ES",
        isAdmin: false
      };

      const ref = doc(anonDb, `analytics_visits/fuzz_${i}`);
      if (over) {
        await assertFails(setDoc(ref, payload));
      } else {
        await assertSucceeds(setDoc(ref, payload));
      }
    }
  });

  it("fuzz security_logs: valida limite de keys y longitud de reason", async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    const rng = mulberry32(20260223);

    for (let i = 0; i < 25; i += 1) {
      const overflowKeys = rng() > 0.5;
      const reasonTooLong = rng() > 0.5;
      const keyCount = overflowKeys ? 21 : 20;
      const reasonLen = reasonTooLong ? 201 : Math.floor(rng() * 201);

      const payload = {
        createdAt: Timestamp.now(),
        type: "risk.signal",
        reason: randomString(rng, reasonLen)
      };

      for (let k = 0; k < keyCount - 3; k += 1) {
        payload[`k${k}`] = k;
      }

      const ref = doc(anonDb, `security_logs/fuzz_${i}`);
      if (overflowKeys || reasonTooLong) {
        await assertFails(setDoc(ref, payload));
      } else {
        await assertSucceeds(setDoc(ref, payload));
      }
    }
  });
});
