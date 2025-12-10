module.exports = [
  {
    ignores: ['node_modules', 'dist', 'coverage', 'requirements-extracted.txt']
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'commonjs'
    },
    linterOptions: {
      reportUnusedDisableDirectives: true
    },
    rules: {
      'no-console': 'off',
      'no-underscore-dangle': 'off',
      'no-unused-vars': [
        'warn',
        { 'argsIgnorePattern': '^_', 'caughtErrorsIgnorePattern': '^_' }
      ]
    }
  }
];
