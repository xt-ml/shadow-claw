import { calculatePaginationDisabledState } from "./calculatePaginationDisabledState.js";

describe("calculatePaginationDisabledState", () => {
  it("disables both buttons when page count is 0", () => {
    expect(calculatePaginationDisabledState(-1, 0)).toEqual({
      isPrevDisabled: true,
      isNextDisabled: true,
    });
  });

  it("disables prev button on first page (index 0)", () => {
    expect(calculatePaginationDisabledState(0, 3)).toEqual({
      isPrevDisabled: true,
      isNextDisabled: false,
    });
  });

  it("disables next button on last page (index = total - 1)", () => {
    expect(calculatePaginationDisabledState(2, 3)).toEqual({
      isPrevDisabled: false,
      isNextDisabled: true,
    });
  });

  it("enables both buttons on middle pages", () => {
    expect(calculatePaginationDisabledState(1, 3)).toEqual({
      isPrevDisabled: false,
      isNextDisabled: false,
    });
  });
});
