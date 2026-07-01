require("dotenv").config();
const line = require("@line/bot-sdk");

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

async function main() {
  const richMenu = {
    size: {
      width: 2500,
      height: 1686,
    },
    selected: true,
    name: "健好羽球 V5 Lite",
    chatBarText: "健好羽球記帳",
    areas: [
      {
        bounds: { x: 0, y: 0, width: 833, height: 843 },
        action: { type: "message", text: "收入" },
      },
      {
        bounds: { x: 833, y: 0, width: 834, height: 843 },
        action: { type: "message", text: "支出" },
      },
      {
        bounds: { x: 1667, y: 0, width: 833, height: 843 },
        action: { type: "message", text: "交款" },
      },
      {
        bounds: { x: 0, y: 843, width: 833, height: 843 },
        action: { type: "message", text: "今天" },
      },
      {
        bounds: { x: 833, y: 843, width: 834, height: 843 },
        action: { type: "message", text: "本月" },
      },
      {
        bounds: { x: 1667, y: 843, width: 833, height: 843 },
        action: { type: "message", text: "我的未交" },
      },
    ],
  };

  const richMenuId = await client.createRichMenu(richMenu);
  await client.setDefaultRichMenu(richMenuId);

  console.log("✅ Rich Menu 建立成功");
  console.log("RichMenuId:", richMenuId);
}

main().catch(err => {
  console.error("❌ Rich Menu 建立失敗");
  console.error(err);
});