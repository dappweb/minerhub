module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint'],
  env: {
    es2022: true,
    node: true,
    worker: true
  },
  ignorePatterns: ['dist/**'],
  rules: {}
}
