const {
  getSummary,
  getCumulativeUnpaid,
  getUnpaidList,
  getRangeSummary,
  getBalanceAt,
  getCumulativeUnpaidAt,
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

function formatUnpaidList(unpaidList) {
  if (!unpaidList.length) {
    return "✅ 目前無未交款";
  }

  const lines = unpaidList.map(
    (item) => `${item.name}　${money(item.unpaid)} 元`
  );

  return `📋 未交名單

${lines.join("\n")}`;
}

function formatSummary(title, s, stock, cumulativeUnpaid, unpaidList) {
  const profitIcon = s.profit < 0 ? "📉" : "📈";

  return `📊 ${title}

💰 收入：${money(s.income)} 元
💸 支出：${money(s.expense)} 元
${profitIcon} 今日盈餘：${money(s.profit)} 元

💵 今日收款：${money(s.payment)} 元

🏸 耗球：${money(s.ballsUsed)} 顆
📦 庫存：${formatStock(stock)}

🧾 累積未交款：${money(cumulativeUnpaid)} 元

${formatUnpaidList(unpaidList)}`;
}

async function handleToday() {
  const [s, stock, cumulativeUnpaid, unpaidList] = await Promise.all([
    getSummary("today"),
    getCurrentStock(),
    getCumulativeUnpaid(),
    getUnpaidList(),
  ]);

  return formatSummary(
    "今日統計",
    s,
    stock,
    cumulativeUnpaid,
    unpaidList
  );
}

async function handleMonth() {
  const [s, stock, balance, safetyCash, cumulativeUnpaid] = await Promise.all([
    getSummary("month"),
    getCurrentStock(),
    getCurrentBalance(),
    getSafetyCash(),
    getCumulativeUnpaid(),
  ]);

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

💵 本月收款
${money(s.payment)} 元

🧾 累積未交款
${money(cumulativeUnpaid)} 元

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
  const [s, cumulativeUnpaid] = await Promise.all([
    getSummary("month", user.id),
    getCumulativeUnpaid(user.id),
  ]);

  return `👤 我的未交

填表人：${user.name}

本月收入：${money(s.income)} 元
本月收款：${money(s.payment)} 元
累積未交款：${money(cumulativeUnpaid)} 元`;
}

async function handleStock() {
  const stock = await getCurrentStock();
  return `🏸 羽球庫存

目前剩餘：${formatStock(stock)}

${getStockStatus(stock)}

提醒：耗球請在「收入＋耗球」模板一起輸入。`;
}


function taipeiToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  return new Date(
    Number(parts.find((p) => p.type === "year")?.value),
    Number(parts.find((p) => p.type === "month")?.value) - 1,
    Number(parts.find((p) => p.type === "day")?.value)
  );
}

function makeDate(year, month, day) {
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function monthRange(year, month) {
  return {
    startDate: new Date(year, month - 1, 1),
    endDate: new Date(year, month, 0),
  };
}

function parseDatePart(value, defaultYear) {
  const normalized = String(value || "")
    .trim()
    .replace(/[.-]/g, "/");

  let match = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);

  if (match) {
    return makeDate(
      Number(match[1]),
      Number(match[2]),
      Number(match[3])
    );
  }

  match = normalized.match(/^(\d{1,2})\/(\d{1,2})$/);

  if (match) {
    return makeDate(
      defaultYear,
      Number(match[1]),
      Number(match[2])
    );
  }

  return null;
}

function parseRangeQuery(text) {
  const raw = String(text || "")
    .trim()
    .replace(/^查\s*/, "")
    .trim();

  const today = taipeiToday();

  if (raw === "今天" || raw === "今日") {
    return {
      startDate: today,
      endDate: today,
    };
  }

  if (raw === "昨天") {
    const yesterday = addDays(today, -1);
    return {
      startDate: yesterday,
      endDate: yesterday,
    };
  }

  if (raw === "本月") {
    return monthRange(
      today.getFullYear(),
      today.getMonth() + 1
    );
  }

  if (raw === "上個月" || raw === "上月") {
    const lastMonth = new Date(
      today.getFullYear(),
      today.getMonth() - 1,
      1
    );

    return monthRange(
      lastMonth.getFullYear(),
      lastMonth.getMonth() + 1
    );
  }

  let match = raw.match(/^最近\s*(\d+)\s*天$/);

  if (match) {
    const days = Number(match[1]);

    if (!Number.isInteger(days) || days < 1 || days > 366) {
      return null;
    }

    return {
      startDate: addDays(today, -(days - 1)),
      endDate: today,
    };
  }

  match = raw.match(/^(\d{1,2})\s*月$/);

  if (match) {
    const month = Number(match[1]);

    if (month < 1 || month > 12) return null;

    return monthRange(today.getFullYear(), month);
  }

  match = raw.match(/^(\d{4})\s*年\s*(\d{1,2})\s*月$/);

  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);

    if (month < 1 || month > 12) return null;

    return monthRange(year, month);
  }

  const parts = raw.split(/\s*(?:~|～|至)\s*/);

  if (parts.length === 2) {
    const startDate = parseDatePart(
      parts[0],
      today.getFullYear()
    );

    const endDate = parseDatePart(
      parts[1],
      startDate?.getFullYear() || today.getFullYear()
    );

    if (!startDate || !endDate || startDate > endDate) {
      return null;
    }

    return {
      startDate,
      endDate,
    };
  }

  return null;
}

function dateText(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("/");
}

function formatBallsAsStock(balls) {
  const value = Number(balls || 0);
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const tubes = Math.floor(abs / 12);
  const rest = abs % 12;

  if (rest === 0) return `${sign}${tubes} 桶`;
  return `${sign}${tubes} 桶 ${rest} 顆`;
}

async function handleRangeQuery(text) {
  const range = parseRangeQuery(text);

  if (!range) {
    return `❌ 查詢格式無法辨識

可以這樣輸入：

查 今天
查 昨天
查 本月
查 上個月
查 最近7天
查 最近30天
查 8月
查 2026/08/01~2026/08/15`;
  }

  const [
    summary,
    currentBalance,
    endingBalance,
    cumulativeUnpaid,
  ] = await Promise.all([
    getRangeSummary(range.startDate, range.endDate),
    getCurrentBalance(),
    getBalanceAt(range.endDate),
    getCumulativeUnpaidAt(range.endDate),
  ]);

  const profitIcon = summary.profit < 0 ? "📉" : "📈";

  return `📅 查詢區間

${dateText(range.startDate)} ～ ${dateText(range.endDate)}

════════════

🏦 目前資金餘額
${money(currentBalance)} 元

🏦 查詢區間結束餘額
${money(endingBalance)} 元

════════════

💰 收入：${money(summary.income)} 元
💸 支出：${money(summary.expense)} 元
${profitIcon} 盈餘：${money(summary.profit)} 元

💵 收款：${money(summary.payment)} 元

🏸 耗球：${money(summary.ballsUsed)} 顆
📦 入庫：${formatBallsAsStock(summary.ballsIn)}

🧾 累積未交款：${money(cumulativeUnpaid)} 元`;
}

module.exports = {
  handleToday,
  handleMonth,
  handleMyUnpaid,
  handleStock,
  handleRangeQuery,
};
