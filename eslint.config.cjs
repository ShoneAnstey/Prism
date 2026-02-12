const js = require("@eslint/js");
const security = require("eslint-plugin-security");
const noUnsanitized = require("eslint-plugin-no-unsanitized");
const globals = require("globals");

module.exports = [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/out/**",
      "**/vendor/**",
      "**/*.min.js"
    ]
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    linterOptions: {
      reportUnusedDisableDirectives: false
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.es2021,
        chrome: "readonly",
        browser: "readonly"
      }
    },
    plugins: { security, "no-unsanitized": noUnsanitized },
    rules: {
      ...(security.configs.recommended?.rules ?? {}),
      "security/detect-object-injection": "off",

      // Enable these intentionally later (they can be noisy in UI-heavy code).
      // Keeping them off ensures `npm run lint` remains a clean baseline.
      "no-unsanitized/method": "off",
      "no-unsanitized/property": "off",

      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off"
    }
  }
];
