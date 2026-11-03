const names = ["web", "backend", "database"];
function decide(previous, states) {
  if (
    !names.every((n) =>
      ["operational", "degraded", "unreachable", "unknown"].includes(states[n]),
    )
  )
    throw Error("Invalid monitor state");
  const signature = names.map((n) => states[n]).join("/"),
    healthy = names.every((n) => states[n] === "operational"),
    wasHealthy = previous?.signature === "operational/operational/operational";
  return {
    signature,
    healthy,
    notify: !healthy
      ? previous?.signature !== signature
      : !!previous && !wasHealthy,
    event: healthy ? "recovered" : "check-failed",
  };
}
module.exports = { decide };
