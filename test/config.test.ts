import { describe, expect, it } from "vitest";
import { parseArgs } from "../src/config.js";

describe("parseArgs", () => {
  it("prefers --sdk-path over BF6_PORTAL_SDK_PATH", () => {
    const config = parseArgs(["--sdk-path", "/tmp/from-arg"], { BF6_PORTAL_SDK_PATH: "/tmp/from-env" });
    expect(config.sdkPath).toBe("/tmp/from-arg");
  });

  it("uses BF6_PORTAL_SDK_PATH when --sdk-path is absent", () => {
    const config = parseArgs([], { BF6_PORTAL_SDK_PATH: "/tmp/from-env" });
    expect(config.sdkPath).toBe("/tmp/from-env");
  });

  it("uses the installed book data path by default", () => {
    const config = parseArgs([], {});
    expect(config.bookPath).toMatch(/[/\\]vendor[/\\]bf-portal-book$/u);
  });

  it("accepts the npx mcp subcommand form", () => {
    const config = parseArgs(["mcp", "--sdk-path", "/tmp/from-npx"], {});
    expect(config.sdkPath).toBe("/tmp/from-npx");
  });
});
