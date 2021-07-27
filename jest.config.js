module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 80000,

  moduleNameMapper: {
    '^@src/(.*)': '<rootDir>/src/$1',
  },
};
