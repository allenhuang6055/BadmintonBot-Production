const cron = require("node-cron");

const {
  getSummary,
  getCurrentStock,
  formatStock,
} = require("./googleSheet");

const {
  pushGroupMessage,
} = require("./groupNotify");

function parseDailyReportTime() {
  const raw = (
    process.env.DAILY_REPORT_TIME || "22:00"
  ).trim();

  const match = raw.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return {
      hour: 22,
      minute: 0,
    };
  }

  return {
    hour: Math.min(
      Math.max(Number(match[1]), 0),
      23
    ),
    minute: Math.min(
      Math.max(Number(match[2]), 0),
      59
    ),
  };
}

/**
 * 取得台灣時間的星期。
 * 回傳值：
 * 0 = 星期日
 * 1 = 星期一
 * 2 = 星期二
 * 3 = 星期三
 * 4 = 星期四
 * 5 = 星期五
 * 6 = 星期六
 */
function getTaipeiDay() {
  const weekday = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: "Asia/Taipei",
      weekday: "short",
    }
  ).format(new Date());

  const dayMap = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return dayMap[weekday];
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
  const enabled =
    String(
      process.env.DAILY_REPORT_ENABLED || "false"
    )
      .trim()
      .toLowerCase() === "true";

  if (!enabled) {
    console.log("DAILY_REPORT_DISABLED");
    return;
  }

  const skipWeekends =
    String(
      process.env.DAILY_REPORT_SKIP_WEEKENDS ||
        "false"
    )
      .trim()
      .toLowerCase() === "true";

  const { hour, minute } =
    parseDailyReportTime();

  const cronExpr =
    `${minute} ${hour} * * *`;

  cron.schedule(
    cronExpr,
    async () => {
      try {
        const day = getTaipeiDay();

        console.log(
          "DAILY_REPORT_SKIP_WEEKENDS =",
          process.env
            .DAILY_REPORT_SKIP_WEEKENDS,
          "skipWeekends =",
          skipWeekends
        );

        console.log(
          "DAILY_REPORT_TAIPEI_DAY =",
          day
        );

        if (
          skipWeekends &&
          (day === 0 || day === 6)
        ) {
          console.log(
            "DAILY_REPORT_SKIP_WEEKEND"
          );
          return;
        }

        const text =
          await buildDailyReportText();

        await pushGroupMessage(
          client,
          text
        );

        console.log(
          "DAILY_REPORT_SENT"
        );
      } catch (err) {
        console.error(
          "DAILY_REPORT_FAILED:",
          err?.message || err
        );
      }
    },
    {
      timezone: "Asia/Taipei",
    }
  );

  console.log(
    `DAILY_REPORT_ENABLED: ${String(
      hour
    ).padStart(2, "0")}:${String(
      minute
    ).padStart(2, "0")} Asia/Taipei`
  );

  console.log(
    "DAILY_REPORT_SKIP_WEEKENDS:",
    skipWeekends
  );
}

module.exports = {
  startDailyReport,
  buildDailyReportText,
};