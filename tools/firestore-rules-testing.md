# Firestore Rules Testing Guide

## Included in this repo

- Test suite: `tests/rules/firestore.rules.test.js`
- NPM script: `npm run test:rules`
- Emulator config in `firebase.json` (`firestore` on port `8080`)

## Prerequisites

- Node.js + npm
- Firebase CLI
- Java installed and available in `PATH` (required by Firestore Emulator)

## Run

```bash
npm run test:rules
```

This command runs:

```bash
firebase emulators:exec --only firestore --project demo-wifihackx-rules "vitest run tests/rules/firestore.rules.test.js"
```

## Current environment note

- In this environment, execution is blocked because `firebase-tools` cannot spawn Java, even when Java is installed:
  - `Could not spawn 'java -version'`

## Windows troubleshooting

- If `java -version` works but Firebase still reports `Could not spawn 'java -version'`:
  1. Reopen terminal after Java install.
  2. Ensure `JAVA_HOME` points to JDK (e.g. `C:\Program Files\OpenJDK\jdk-21`).
  3. Ensure `%JAVA_HOME%\bin` is in `Path`.
  4. Try running in a fresh PowerShell session.
  5. Prefer CI execution on Ubuntu runner (configured in workflow) for deterministic results.

## Optional CI integration

- Add `npm run test:rules` as a required step before deploy.
- Ensure CI image includes Java (JRE/JDK 11+).
