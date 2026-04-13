import tseslint from "typescript-eslint"

export default tseslint.config(
  tseslint.configs.strict,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "*.config.*", "packages/dashboard/**"],
  }
)
