module.exports = {
  testEnvironment: "jsdom",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.js"],
  clearMocks: true,
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "currency-utils.js",
    "!**/node_modules/**"
  ]
};
