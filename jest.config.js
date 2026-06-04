/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/server/'],
  collectCoverageFrom: [
    'constants/**/*.js',
    'utils/**/*.js',
    '!**/*.test.js',
  ],
};
