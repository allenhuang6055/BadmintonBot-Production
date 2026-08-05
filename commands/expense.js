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

/**
 * 判斷支出是否要抵扣填表人的未交款。
 *
 * 備註只要包含以下任一文字，就視為需要抵扣：
 * - 扣未交
 * - 抵扣未交
 * - 抵扣未交款
 */
function shouldDeductUnpaid(note) {
  const normalizedNote = String(note || "")
    .replace(/\s+/g, "")
    .toLowerCase();

  return (
    normalizedNote.includes("扣未交") ||
    normalizedNote.includes("抵扣未交") ||
    normalizedNote.includes("抵扣未交款")
  );
}

/**
 * 建立真正寫入試算表備註欄的內容。
 *
 * 需要抵扣時，自動加入：
 * 抵扣未交款:Y
 *
 * 之後試算表可用備註欄判斷這筆支出
 * 是否要納入幹部未交款扣抵。
 */
function buildStoredNote(note, deductUnpaid) {
  const cleanNote = String(note || "").trim();

  if (!deductUnpaid) {
    return cleanNote;
  }

  // 避免已經有正式標記時又重複加入。
  if (cleanNote.includes("抵扣未交款:Y")) {
    return cleanNote;
  }

  if (cleanNote) {
    return `抵扣未交款:Y｜${cleanNote}`;
  }

  return "抵扣未交款:Y";
}

async function expenseTemplate() {
  const items = await getEnabledItems("支出");

  const body = items
    .map((item) => `${item}：0`)
    .join("\n");

  return `💸 支出

${body}

備註：

💡幹部使用代收款直接支付時，
備註請輸入「扣未交」

財務或球隊公款支付時，
備註正常填寫即可`;
}

async function handleExpense(text, user) {
  const items = await getEnabledItems("支出");

  // 讀取使用者原本輸入的備註。
  const originalNote = parseNote(text);

  // 判斷是否需要抵扣未交款。
  const deductUnpaid =
    shouldDeductUnpaid(originalNote);

  // 建立寫入試算表的正式備註。
  const storedNote = buildStoredNote(
    originalNote,
    deductUnpaid
  );

  const recordDate = parseRecordDate(text);
  const parsed = parseByFuzzyLines(
    text,
    items
  );

  const records = [];
  const expenseLines = [];

  for (const item of items) {
    const amount = Number(
      parsed.result[item] || 0
    );

    if (amount > 0) {
      records.push({
        type: "支出",
        item,
        expense: amount,
        note: storedNote,
        date: recordDate,
      });

      expenseLines.push(
        `・${item}：${money(amount)} 元`
      );
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
      originalNote,
      storedNote,
      deductUnpaid,
    })
  );

  if (!records.length) {
    throw new Error(
      "沒有讀到支出金額。"
    );
  }

  await appendRecords(records, user);

  const total = records.reduce(
    (sum, record) =>
      sum + Number(record.expense || 0),
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
備註：${originalNote || "無"}`;
}

module.exports = {
  expenseTemplate,
  handleExpense,
};