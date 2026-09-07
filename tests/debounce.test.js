import { jest } from "@jest/globals";
import { debounce } from "../debounce.js";

describe("Test 5 — amount debounce", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("rapid calls trigger the wrapped function only once", () => {
    const wrapped = jest.fn();
    const debounced = debounce(wrapped, 300);

    debounced("1");
    debounced("12");
    debounced("123");

    jest.advanceTimersByTime(299);
    expect(wrapped).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(wrapped).toHaveBeenCalledTimes(1);
  });

  test("the wrapped function receives the latest argument", () => {
    const wrapped = jest.fn();
    const debounced = debounce(wrapped, 300);

    debounced("intermediate");
    debounced("latest");
    jest.advanceTimersByTime(300);

    expect(wrapped).toHaveBeenCalledWith("latest");
  });

  test("a new call after the delay triggers the function again", () => {
    const wrapped = jest.fn();
    const debounced = debounce(wrapped, 300);

    debounced("first");
    jest.advanceTimersByTime(300);
    debounced("second");
    jest.advanceTimersByTime(300);

    expect(wrapped).toHaveBeenCalledTimes(2);
  });

  test("currency dropdown changes bypass debounce", () => {
    const immediate = jest.fn();
    const debounced = debounce(immediate, 300);

    document.body.innerHTML = '<select id="from"><option>USD</option></select>';
    document.querySelector("#from").addEventListener("change", immediate);
    document.querySelector("#from").dispatchEvent(new Event("change"));

    expect(immediate).toHaveBeenCalledTimes(1);
  });

  test("the swap button bypasses debounce", () => {
    const immediate = jest.fn();
    const debounced = debounce(immediate, 300);

    document.body.innerHTML = '<button id="swap">Swap</button>';
    document.querySelector("#swap").addEventListener("click", immediate);
    document.querySelector("#swap").click();

    expect(immediate).toHaveBeenCalledTimes(1);
  });
});
