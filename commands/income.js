const {
  getEnabledItems,
  appendRecords,
  getSummary,
  getCurrentStock,
  formatStock,
} = require("../services/googleSheet");
const { parseNote, parseByFuzzyLines } = require("../services/parser");
const { parseRecordDate } = require("../services/dateParser");

function money(value) {
  return Number(value || 0).toLocaleString("zh-TW");
}

async function incomeTemplate() {
  const items = await getEnabledItems("收入");
  const body = items.map((item) => `${item}：0`).join("\n");
  const stock = await getCurrentStock();

  return `💰 收入＋耗球

目前庫存：${formatStock(stock)}

${body}

耗球：0

備註：`;
}

async function handleIncome(text, user) {
  const items = await getEnabledItems("收入");
  const labels = [...items, "耗球"];
  const note = parseNote(text);
  const recordDate = parseRecordDate(text);
  const parsed = parseByFuzzyLines(text, labels);

  const records = [];
  const incomeLines = [];

  for (const item of items) {
    const amount = Number(parsed.result[item] || 0);
    if (amount > 0) {
      records.push({ type: "收入", item, income: amount, note, date: recordDate });
      incomeLines.push(`・${item}：${money(amount)} 元`);
    }
  }

  const ballsUsed = Number(parsed.result["耗球"] || 0);
  if (ballsUsed > 0) records.push({ type: "庫存", item: "耗球", ballsUsed, note, date: recordDate });

  console.log("PARSE_INCOME_RESULT:", JSON.stringify({
    user: user.name,
    text,
    parsed: parsed.matched,
    unknown: parsed.unknown,
    result: parsed.result,
  }));

  if (!records.length) throw new Error("沒有讀到收入金額或耗球數。");

  await appendRecords(records, user);

  const incomeTotal = records.reduce((sum, r) => sum + (r.income || 0), 0);
  const stock = await getCurrentStock();
  const my = await getSummary("month", user.id);

  const title = incomeTotal > 0 ? "✅ 收入完成" : "✅ 耗球記錄完成";
  const incomeBlock = incomeTotal > 0
    ? `收入明細：
${incomeLines.join("\n")}

收入合計：${money(incomeTotal)} 元`
    : "收入合計：0 元";

  return `${title}

填表人：${user.name}

${incomeBlock}
耗球：${money(ballsUsed)} 顆

🏸 剩餘庫存：${formatStock(stock)}
💰 我的未交：${money(my.unpaid)} 元

日期：${recordDate || "今日"}
備註：${note || "無"}`;
}

module.exports = {
  incomeTemplate,
  handleIncome,
};
