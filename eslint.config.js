import javascript from 'eslint-config-vaadin/javascript';
import prettier from 'eslint-config-vaadin/prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';

export default [
  {
    ignores: ['.omc/**', 'logs/**'],
  },
  ...javascript,
  ...prettier,
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    languageOptions: {
      // The Babel parser of the JavaScript config needs no Babel config for plain modules.
      parserOptions: {
        requireConfigFile: false,
      },
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'simple-import-sort/imports': ['error', { groups: [['^\\u0000', '^', '^\\.\\.', '^\\.']] }],
      'arrow-body-style': 'off',
      'consistent-return': 'off',
      'no-await-in-loop': 'off',
      'no-console': 'off',
      'prefer-destructuring': 'off',
    },
  },
  {
    // The fakes of the tests keep the async methods of the Guidepup readers.
    files: ['test/**'],
    rules: {
      'require-await': 'off',
    },
  },
];
