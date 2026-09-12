import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn utility", () => {
  it("combines class names correctly", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("handles conditional classes correctly", () => {
    const isPrimary = true;
    const isSecondary = false;
    expect(cn("btn", isPrimary && "btn-primary", isSecondary && "btn-secondary")).toBe("btn btn-primary");
  });

  it("merges and resolves Tailwind CSS class conflicts", () => {
    expect(cn("px-4 text-red-500", "px-6 text-blue-500")).toBe("px-6 text-blue-500");
    expect(cn("bg-white", "bg-black")).toBe("bg-black");
  });

  it("handles undefined, null and boolean values gracefully", () => {
    expect(cn("font-bold", null, undefined, false, "text-sm")).toBe("font-bold text-sm");
  });
});
