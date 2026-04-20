import { describe, it, expect } from "vitest";
import {
  StageEngineError,
  AuthorityDenied,
  ToolFailure,
  ClassifierTimeout,
  SchemaCacheStale,
  GateActionFailed,
} from "../errors.js";

describe("errors", () => {
  it("AuthorityDenied — code 403", () => {
    const e = new AuthorityDenied("blocked", { capability: "contract" });
    expect(e).toBeInstanceOf(StageEngineError);
    expect(e.code).toBe("AUTHORITY_DENIED");
    expect(e.httpStatus).toBe(403);
    expect(e.context).toEqual({ capability: "contract" });
    expect(e.name).toBe("AuthorityDenied");
  });

  it("ToolFailure — code 500", () => {
    const e = new ToolFailure("tool threw", { tool: "search_profiles" });
    expect(e.code).toBe("TOOL_FAILURE");
    expect(e.httpStatus).toBe(500);
  });

  it("ClassifierTimeout — code 504", () => {
    expect(new ClassifierTimeout("timeout").httpStatus).toBe(504);
  });

  it("SchemaCacheStale — code 503 + retryable=true", () => {
    const e = new SchemaCacheStale("PGRST002");
    expect(e.httpStatus).toBe(503);
    expect(e.retryable).toBe(true);
  });

  it("GateActionFailed — code 502", () => {
    expect(new GateActionFailed("rpc down").httpStatus).toBe(502);
  });

  it("all subclasses extend StageEngineError", () => {
    expect(new AuthorityDenied("x")).toBeInstanceOf(StageEngineError);
    expect(new ToolFailure("x")).toBeInstanceOf(StageEngineError);
    expect(new ClassifierTimeout("x")).toBeInstanceOf(StageEngineError);
    expect(new SchemaCacheStale("x")).toBeInstanceOf(StageEngineError);
    expect(new GateActionFailed("x")).toBeInstanceOf(StageEngineError);
  });
});
