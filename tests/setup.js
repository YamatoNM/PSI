import { jest } from "@jest/globals";

// Keep browser globals explicit for tests that use DOM or localStorage APIs.
globalThis.jest = jest;

beforeEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});
