const { appendRecords, getSummary } = require("../services/googleSheet");
const { parseAmount, parseNote } = require("../services/parser");
const { parseRecordDate } = require("../services/dateParser");

function money(value) {
  return Number(value || 0).toLocaleString("zh-TW");
}

function paymentTemplate() {
  return `💵 幹部交款

交款：0

備註：`;
}

async function handlePayment(text, user) {
  const amount = parseAmount(text, "交款");
  const note = parseNote(text);
  const recordDate = parseRecordDate(text);

  console.log("PARSE_PAYMENT_RESULT:", JSON.stringify({ user: user.name, text, payment: amount }));

  if (amount <= 0) throw new Error("沒有讀到交款金額。");

  await appendRecords([{ type: "交款", item: "交款", payment: amount, note, date: recordDate }], user);

  const my = await getSummary("month", user.id);

  return `✅ 交款完成

填表人：${user.name}
交款：${money(amount)} 元

💰 我的未交：${money(my.unpaid)} 元

日期：${recordDate || "今日"}
備註：${note || "無"}`;
}

module.exports = {
  paymentTemplate,
  handlePayment,
};
