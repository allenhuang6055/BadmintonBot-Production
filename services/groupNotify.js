function hasGroupId() {
  return Boolean(process.env.LINE_GROUP_ID && process.env.LINE_GROUP_ID.trim());
}

function getGroupId() {
  return (process.env.LINE_GROUP_ID || "").trim();
}

async function pushGroupMessage(client, text) {
  if (!hasGroupId()) {
    console.log("GROUP_NOTIFY_SKIPPED: LINE_GROUP_ID is empty");
    return false;
  }

  await client.pushMessage({
    to: getGroupId(),
    messages: [{ type: "text", text }],
  });

  console.log("GROUP_NOTIFY_SENT");
  return true;
}

function buildGroupNotice(kind, user, resultText) {
  const titleMap = {
    income: "📢 收入記帳通知",
    expense: "📢 支出記帳通知",
    payment: "📢 交款通知",
    stock: "📢 耗球記錄通知",
  };

  return `${titleMap[kind] || "📢 記帳通知"}

填表人：${user.name}

${resultText}`;
}

function groupConfigText() {
  return `🔧 群組通知設定

LINE_GROUP_ID：
${hasGroupId() ? getGroupId() : "尚未設定"}

狀態：
${hasGroupId() ? "✅ 已設定，私訊記帳會推送到群組" : "❌ 未設定，請先到群組輸入「群組ID」取得 ID，再加到 Render Environment"}`;
}

module.exports = {
  hasGroupId,
  getGroupId,
  pushGroupMessage,
  buildGroupNotice,
  groupConfigText,
};
