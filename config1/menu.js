function quickReply(items) {
  return {
    items: items.map(([label, text]) => ({
      type: "action",
      action: { type: "message", label, text }
    }))
  };
}

function mainMenuMessage() {
  return {
    type: "text",
    text: "🏸 健好羽球財務系統 V8\n\n請選擇功能👇",
    quickReply: quickReply([
      ["💰 收入＋耗球", "收入"],
      ["💸 支出", "支出"],
      ["💵 交款", "交款"],
      ["📊 今天", "今天"],
      ["📅 本月", "本月"],
      ["👤 我的未交", "我的未交"],
      ["🏸 球庫存", "球庫存"]
    ])
  };
}

module.exports = { mainMenuMessage, quickReply };
