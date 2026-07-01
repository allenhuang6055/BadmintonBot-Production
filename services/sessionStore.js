const sessions = new Map();
const SESSION_TTL_MS = 5 * 60 * 1000;

function getKey(event) {
  if (event.source?.type === "group") return `group:${event.source.groupId}:${event.source.userId || "unknown"}`;
  return `user:${event.source?.userId || "unknown"}`;
}

function setSession(event, mode) {
  sessions.set(getKey(event), {
    mode,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
}

function getSession(event) {
  const key = getKey(event);
  const s = sessions.get(key);
  if (!s) return null;

  if (Date.now() > s.expiresAt) {
    sessions.delete(key);
    return null;
  }

  return s;
}

function clearSession(event) {
  sessions.delete(getKey(event));
}

function sessionName(mode) {
  if (mode === "income") return "收入";
  if (mode === "expense") return "支出";
  if (mode === "payment") return "幹部交款";
  return mode || "";
}

module.exports = {
  setSession,
  getSession,
  clearSession,
  sessionName,
};
