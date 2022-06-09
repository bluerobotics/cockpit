/* eslint-env node */
require('@rushstack/eslint-patch/modern-module-resolution')

module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    // 'plugin:jsdoc/recommended',
    'plugin:vue/vue3-recommended',
    '@vue/eslint-config-typescript/recommended',
    '@vue/eslint-config-prettier',
  ],
  env: {
    'browser': true,
    'es2022': true,
    'vue/setup-compiler-macros': true,
  },
  plugins: [
    // 'jsdoc',
    'simple-import-sort',
  ],
  rules: {
    'func-style': ['error', 'declaration', { allowArrowFunctions: true }],
    'import/extensions': 'off',
    'import/order': 'off',
    // 'jsdoc/require-jsdoc': [
    //   'error',
    //   {
    //     require: {
    //       ArrowFunctionExpression: false,
    //       ClassDeclaration: true,
    //       FunctionDeclaration: true,
    //       FunctionExpression: false,
    //       MethodDefinition: true,
    //     },
    //     contexts: [
    //       'TSEnumDeclaration',
    //       'TSInterfaceDeclaration',
    //       'TSMethodSignature',
    //       'TSPropertySignature',
    //     ],
    //   },
    // ],
    // 'jsdoc/require-param-description': 0,
    // 'jsdoc/require-returns-description': 0,
    'max-len': ['error', { code: 120 }],
    'no-alert': 'off',
    'no-console': 'off',
    'no-continue': 'off',
    'no-extra-parens': ['error', 'all'],
    // modified https://github.com/airbnb/javascript/blob/master/packages/eslint-config-airbnb-base/rules/style.js#L339
    // In our opinion, readability comes first and ForOF statements are more readable,
    // so we remove the ForOfStatement block.
    'no-restricted-syntax': [
      'error',
      {
        selector: 'ForInStatement',
        message:
          'for..in loops iterate over the entire prototype chain, which is virtually never what you want.' +
          'Use Object.{keys,values,entries}, and iterate over the resulting array.',
      },
      {
        selector: 'LabeledStatement',
        message:
          'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
      },
      {
        selector: 'WithStatement',
        message:
          '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
      },
    ],
    'no-param-reassign': 'off',
    'no-shadow': 'off',
    'no-useless-constructor': 'off',
    'semi': ['error', 'never'],
    'simple-import-sort/exports': 'error',
    'simple-import-sort/imports': 'error',
    'sort-imports': 'off',
    '@typescript-eslint/no-useless-constructor': ['error'],
    '@typescript-eslint/no-shadow': ['error'],
    '@typescript-eslint/explicit-function-return-type': [
      'error',
      { allowExpressions: true },
    ],
    'vue/no-unused-properties': [
      'error',
      {
        groups: ['props', 'data', 'computed', 'methods', 'setup'],
        deepData: true,
        ignorePublicMembers: false,
      },
    ],
    'vue/valid-v-slot': ['error', { allowModifiers: true }],
    'no-await-in-loop': 'off',
  },
  settings: {
    // jsdoc: {
    //   mode: 'typescript',
    // },
  },
  overrides: [
    {
      files: ['cypress/integration/**.spec.{js,ts,jsx,tsx}'],
      extends: ['plugin:cypress/recommended'],
    },
  ],
}
