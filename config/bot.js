require("dotenv").config();

const express = require("express");
const line = require("@line/bot-sdk");
const { mainMenuMessage, secondMenuMessage } = require("./config/menu");

const app = express();

const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken,
});

app.get("/", (req, res) => {
  res.send("BadmintonBot V5 Lite is running");
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

async function reply(replyToken, messages) {
  return client.replyMessage({
    replyToken,
    messages,
  });
}

async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") return;

  const text = event.message.text.trim();

  if (text === "選單" || text === "功能") {
    return reply(event.replyToken, [
      mainMenuMessage(),
      secondMenuMessage(),
    ]);
  }

  if (text === "收入") {
    return reply(event.replyToken, [
      {
        type: "text",
        text:
`💰 收入

零打：0
球券：0
會員：0
其他：0

備註：`
      }
    ]);
  }

  if (text === "支出") {
    return reply(event.replyToken, [
      {
        type: "text",
        text:
`💸 支出

買球：0
場租：0
聚餐：0
其他：0

備註：`
      }
    ]);
  }

  if (text === "交款") {
    return reply(event.replyToken, [
      {
        type: "text",
        text:
`🏦 交款

交款：0

備註：`
      }
    ]);
  }

  if (text === "今天") {
    return reply(event.replyToken, [
      {
        type: "text",
        text: "📊 今天統計功能下一步接上。"
      }
    ]);
  }

  if (text === "本月") {
    return reply(event.replyToken, [
      {
        type: "text",
        text: "📅 本月統計功能下一步接上。"
      }
    ]);
  }

  if (text === "我的未交") {
    return reply(event.replyToken, [
      {
        type: "text",
        text: "👤 我的未交功能下一步接上。"
      }
    ]);
  }
}

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`BadmintonBot V5 Lite running on port ${port}`);
});