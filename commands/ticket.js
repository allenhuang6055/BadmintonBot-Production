const {
  getTicketStock,
  formatTicketStock,
  appendTicketRecord,
} = require("../services/googleSheet");
const { parseRecordDate } = require("../services/dateParser");

function money(value) {
  return Number(value || 0).toLocaleString("zh-TW");
}

function ticketInTemplate() {
  return `🎫 球券入庫

請輸入本數或張數，例如：

10本

或

500張

也可以加備註：
10本 新印球券`;
}

function parseTicketQty(text) {
  const raw = String(text || "").trim();
  let m = raw.match(/(\d+(?:\.\d+)?)\s*本/);
  if (m) return { qty: Math.round(Number(m[1]) * 50), label: `${m[1]}本` };

  m = raw.match(/(\d+)\s*張/);
  if (m) return { qty: Number(m[1]), label: `${m[1]}張` };

  if (/^\d+$/.test(raw)) return { qty: Number(raw), label: `${raw}張` };
  return null;
}

async function handleTicketStock() {
  const stock = await getTicketStock();
  return `🎫 球券庫存

目前庫存：${money(stock)} 張
折合：${formatTicketStock(stock)}

每本：50 張
每張：16 元
每本：800 元

💰 票面價值：${money(stock * 16)} 元`;
}

async function handleTicketIn(text, user) {
  const parsed = parseTicketQty(text);
  if (!parsed || parsed.qty <= 0) {
    throw new Error("沒有讀到入庫數量，請輸入例如「10本」或「500張」。");
  }

  const note = String(text || "")
    .replace(/(\d+(?:\.\d+)?)\s*本/, "")
    .replace(/(\d+)\s*張/, "")
    .trim();

  await appendTicketRecord({
    date: parseRecordDate(text),
    action: "入庫",
    inQty: parsed.qty,
    note,
  }, user);

  const stock = await getTicketStock();

  return `✅ 球券入庫完成

填表人：${user.name}
入庫：${money(parsed.qty)} 張（${parsed.label}）

🎫 目前庫存：${money(stock)} 張
📚 折合：${formatTicketStock(stock)}

備註：${note || "無"}`;
}

module.exports = {
  ticketInTemplate,
  handleTicketStock,
  handleTicketIn,
};
