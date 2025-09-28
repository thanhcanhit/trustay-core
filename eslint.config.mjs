// @ts-check
import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "eslint.config.mjs",
      "dist/**/*",
      "node_modules/**/*",
      "coverage/**/*",
      "**/*.min.js",
      "**/*.config.js"
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: "commonjs",
      parserOptions: {
        projectService: false, // Disable project service to avoid performance issues during lint runs
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // TypeScript specific
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }],
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/ban-ts-comment": "warn",
      
      // General JavaScript/TypeScript
      "no-console": "warn",
      "no-debugger": "warn",
      "no-unused-vars": "off", // Use TypeScript version instead
      "prefer-const": "warn",
      "no-var": "error",
      "eqeqeq": ["warn", "always"],
      "curly": ["warn", "all"],
      
      // Import/Export
      "no-duplicate-imports": "error",
      
      // Code style (let Biome handle formatting)
      "indent": "off",
      "quotes": "off",
      "semi": "off",
      "comma-dangle": "off",
      "object-curly-spacing": "off",
      "array-bracket-spacing": "off",
    },
  },
  {
    // NestJS specific rules
    files: ["src/**/*.ts"],
    rules: {
      "@typescript-eslint/interface-name-prefix": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // Test files specific rules
    files: ["test/**/*.ts", "**/*.spec.ts", "**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  }
);