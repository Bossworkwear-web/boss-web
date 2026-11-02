import { describe, expect, it } from "vitest";

import {
  classifySupabaseInstanceProbe,
  decideSupabaseAutoRestart,
  supabaseProjectRefFromUrl,
} from "@/lib/supabase-project-health-restart";

describe("supabaseProjectRefFromUrl", () => {
  it("reads the project ref from the API hostname", () => {
    expect(supabaseProjectRefFromUrl("https://byzowxdjoexaisponcpo.supabase.co")).toBe(
      "byzowxdjoexaisponcpo",
    );
  });

  it("returns null for missing or unrelated hosts", () => {
    expect(supabaseProjectRefFromUrl("")).toBeNull();
    expect(supabaseProjectRefFromUrl("https://example.com")).toBeNull();
  });
});

describe("classifySupabaseInstanceProbe", () => {
  it("treats timeouts and Cloudflare 522 as unreachable", () => {
    expect(classifySupabaseInstanceProbe({ httpStatus: null, timedOut: true }).kind).toBe("unreachable");
    expect(classifySupabaseInstanceProbe({ httpStatus: 522 }).kind).toBe("unreachable");
    expect(classifySupabaseInstanceProbe({ httpStatus: 503 }).kind).toBe("unreachable");
  });

  it("does not treat rejected keys as a hung database", () => {
    expect(classifySupabaseInstanceProbe({ httpStatus: 401 }).kind).toBe("auth");
    expect(classifySupabaseInstanceProbe({ httpStatus: 200 }).kind).toBe("ok");
  });
});

describe("decideSupabaseAutoRestart", () => {
  const unreachable = classifySupabaseInstanceProbe({ httpStatus: null, timedOut: true });
  const ok = classifySupabaseInstanceProbe({ httpStatus: 200 });
  const auth = classifySupabaseInstanceProbe({ httpStatus: 401 });

  it("restarts when the instance probe times out", () => {
    expect(
      decideSupabaseAutoRestart({
        hasManagementToken: true,
        projectRef: "abc",
        probe: unreachable,
        projectStatus: "ACTIVE_UNHEALTHY",
      }),
    ).toEqual({ action: "restart", reason: "probe timed out" });
  });

  it("skips when already coming up, paused, or keys are wrong", () => {
    expect(
      decideSupabaseAutoRestart({
        hasManagementToken: true,
        projectRef: "abc",
        probe: unreachable,
        projectStatus: "COMING_UP",
      }).action,
    ).toBe("skip");
    expect(
      decideSupabaseAutoRestart({
        hasManagementToken: true,
        projectRef: "abc",
        probe: ok,
        projectStatus: "ACTIVE_UNHEALTHY",
      }).action,
    ).toBe("skip");
    expect(
      decideSupabaseAutoRestart({
        hasManagementToken: true,
        projectRef: "abc",
        probe: auth,
        projectStatus: null,
      }).action,
    ).toBe("skip");
    expect(
      decideSupabaseAutoRestart({
        hasManagementToken: false,
        projectRef: "abc",
        probe: unreachable,
        projectStatus: null,
      }).reason,
    ).toMatch(/SUPABASE_ACCESS_TOKEN/);
  });
});
