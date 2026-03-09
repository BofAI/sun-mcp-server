import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";

export default tseslint.config(
  // Base JS recommended rules
  eslint.configs.recommended,

  // TypeScript recommended rules (type-aware)
  ...tseslint.configs.recommended,

  // Prettier — disables conflicting rules + reports formatting issues
  eslintPluginPrettier,

  // Global settings
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Project-specific rules
  {
    files: ["src/**/*.ts", "test/**/*.ts", "scripts/**/*.ts"],
    rules: {
      // TypeScript
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",

      // General
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      eqeqeq: ["error", "always"],
      "no-eval": "error",
      "prefer-const": "error",
      "preserve-caught-error": "off",
      "no-useless-escape": "warn",
    },
  },

  // Relax rules for test files
  {
    files: ["test/**/*.ts", "scripts/**/*.ts"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },

  // Ignore patterns
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "*.js",
      "*.mjs",
      "*.cjs",
      "**/*.js",
      "specs/**",
      "bin/**",
    ],
  },
);
