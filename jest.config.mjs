/**
 * Jest Configuration for ES6 Modular Unit Testing
 * Configured for native ECMAScript modules in Node.js
 */
export default {
  testEnvironment: 'node',
  transform: {},
  moduleFileExtensions: ['js', 'mjs', 'json'],
  testMatch: [
    '**/tests/unit/**/*.test.mjs',
    '**/tests/unit/**/*.test.js'
  ],
  verbose: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html']
};
