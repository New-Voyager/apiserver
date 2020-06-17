module.exports = {

  // Automatically clear mock calls and instances between every test
  clearMocks: true,

  coverageDirectory: "coverage",

  // An array of regexp pattern strings used to skip coverage collection
  coveragePathIgnorePatterns: [
    "<rootDir>/node_modules/(?!@foo)"
  ],

  globals: {
    "ts-jest": {
      "tsConfigFile": "tsconfig.json",
      "enableTsDiagnostics": true
    }
  },

  moduleFileExtensions: [
    "js"
  ],

  // A map from regular expressions to module names that allow to stub out resources with a single module
  moduleNameMapper: {
    "@src/(.*)": "<rootDir>/build/src/$1",
    "database": "<rootDir>/src/lib/database"
  },

  testEnvironment: "node",

  testRegex: "(/tests/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$",

  testPathIgnorePatterns: ["utils/utils.js", "build/tests/utils.js"],

  transformIgnorePatterns: [
    "<rootDir>/node_modules/(?!@foo)"
  ],
  testTimeout: 5000
};
