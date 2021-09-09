module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 80000,

  moduleNameMapper: {
    '^@src/(.*)': '<rootDir>/src/$1',
  },
  globalSetup: '<rootDir>/tests/testSetup.ts',
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!<rootDir>/node_modules/"',
    ],
  collectCoverage: true,
  coverageDirectory: 'cov',
  testPathIgnorePatterns: [
    '/node_modules',
    '/unit-tests'
  ]
};
