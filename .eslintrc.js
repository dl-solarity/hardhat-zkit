module.exports = {
  env: {
    browser: false,
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  rules: {
    "arrow-parens": 0,
    "no-debugger": 1,
    "no-warning-comments": [
      1,
      {
        terms: ["hardcoded"],
        location: "anywhere",
      },
    ],
    "no-return-await": 1,
    "object-curly-spacing": ["error", "always"],
    "no-var": "error",
    "comma-dangle": [1, "always-multiline"],
    "linebreak-style": ["error", "unix"],
    "generator-star-spacing": 0,
    "no-tabs": 2,
    "max-len": [
      1,
      {
        code: 120,
        comments: 120,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true,
      },
    ],
    "no-console": [
      1,
      {
        allow: ["warn", "error"],
      },
    ],
    "no-multiple-empty-lines": [2, { max: 1, maxEOF: 0, maxBOF: 0 }],
    "import/no-named-as-default-member": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/no-explicit-any": "off",
  },
  settings: {
    "import/resolver": {
      "typescript": {
        "project": "./tsconfig.json",
      },
    },
  },
};
