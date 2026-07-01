const {
  getSummary,
  getCurrentStock,
  formatStock,
  getCurrentBalance,
  getSafetyCash,
  getCashStatus,
  getStockStatus,
} = require("../services/googleSheet");

function nowTaipeiText() {
  return new Date().toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function monthTaipeiText() {
  const parts = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((p) => p.type === "year")?.value || ""}/${parts.find((p) => p.type === "month")?.value || ""}`;
}

function money(value) {
  return Number(value || 0).toLocaleString("zh-TW");
}

function formatSummary(title, s, stock = null) {
  return `📊 ${title}

收入：${money(s.income)} 元
支出：${money(s.expense)} 元
盈餘：${money(s.profit)} 元

交款：${money(s.payment)} 元
未交：${money(s.unpaid)} 元
耗球：${money(s.ballsUsed)} 顆${stock === null ? "" : `\n庫存：${formatStock(stock)}`}`;
}

async function handleToday() {
  const s = await getSummary("today");
  const stock = await getCurrentStock();
  return formatSummary("今日統計", s, stock);
}

async function handleMonth() {
  const s = await getSummary("month");
  const stock = await getCurrentStock();
  const balance = await getCurrentBalance();
  const safetyCash = await getSafetyCash();

  return `🏸【健好羽球 月報】

📅 ${monthTaipeiText()}

════════════════

💰 本月收入
${money(s.income)} 元

💸 本月支出
${money(s.expense)} 元

📈 本月盈餘
${money(s.profit)} 元

🏦 目前資金餘額
${money(balance)} 元

════════════════

🏸 本月耗球
${money(s.ballsUsed)} 顆

📦 目前庫存
${formatStock(stock)}

════════════════

💵 本月交款
${money(s.payment)} 元

📋 未交款
${money(s.unpaid)} 元

════════════════

🛡️ 安全水位
${money(safetyCash)} 元

${getCashStatus(balance, safetyCash)}
${getStockStatus(stock)}

════════════════

🕒 更新時間
${nowTaipeiText()}`;
}

async function handleMyUnpaid(user) {
  const s = await getSummary("month", user.id);
  return `👤 我的未交

填表人：${user.name}

本月收入：${money(s.income)} 元
本月交款：${money(s.payment)} 元
尚未交回：${money(s.unpaid)} 元`;
}

async function handleStock() {
  const stock = await getCurrentStock();
  return `🏸 羽球庫存

目前剩餘：${formatStock(stock)}

${getStockStatus(stock)}

提醒：耗球請在「收入＋耗球」模板一起輸入。`;
}

module.exports = {
  handleToday,
  handleMonth,
  handleMyUnpaid,
  handleStock,
};
