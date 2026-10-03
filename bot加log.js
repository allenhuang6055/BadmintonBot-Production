require("dotenv").config();

const express = require("express");
const line = require("@line/bot-sdk");

const { mainMenuMessage } = require("./config/menu");
const { getUser } = require("./services/lineUser");

const {
  pushGroupMessage,
  buildGroupNotice,
  groupConfigText,
  hasGroupId,
} = require("./services/groupNotify");

const {
  setSession,
  getSession,
  clearSession,
  sessionName,
} = require("./services/sessionStore");

const {
  incomeTemplate,
  handleIncome,
} = require("./commands/income");

const {
  expenseTemplate,
  handleExpense,
} = require("./commands/expense");

const {
  paymentTemplate,
  handlePayment,
} = require("./commands/payment");

const {
  handleToday,
  handleMonth,
  handleMyUnpaid,
  handleStock,
} = require("./commands/query");

let startDailyReport = null;

try {
  startDailyReport =
    require("./services/scheduledReport").startDailyReport;
} catch (err) {
  console.error(
    "SCHEDULED_REPORT_LOAD_FAILED:",
    err?.message || err
  );

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

/*
 * 暫存近期收到的 webhookEventId。
 * 用來判斷同一個事件是否被 LINE 重送。
 *
 * 注意：
 * Render 重新啟動後，這份記錄會清空，
 * 這是正常現象。
 */
const recentWebhookEvents = new Map();

const WEBHOOK_EVENT_KEEP_MS = 10 * 60 * 1000;

function cleanupWebhookEvents() {
  const now = Date.now();

  for (const [eventId, receivedAt] of recentWebhookEvents.entries()) {
    if (now - receivedAt > WEBHOOK_EVENT_KEEP_MS) {
      recentWebhookEvents.delete(eventId);
    }
  }
}

function maskValue(value, visibleLength = 6) {
  const text = String(value || "");

  if (!text) {
    return "(empty)";
  }

  if (text.length <= visibleLength * 2) {
    return text;
  }

  return `${text.slice(0, visibleLength)}...${text.slice(
    -visibleLength
  )}`;
}

function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (err) {
    return String(value);
  }
}

function getErrorStatus(err) {
  return (
    err?.status ||
    err?.statusCode ||
    err?.response?.status ||
    err?.response?.statusCode ||
    ""
  );
}

function getErrorHeaders(err) {
  return (
    err?.response?.headers ||
    err?.headers ||
    err?.originalError?.response?.headers ||
    null
  );
}

function getErrorBody(err) {
  return (
    err?.response?.data ||
    err?.body ||
    err?.responseBody ||
    err?.originalError?.response?.data ||
    null
  );
}

function getRetryAfter(headers) {
  if (!headers) {
    return "";
  }

  return (
    headers["retry-after"] ||
    headers["Retry-After"] ||
    headers.get?.("retry-after") ||
    ""
  );
}

function logLineError(label, err) {
  const status = getErrorStatus(err);
  const headers = getErrorHeaders(err);
  const body = getErrorBody(err);
  const retryAfter = getRetryAfter(headers);

  console.error("");
  console.error("========================================");
  console.error(label);
  console.error("========================================");
  console.error("Status       :", status || "(unknown)");
  console.error(
    "Message      :",
    err?.message || String(err)
  );
  console.error(
    "Retry-After  :",
    retryAfter || "(not provided)"
  );
  console.error("Headers      :", safeJson(headers));
  console.error("Response Body:", safeJson(body));
  console.error(
    "Stack        :",
    err?.stack || "(no stack)"
  );
  console.error("========================================");
  console.error("");
}

function logEventStart(event) {
  cleanupWebhookEvents();

  const eventId = event?.webhookEventId || "";
  const firstReceivedAt = recentWebhookEvents.get(eventId);
  const isDuplicate =
    Boolean(eventId) && Boolean(firstReceivedAt);

  if (eventId && !firstReceivedAt) {
    recentWebhookEvents.set(eventId, Date.now());
  }

  console.log("");
  console.log("================================================");
  console.log("EVENT START");
  console.log("================================================");
  console.log(
    "WebhookEventId :",
    eventId || "(not provided)"
  );
  console.log(
    "Duplicate      :",
    isDuplicate ? "YES" : "NO"
  );
  console.log(
    "Delivery Mode  :",
    event?.deliveryContext?.isRedelivery
      ? "REDELIVERY"
      : "NORMAL"
  );
  console.log(
    "ReplyToken     :",
    maskValue(event?.replyToken)
  );
  console.log(
    "Timestamp      :",
    event?.timestamp || ""
  );
  console.log(
    "Event Type     :",
    event?.type || ""
  );
  console.log(
    "Message Type   :",
    event?.message?.type || ""
  );
  console.log(
    "Text           :",
    event?.message?.text || ""
  );
  console.log(
    "Source Type    :",
    event?.source?.type || ""
  );
  console.log(
    "UserId         :",
    maskValue(event?.source?.userId)
  );
  console.log(
    "GroupId        :",
    maskValue(event?.source?.groupId)
  );
  console.log(
    "RoomId         :",
    maskValue(event?.source?.roomId)
  );
  console.log("================================================");

  return {
    eventId,
    isDuplicate,
  };
}

app.get("/", (req, res) => {
  res.send("BadmintonBot V10.1 Debug is running");
});

app.post(
  "/webhook",
  line.middleware(config),
  async (req, res) => {
    const webhookStart = Date.now();

    console.log("");
    console.log("################################################");
    console.log("WEBHOOK REQUEST START");
    console.log(
      "Event Count:",
      Array.isArray(req.body?.events)
        ? req.body.events.length
        : 0
    );
    console.log("################################################");

    try {
      await Promise.all(
        (req.body?.events || []).map(handleEvent)
      );

      console.log(
        "WEBHOOK REQUEST SUCCESS:",
        `${Date.now() - webhookStart} ms`
      );

      res.status(200).end();
    } catch (err) {
      logLineError("WEBHOOK REQUEST FAILED", err);

      res.status(500).end();
    }
  }
);

async function replyText(replyToken, text) {
  const start = Date.now();

  console.log("");
  console.log("REPLY START");
  console.log(
    "ReplyToken:",
    maskValue(replyToken)
  );
  console.log(
    "Text Preview:",
    String(text || "").slice(0, 150)
  );

  try {
    const result = await client.replyMessage({
      replyToken,
      messages: [
        {
          type: "text",
          text,
        },
      ],
    });

    console.log(
      "REPLY SUCCESS:",
      `${Date.now() - start} ms`
    );

    return result;
  } catch (err) {
    console.error(
      "REPLY FAILED AFTER:",
      `${Date.now() - start} ms`
    );

    logLineError("REPLY MESSAGE FAILED", err);

    throw err;
  }
}

async function replyMessages(replyToken, messages) {
  const start = Date.now();

  console.log("");
  console.log("REPLY MULTIPLE START");
  console.log(
    "ReplyToken:",
    maskValue(replyToken)
  );
  console.log(
    "Message Count:",
    Array.isArray(messages)
      ? messages.length
      : 0
  );

  try {
    const result = await client.replyMessage({
      replyToken,
      messages,
    });

    console.log(
      "REPLY MULTIPLE SUCCESS:",
      `${Date.now() - start} ms`
    );

    return result;
  } catch (err) {
    console.error(
      "REPLY MULTIPLE FAILED AFTER:",
      `${Date.now() - start} ms`
    );

    logLineError(
      "REPLY MULTIPLE MESSAGE FAILED",
      err
    );

    throw err;
  }
}

async function notifyGroupSafely(
  kind,
  user,
  resultText,
  event
) {
  const start = Date.now();

  console.log("");
  console.log("GROUP_NOTIFY_START");
  console.log("Kind       :", kind);
  console.log(
    "User       :",
    user?.name || "(unknown)"
  );
  console.log(
    "Source Type:",
    event?.source?.type || ""
  );
  console.log(
    "Event ID   :",
    event?.webhookEventId || ""
  );

  try {
    if (event?.source?.type === "group") {
      console.log(
        "GROUP_NOTIFY_SKIPPED: source is group, reply only"
      );

      return false;
    }

    if (!hasGroupId()) {
      console.log(
        "GROUP_NOTIFY_SKIPPED: LINE_GROUP_ID is empty"
      );

      return false;
    }

    const notice = buildGroupNotice(
      kind,
      user,
      resultText
    );

    console.log(
      "Notice Preview:",
      notice.slice(0, 200)
    );

    await pushGroupMessage(client, notice);

    console.log(
      "GROUP_NOTIFY_SUCCESS:",
      `${Date.now() - start} ms`
    );

    return true;
  } catch (err) {
    console.error(
      "GROUP_NOTIFY_FAILED AFTER:",
      `${Date.now() - start} ms`
    );

    logLineError(
      "GROUP NOTIFY FAILED",
      err
    );

    return false;
  }
}

function incomeNoticeKind(resultText) {
  return resultText.includes("耗球記錄完成")
    ? "stock"
    : "income";
}

async function startMode(event, mode) {
  console.log("");
  console.log("START_MODE:", mode);

  setSession(event, mode);

  if (mode === "income") {
    const template = await incomeTemplate();

    return replyText(
      event.replyToken,
      template
    );
  }

  if (mode === "expense") {
    const template = await expenseTemplate();

    return replyText(
      event.replyToken,
      template
    );
  }

  if (mode === "payment") {
    return replyText(
      event.replyToken,
      paymentTemplate()
    );
  }

  clearSession(event);

  return replyText(
    event.replyToken,
    "請重新輸入「收入」「支出」或「交款」。"
  );
}

function isCancel(text) {
  return [
    "取消",
    "取消操作",
    "重新",
    "重來",
    "停止",
  ].includes(text);
}

async function handleSessionInput(
  event,
  text,
  user
) {
  const session = getSession(event);

  console.log("");
  console.log(
    "SESSION CHECK:",
    session
      ? session.mode
      : "(no session)"
  );

  if (!session) {
    return false;
  }

  if (isCancel(text)) {
    clearSession(event);

    await replyText(
      event.replyToken,
      `已取消「${sessionName(
        session.mode
      )}」操作。`
    );

    return true;
  }

  const processStart = Date.now();

  let resultText = "";
  let kind = "";

  console.log(
    "SESSION PROCESS START:",
    session.mode
  );

  if (session.mode === "income") {
    const incomeStart = Date.now();

    console.log("HANDLE_INCOME_START");

    resultText = await handleIncome(
      text,
      user
    );

    console.log(
      "HANDLE_INCOME_SUCCESS:",
      `${Date.now() - incomeStart} ms`
    );

    kind = incomeNoticeKind(resultText);
  } else if (session.mode === "expense") {
    const expenseStart = Date.now();

    console.log("HANDLE_EXPENSE_START");

    resultText = await handleExpense(
      text,
      user
    );

    console.log(
      "HANDLE_EXPENSE_SUCCESS:",
      `${Date.now() - expenseStart} ms`
    );

    kind = "expense";
  } else if (session.mode === "payment") {
    const paymentStart = Date.now();

    console.log("HANDLE_PAYMENT_START");

    resultText = await handlePayment(
      text,
      user
    );

    console.log(
      "HANDLE_PAYMENT_SUCCESS:",
      `${Date.now() - paymentStart} ms`
    );

    kind = "payment";
  } else {
    clearSession(event);

    console.log(
      "SESSION MODE UNKNOWN:",
      session.mode
    );

    return false;
  }

  clearSession(event);

  console.log(
    "SESSION CLEARED:",
    session.mode
  );

  /*
   * 先回覆操作人。
   * 群組通知即使失敗，也不能影響這個回覆。
   */
  await replyText(
    event.replyToken,
    resultText
  );

  /*
   * 群組通知採背景執行。
   * 不使用 await，不阻塞主要 webhook。
   */
  console.log(
    "GROUP_NOTIFY_BACKGROUND_QUEUED"
  );

  void notifyGroupSafely(
    kind,
    user,
    resultText,
    event
  ).catch((err) => {
    logLineError(
      "GROUP NOTIFY BACKGROUND UNEXPECTED FAILED",
      err
    );
  });

  console.log(
    "SESSION PROCESS SUCCESS:",
    `${Date.now() - processStart} ms`
  );

  return true;
}

async function handleEvent(event) {
  const eventStart = Date.now();

  const {
    eventId,
    isDuplicate,
  } = logEventStart(event);

  try {
    if (
      event.type !== "message" ||
      event.message?.type !== "text"
    ) {
      console.log(
        "EVENT SKIPPED: not a text message"
      );

      return;
    }

    /*
     * 只記錄是否重複，目前不直接略過。
     * 先觀察 Log，確認 LINE 是否真的重送。
     */
    if (isDuplicate) {
      console.warn(
        "WARNING: DUPLICATE WEBHOOK EVENT DETECTED:",
        eventId
      );
    }

    const text =
      event.message.text.trim();

    const userStart = Date.now();

    console.log("GET_USER_START");

    const user = await getUser(
      client,
      event
    );

    console.log(
      "GET_USER_SUCCESS:",
      `${Date.now() - userStart} ms`,
      user?.name || "(unknown)"
    );

    if (
      text === "群組ID" ||
      text.toLowerCase() === "groupid"
    ) {
      if (
        event.source?.type !== "group" ||
        !event.source.groupId
      ) {
        return replyText(
          event.replyToken,
          "這個指令請在球隊群組裡輸入，才會顯示 groupId。"
        );
      }

      return replyText(
        event.replyToken,
        `✅ 這個群組的 LINE_GROUP_ID 是：

${event.source.groupId}

請到 Render → Environment 新增或修改：
LINE_GROUP_ID=${event.source.groupId}`
      );
    }

    if (
      text === "群組通知設定" ||
      text === "通知設定"
    ) {
      return replyText(
        event.replyToken,
        groupConfigText()
      );
    }

    if (text === "群組測試") {
      if (!hasGroupId()) {
        return replyText(
          event.replyToken,
          "❌ 尚未設定 LINE_GROUP_ID。請先在群組輸入「群組ID」，再把 ID 加到 Render Environment。"
        );
      }

      /*
       * 群組測試仍然要等推播結果，
       * 才能明確告訴使用者成功或失敗。
       */
      const testText = `✅ 群組通知測試成功

發送人：${user.name}
時間：${new Date().toLocaleString(
        "zh-TW",
        {
          timeZone: "Asia/Taipei",
        }
      )}`;

      try {
        console.log(
          "GROUP_TEST_PUSH_START"
        );

        await pushGroupMessage(
          client,
          testText
        );

        console.log(
          "GROUP_TEST_PUSH_SUCCESS"
        );

        return replyText(
          event.replyToken,
          "✅ 已送出群組測試通知。"
        );
      } catch (err) {
        logLineError(
          "GROUP TEST PUSH FAILED",
          err
        );

        return replyText(
          event.replyToken,
          `❌ 群組測試通知失敗

狀態碼：${getErrorStatus(err) || "未知"}
原因：${err?.message || "LINE 群組通知發送失敗"}

請稍後再試。`
        );
      }
    }

    if (
      text === "選單" ||
      text === "功能" ||
      text.toLowerCase() === "menu"
    ) {
      return replyMessages(
        event.replyToken,
        [mainMenuMessage()]
      );
    }

    /*
     * 查詢指令優先。
     * 查詢不寫入資料庫。
     */
    if (
      text === "今天" ||
      text === "今日" ||
      text === "今日財務" ||
      text === "今日報表"
    ) {
      clearSession(event);

      const result =
        await handleToday();

      return replyText(
        event.replyToken,
        result
      );
    }

    if (
      text === "本月" ||
      text === "月報" ||
      text === "本月報表"
    ) {
      clearSession(event);

      const result =
        await handleMonth();

      return replyText(
        event.replyToken,
        result
      );
    }

    if (
      text === "我的未交" ||
      text === "未交款"
    ) {
      clearSession(event);

      const result =
        await handleMyUnpaid(user);

      return replyText(
        event.replyToken,
        result
      );
    }

    if (
      text === "球庫存" ||
      text === "庫存"
    ) {
      clearSession(event);

      const result =
        await handleStock();

      return replyText(
        event.replyToken,
        result
      );
    }

    /*
     * 明確模式指令。
     */
    if (
      text === "收入" ||
      text === "💰 收入" ||
      text === "今日收入"
    ) {
      return startMode(
        event,
        "income"
      );
    }

    if (
      text === "支出" ||
      text === "💸 支出"
    ) {
      return startMode(
        event,
        "expense"
      );
    }

    if (
      text === "交款" ||
      text === "💵 交款" ||
      text === "幹部交款"
    ) {
      return startMode(
        event,
        "payment"
      );
    }

    /*
     * 有 Session 時，
     * 直接按照 Session 處理。
     */
    const handled =
      await handleSessionInput(
        event,
        text,
        user
      );

    if (handled) {
      return;
    }

    console.log(
      "EVENT NO MATCHED COMMAND:",
      text
    );

    return;
  } catch (err) {
    logLineError(
      "HANDLE EVENT FAILED",
      err
    );

    try {
      await replyText(
        event.replyToken,
        `❌ 操作失敗

原因：${err?.message || "未知錯誤"}

請輸入「收入」「支出」或「交款」重新操作。`
      );
    } catch (replyErr) {
      logLineError(
        "ERROR REPLY FAILED",
        replyErr
      );
    }
  } finally {
    console.log(
      "EVENT FINISH:",
      eventId || "(no event id)",
      `${Date.now() - eventStart} ms`
    );

    console.log(
      "================================================"
    );
    console.log("");
  }
}

const port =
  process.env.PORT || 3000;

app.listen(port, () => {
  console.log("");
  console.log(
    "=========================================="
  );
  console.log(
    "BadmintonBot V10.1 DEBUG STARTED"
  );
  console.log(
    "=========================================="
  );
  console.log(
    "Node Version   :",
    process.version
  );
  console.log(
    "Environment    :",
    process.env.NODE_ENV || "development"
  );
  console.log(
    "Port           :",
    port
  );
  console.log(
    "LINE_GROUP_ID  :",
    maskValue(
      process.env.LINE_GROUP_ID
    )
  );
  console.log(
    "Channel Secret :",
    process.env.LINE_CHANNEL_SECRET
      ? "SET"
      : "NOT SET"
  );
  console.log(
    "Access Token   :",
    process.env.LINE_CHANNEL_ACCESS_TOKEN
      ? "SET"
      : "NOT SET"
  );
  console.log(
    "Start Time     :",
    new Date().toLocaleString(
      "zh-TW",
      {
        timeZone: "Asia/Taipei",
      }
    )
  );
  console.log(
    "=========================================="
  );
  console.log("");

  if (
    typeof startDailyReport ===
    "function"
  ) {
    try {
      startDailyReport(client);

      console.log(
        "DAILY_REPORT_STARTED"
      );
    } catch (err) {
      logLineError(
        "START DAILY REPORT FAILED",
        err
      );
    }
  } else {
    console.log(
      "DAILY_REPORT_NOT_AVAILABLE"
    );
  }
});