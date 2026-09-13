import { describe, it, expect } from "vitest";
import { Dialog, ConfirmDialog } from "./dialog";

describe("Dialog and ConfirmDialog components", () => {
  it("exports Dialog and ConfirmDialog components", () => {
    expect(Dialog).toBeDefined();
    expect(ConfirmDialog).toBeDefined();
  });

  it("is a function component", () => {
    expect(typeof Dialog).toBe("function");
    expect(typeof ConfirmDialog).toBe("function");
  });
});
