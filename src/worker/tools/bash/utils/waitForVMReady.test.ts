import { jest } from "@jest/globals";

const mockIsVMReady = jest.fn() as any;

jest.unstable_mockModule("../../../../shell/vm.js", () => ({
  isVMReady: mockIsVMReady,
}));

const { waitForVMReady } = await import("./waitForVMReady.js");

describe("waitForVMReady", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns true immediately if VM is already ready", async () => {
    mockIsVMReady.mockReturnValue(true);

    const result = await waitForVMReady(1000);
    expect(result).toBe(true);
    expect(mockIsVMReady).toHaveBeenCalledTimes(1);
  });

  it("polls and returns true once VM becomes ready", async () => {
    mockIsVMReady
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValue(true);

    const result = await waitForVMReady(500);
    expect(result).toBe(true);
  });

  it("times out and returns false if VM never becomes ready", async () => {
    mockIsVMReady.mockReturnValue(false);

    const result = await waitForVMReady(50);
    expect(result).toBe(false);
  });
});
