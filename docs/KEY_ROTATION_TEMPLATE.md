# Key Rotation Template

Before deploy, replace placeholders in `index.html`:

1. `index.html:20`
- `payments.stripePublicKey` -> `pk_test_...` or `pk_live_...`

2. `index.html:23`
- `firebase.apiKey` -> `AIza...`

Current placeholders:
- `REPLACE_WITH_STRIPE_PUBLISHABLE_KEY`
- `REPLACE_WITH_FIREBASE_WEB_API_KEY`

Quick verification:
```powershell
npm run build --silent
npm run security:scan
```

If checkout/webhooks are used, also rotate backend secrets in Stripe/Firebase Console and deploy backend first.
