async function getLineProfileName(client, userId) {
  try {
    if (!userId) return "";
    const profile = await client.getProfile(userId);
    return profile.displayName || "";
  } catch (err) {
    return "";
  }
}

async function getUser(client, event) {
  const id = event.source.userId || event.source.groupId || event.source.roomId || "unknown";
  const profileName = event.source.userId ? await getLineProfileName(client, event.source.userId) : "";
  return { id, name: profileName || id };
}

module.exports = { getUser };
