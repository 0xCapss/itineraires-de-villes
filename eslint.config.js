// Analyse statique : le script principal est une seule fonction faite de plusieurs fichiers ; on analyse leur assemblage (voir tests/lint.js).
const globals = require('globals');
module.exports = [{
  files: ['**/*.js'],
  languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: { ...globals.browser, maplibregl: 'readonly', PQ: 'readonly', Purs: 'readonly', module: 'writable', FORMALITES: 'readonly', jspdf: 'readonly' } },
  rules: {
    'no-undef': 'error', 'no-redeclare': 'error', 'no-dupe-keys': 'error', 'no-unreachable': 'error', 'no-dupe-args': 'error', 'no-func-assign': 'error',
    'no-self-assign': 'error', 'no-unsafe-negation': 'error', 'no-unused-labels': 'error', 'no-cond-assign': 'error', 'use-isnan': 'error', 'valid-typeof': 'error',
    'no-empty': ['warn', { allowEmptyCatch: true }], 'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }], 'no-inner-declarations': 'off'
  }
}];
