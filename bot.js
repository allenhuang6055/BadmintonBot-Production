require("dotenv").config();

const express = require("express");
const line = require("@line/bot-sdk");

const { mainMenuMessage } = require("./config/menu");
const { getUser } = require("./services/lineUser");
const { pushGroupMessage, buildGroupNotice, groupConfigText, hasGroupId } = require("./services/groupNotify");
const { setSession, getSession, clearSession, sessionName } = require("./services/sessionStore");
const { incomeTemplate, handleIncome } = require("./commands/income");
const { expenseTemplate, handleExpense } = require("./commands/expense");
const { paymentTemplate, handlePayment } = require("./commands/payment");
const { handleToday, handleMonth, handleMyUnpaid, handleStock } = require("./commands/query");

let startDailyReport = null;
try {
  startDailyReport = require("./services/scheduledReport").startDailyReport;
} catch (err) {
  startDailyReport = null;
}

const app = express();

const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken,
});

app.get("/", (req, res) => {
  res.send("BadmintonBot V10 session stable is running");
});

app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    await Promise.all(req.body.events.map(handleEvent));
    res.status(200).end();
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

async function replyText(replyToken, text) {
  return client.replyMessage({
    replyToken,
    messages: [{ type: "text", text }],
  });
}

async function replyMessages(replyToken, messages) {
  return client.replyMessage({ replyToken, messages });
}

async function notifyGroupSafely(kind, user, resultText, event) {
  try {
    if (event?.source?.type === "group") {
      console.log("GROUP_NOTIFY_SKIPPED: source is group, reply only");
      return;
    }

    const notice = buildGroupNotice(kind, user, resultText);
    await pushGroupMessage(client, notice);
  } catch (err) {
    console.error("GROUP_NOTIFY_FAILED:", err.message);
  }
}

function incomeNoticeKind(resultText) {
  return resultText.includes("耗球記錄完成") ? "stock" : "income";
}

async function startMode(event, mode) {
  setSession(event, mode);

  if (mode === "income") return replyText(event.replyToken, await incomeTemplate());
  if (mode === "expense") return replyText(event.replyToken, await expenseTemplate());
  if (mode === "payment") return replyText(event.replyToken, paymentTemplate());

  return replyText(event.replyToken, "請重新輸入「收入」「支出」或「交款」。");
}

function isCancel(text) {
  return ["取消", "取消操作", "重新", "重來", "停止"].includes(text);
}

async function handleSessionInput(event, text, user) {
  const session = getSession(event);
  if (!session) return false;

  if (isCancel(text)) {
    clearSession(event);
    await replyText(event.replyToken, `已取消「${sessionName(session.mode)}」操作。`);
    return true;
  }

  let resultText = "";
  let kind = "";

  if (session.mode === "income") {
    resultText = await handleIncome(text, user);
    kind = incomeNoticeKind(resultText);
  } else if (session.mode === "expense") {
    resultText = await handleExpense(text, user);
    kind = "expense";
  } else if (session.mode === "payment") {
    resultText = await handlePayment(text, user);
    kind = "payment";
  } else {
    clearSession(event);
    return false;
  }

  clearSession(event);
  await notifyGroupSafely(kind, user, resultText, event);
  await replyText(event.replyToken, resultText);
  return true;
}

async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") return;

  const text = event.message.text.trim();
  const user = await getUser(client, event);

  try {
    if (text === "群組ID" || text.toLowerCase() === "groupid") {
      if (event.source?.type !== "group" || !event.source.groupId) {
        return replyText(event.replyToken, "這個指令請在球隊群組裡輸入，才會顯示 groupId。");
      }

      return replyText(
        event.replyToken,
        `✅ 這個群組的 LINE_GROUP_ID 是：

${event.source.groupId}

請到 Render → Environment 新增或修改：
LINE_GROUP_ID=${event.source.groupId}`
      );
    }

    if (text === "群組通知設定" || text === "通知設定") {
      return replyText(event.replyToken, groupConfigText());
    }

    if (text === "群組測試") {
      if (!hasGroupId()) {
        return replyText(event.replyToken, "❌ 尚未設定 LINE_GROUP_ID。請先在群組輸入「群組ID」，再把 ID 加到 Render Environment。");
      }
      await pushGroupMessage(client, `✅ 群組通知測試成功\n\n發送人：${user.name}\n時間：${new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}`);
      return replyText(event.replyToken, "✅ 已送出群組測試通知。");
    }

    if (text === "選單" || text === "功能" || text.toLowerCase() === "menu") {
      return replyMessages(event.replyToken, [mainMenuMessage()]);
    }

    // 查詢指令一定優先，且不寫入資料庫。
    if (text === "今天" || text === "今日" || text === "今日財務" || text === "今日報表") {
      clearSession(event);
      return replyText(event.replyToken, await handleToday());
    }

    if (text === "本月" || text === "月報" || text === "本月報表") {
      clearSession(event);
      return replyText(event.replyToken, await handleMonth());
    }

    if (text === "我的未交" || text === "未交款") {
      clearSession(event);
      return replyText(event.replyToken, await handleMyUnpaid(user));
    }

    if (text === "球庫存" || text === "庫存") {
      clearSession(event);
      return replyText(event.replyToken, await handleStock());
    }

    // 明確模式指令：建立 Session。下一則訊息 100% 走指定流程，不再猜。
    if (text === "收入" || text === "💰 收入" || text === "今日收入") {
      return startMode(event, "income");
    }

    if (text === "支出" || text === "💸 支出") {
      return startMode(event, "expense");
    }

    if (text === "交款" || text === "💵 交款" || text === "幹部交款") {
      return startMode(event, "payment");
    }

    // 有 Session 時直接照 Session 處理，不跑其他 parser。
    if (await handleSessionInput(event, text, user)) return;

    return;
  } catch (err) {
    console.error(err);
    return replyText(event.replyToken, `❌ 操作失敗

原因：${err.message}

請輸入「收入」「支出」或「交款」重新操作。`);
  }
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  if (typeof startDailyReport === "function") startDailyReport(client);
  console.log(`BadmintonBot V10 running on port ${port}`);
});
