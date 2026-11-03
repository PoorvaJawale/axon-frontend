const DAY = 86400000,
  TARGETS = ["appdb", "n8ndb", "n8nkey"];
function planRetention(entries, now = Date.now()) {
  const remove = [],
    keep = [];
  for (const target of TARGETS) {
    const group = entries
      .filter((e) => e.target === target && e.authenticated === true)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    if (
      group.length < 3 ||
      now - Date.parse(group[0].createdAt) > DAY ||
      Date.parse(group[0].createdAt) > now + 300000
    )
      throw Error(
        "Three authenticated recovery points per target and a fresh backup are required",
      );
    const protectedFiles = new Set(
      group.slice(0, 3).map((e) => e.encryptedFile),
    );
    const restored = group.find((e) => e.restored === true);
    if (restored) protectedFiles.add(restored.encryptedFile);
    for (const entry of group) {
      if (!Number.isFinite(Date.parse(entry.createdAt)))
        throw Error("Invalid backup date");
      (now - Date.parse(entry.createdAt) > 30 * DAY &&
      !protectedFiles.has(entry.encryptedFile)
        ? remove
        : keep
      ).push(entry);
    }
  }
  return {
    remove,
    keep,
    days: 30,
    minimumPerTarget: 3,
    lastVerifiedRestoreProtected: true,
  };
}
module.exports = { planRetention };
