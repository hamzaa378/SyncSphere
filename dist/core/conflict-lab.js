import { compareStamp } from "./register.js";
function runOrder(first, second) {
    let current = { value: "light", stamp: { counter: 0, actor: "system" } };
    return [first, second].map(proposal => {
        const accepted = compareStamp(proposal.stamp, current.stamp) > 0;
        if (accepted)
            current = proposal;
        return { actor: proposal.stamp.actor, value: current.value, accepted };
    });
}
export function simulateConflict() {
    const a = { value: "dark", stamp: { counter: 7, actor: "tab-A" } };
    const b = { value: "light", stamp: { counter: 7, actor: "tab-B" } };
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
