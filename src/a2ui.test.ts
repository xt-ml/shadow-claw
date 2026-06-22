/**
 * Tests for the shared `formatA2UIActionPrompt` helper that builds the
 * `[A2UI ACTION]` trigger prompt routed to a surface owner's agent.
 */

import { formatA2UIActionPrompt } from "./a2ui.js";
import type { A2UIAction } from "./a2ui.js";

function action(overrides: Partial<A2UIAction> = {}): A2UIAction {
  return {
    type: "a2ui-action",
    surfaceId: "surf-1",
    actionId: "increment",
    dataModel: { count: 3 },
    ...overrides,
  };
}

describe("formatA2UIActionPrompt", () => {
  it("prefixes with [A2UI ACTION] so the orchestrator force-triggers", () => {
    expect(formatA2UIActionPrompt(action()).startsWith("[A2UI ACTION]")).toBe(
      true,
    );
  });

  it("includes the surfaceId, actionId, and serialized dataModel", () => {
    const prompt = formatA2UIActionPrompt(action());
    expect(prompt).toContain('surfaceId: "surf-1"');
    expect(prompt).toContain('actionId: "increment"');
    expect(prompt).toContain('"count": 3');
  });

  it("instructs the agent to update the surface via render_component", () => {
    const prompt = formatA2UIActionPrompt(action());
    expect(prompt).toContain("updateDataModel");
    expect(prompt).toContain("render_component");
  });

  it("attributes the action to the firing peer when an alias is provided", () => {
    const prompt = formatA2UIActionPrompt(action(), "Carol");
    expect(prompt).toContain('firedBy: "Carol"');
    expect(prompt).toContain("Carol triggered");
  });

  it("falls back to a generic actor when no alias is provided", () => {
    const prompt = formatA2UIActionPrompt(action());
    expect(prompt).not.toContain("firedBy:");
    expect(prompt).toContain("The user triggered");
  });

  it("tolerates a missing dataModel", () => {
    const prompt = formatA2UIActionPrompt(
      action({ dataModel: undefined as unknown as Record<string, unknown> }),
    );
    expect(prompt).toContain("dataModel:");
    expect(prompt).toContain("{}");
  });
});
