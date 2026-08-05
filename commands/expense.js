const {
  getEnabledItems,
  appendRecords,
  getSummary,
} = require("../services/googleSheet");

const {
  parseNote,
  parseByFuzzyLines,
} = require("../services/parser");

const {
  parseRecordDate,
} = require("../services/dateParser");

function money(value) {
  return Number(value || 0).toLocaleString("zh-TW");
}

function shouldDeductUnpaid(note) {
  const normalized = String(note || "")
    .replace(/\s+/g, "")
    .toLowerCase();

  return (
    normalized.includes("扣未交") ||
    normalized.includes("抵扣未交")
  );
}

async function expenseTemplate() {
  const items = await getEnabledItems("支出");

  const body = items
    .map((item) => `${item}：0`)
    .join("\n");

  return `💸 支出

${body}

備註：

💡幹部使用代收款直接支付時，備註請加上「扣未交」
一般財務／球隊公款支出，備註照常填寫即可`;
}

async function handleExpense(text, user) {
  const items = await getEnabledItems("支出");
  const note = parseNote(text);
  const deductUnpaid = shouldDeductUnpaid(note);
  const recordDate = parseRecordDate(text);
  const parsed = parseByFuzzyLines(text, items);

  const records = [];
  const expenseLines = [];

  for (const item of items) {
    const amount = Number(parsed.result[item] || 0);

    if (amount > 0) {
      records.push({
        type: "支出",
        item,
        expense: amount,
        note,
        date: recordDate,
        deductUnpaid,
      });

      expenseLines.push(`・${item}：${money(amount)} 元`);
    }
  }

  console.log(
    "PARSE_EXPENSE_RESULT:",
    JSON.stringify({
      user: user.name,
      text,
      parsed: parsed.matched,
      unknown: parsed.unknown,
      result: parsed.result,
      note,
      deductUnpaid,
    })
  );

  if (!records.length) {
    throw new Error("沒有讀到支出金額。");
  }

  await appendRecords(records, user);

  const total = records.reduce(
    (sum, record) => sum + Number(record.expense || 0),
    0
  );

  const month = await getSummary("month");

  return `✅ 支出完成

填表人：${user.name}

支出明細：
${expenseLines.join("\n")}

支出合計：${money(total)} 元
抵扣未交款：${deductUnpaid ? "是" : "否"}
本月盈餘：${money(month.profit)} 元

日期：${recordDate || "今日"}
備註：${note || "無"}`;
}

module.exports = {
  expenseTemplate,
  handleExpense,
};
