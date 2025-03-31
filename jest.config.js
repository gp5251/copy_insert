module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  // 模拟 Electron
  moduleNameMapper: {
    '^electron$': '<rootDir>/tests/mocks/electron.mock.js'
  }
}; 