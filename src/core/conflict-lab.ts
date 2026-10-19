import { compareStamp } from "./register.js";
import type { Register, Theme } from "./register.js";

/**
 * Runs the REAL version-ordering rule inside a safe, isolated sandbox.
 * A and B deliberately start at the same logical counter (an actual tie).
 * Arrival order changes the intermediate view, never the final winner.
 */
export type LabStep = { actor: string; value: Theme; accepted: boolean };
export type LabResult = {
  winner: Register<Theme>;
  forward: LabStep[];
  backward: LabStep[];
  converged: boolean;
};

function runOrder(first: Register<Theme>, second: Register<Theme>): LabStep[] {
  let current: Register<Theme> = { value: "light", stamp: { counter: 0, actor: "system" } };
  return [first, second].map(proposal => {
    const accepted = compareStamp(proposal.stamp, current.stamp) > 0;
    if (accepted) current = proposal;
    return { actor: proposal.stamp.actor, value: current.value, accepted };
  });
}

export function simulateConflict(): LabResult {
  const a: Register<Theme> = { value: "dark", stamp: { counter: 7, actor: "tab-A" } };
  const b: Register<Theme> = { value: "light", stamp: { counter: 7, actor: "tab-B" } };
  const forward = runOrder(a, b);
  const backward = runOrder(b, a);
  const winner = compareStamp(a.stamp, b.stamp) > 0 ? a : b;
  return {
    winner,
    forward,
    backward,
    converged: forward.at(-1)?.value === backward.at(-1)?.value &&
      forward.at(-1)?.value === winner.value,
  };
}
