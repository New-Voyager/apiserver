module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 20000,
  moduleNameMapper: {
    '@/src/(.*)': '<rootDir>/src/$1',
    database: '<rootDir>/src/lib/database',
  },
};
