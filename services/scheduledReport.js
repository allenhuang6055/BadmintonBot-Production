const cron = require("node-cron");
const { getSummary, getCurrentStock, formatStock } = require("./googleSheet");
const { pushGroupMessage } = require("./groupNotify");

function parseDailyReportTime() {
  const raw = (process.env.DAILY_REPORT_TIME || "22:00").trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return { hour: 22, minute: 0 };
  return {
    hour: Math.min(Math.max(Number(match[1]), 0), 23),
    minute: Math.min(Math.max(Number(match[2]), 0), 59),
  };
}

async function buildDailyReportText() {
  const today = await getSummary("today");
  const stock = await getCurrentStock();

  return `🏸【今日財務摘要】

收入：${today.income} 元
支出：${today.expense} 元
盈餘：${today.profit} 元

耗球：${today.ballsUsed} 顆
庫存：${formatStock(stock)}

交款：${today.payment} 元
未交：${today.unpaid} 元`;
}

function startDailyReport(client) {
  const enabled = String(process.env.DAILY_REPORT_ENABLED || "false").toLowerCase() === "true";
  if (!enabled) {
    console.log("DAILY_REPORT_DISABLED");
    return;
  }

  const { hour, minute } = parseDailyReportTime();
  const cronExpr = `${minute} ${hour} * * *`;

  cron.schedule(
    cronExpr,
    async () => {
      try {
        const text = await buildDailyReportText();
        await pushGroupMessage(client, text);
        console.log("DAILY_REPORT_SENT");
      } catch (err) {
        console.error("DAILY_REPORT_FAILED:", err.message);
      }
    },
    { timezone: "Asia/Taipei" }
  );

  console.log(`DAILY_REPORT_ENABLED: ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} Asia/Taipei`);
}

module.exports = {
  startDailyReport,
  buildDailyReportText,
};
