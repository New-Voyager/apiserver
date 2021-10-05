module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 80000,
  globals: {
    'ts-jest': {
      isolatedModules: false,
    },
  },
  // globalSetup: '<rootDir>/tests/setup.ts',
  moduleNameMapper: {
    '^@src/(.*)': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [`/node_modules/(?!${['typeorm']})`],

  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/repositories/nexthand.ts',
    '!src/repositories/chipstrack.ts',
    '!src/repositories/admin.ts',
    '!src/api/promotion/index.ts',
    '!src/repositories/dev.ts',
    '!src/resolvers/dev.ts',
    '!src/resolvers/hello.ts',
    '!src/repositories/hello.ts',
    '!src/admin/index.ts',
    '!src/botrunner/index.ts',
    // '!<rootDir>/node_modules/"',
  ],
  collectCoverage: true,
  coverageDirectory: 'cov-int',
  coverageReporters: ["json", "html"],

  // testPathIgnorePatterns: ['/node_modules', '/unit-tests'],
};
