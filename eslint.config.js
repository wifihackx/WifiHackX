import js from '@eslint/js';
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';

const vitestGlobals = {
  describe: 'readonly',
  it: 'readonly',
  test: 'readonly',
  expect: 'readonly',
  beforeAll: 'readonly',
  afterAll: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly',
  vi: 'readonly',
};

export default [
  {
    ignores: [
      'dist/**',
      'public/**',
      'functions/**',
      'node_modules/**',
      'coverage/**',
      '.lighthouseci/**',
      '**/*.cjs',
      '**/*.min.js',
      '**/vendor/**',
    ],
  },
  js.configs.recommended,
  {
    files: [
      'src/**/*.js',
      'tools/**/*.js',
      'tests/**/*.js',
      '*.config.js',
      'vite.config.js',
      'vitest.config.js',
      'playwright.config.js',
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2024,
        firebase: 'readonly',
        lucide: 'readonly',
        Chart: 'readonly',
        Sentry: 'readonly',
        Logger: 'readonly',
        XSSProtection: 'readonly',
        DOMUtils: 'readonly',
        ErrorHandler: 'readonly',
        paypal: 'readonly',
        Stripe: 'readonly',
        gtag: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-undef': 'off',
      'no-redeclare': 'off',
      'no-useless-assignment': 'off',
      'no-control-regex': 'off',
      'no-useless-escape': 'off',
      'preserve-caught-error': 'off',
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: vitestGlobals,
    },
  },
  eslintConfigPrettier,
];
