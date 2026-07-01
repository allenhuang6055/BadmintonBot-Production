require("dotenv").config();
const { google } = require("googleapis");

const DB_SHEET = "02_LINE資料庫";
const SETTINGS_SHEET = "08_項目設定";
const HOME_SHEET = "00_首頁";

function sheetRange(sheetName, range) {
  return `'${sheetName}'!${range}`;
}

function getGoogleAuth() {
  const options = {
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  };

  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    options.credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  } else {
    options.keyFile = process.env.GOOGLE_CREDENTIALS_PATH || "./credentials.json";
  }

  return new google.auth.GoogleAuth(options);
}

function getSheets() {
  return google.sheets({
    version: "v4",
    auth: getGoogleAuth(),
  });
}

async function getRows(sheetName, range = "A:AA") {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: sheetRange(sheetName, range),
  });
  return res.data.values || [];
}

async function findNextWriteRow(sheetName) {
  const rows = await getRows(sheetName, "A:A");
  let nextRow = 4;

  for (let i = 3; i < rows.length; i++) {
    if (rows[i] && rows[i][0]) nextRow = i + 2;
  }

  return nextRow;
}

async function writeRows(sheetName, values) {
  const sheets = getSheets();
  const nextRow = await findNextWriteRow(sheetName);
  const endRow = nextRow + values.length - 1;
  const targetRange = sheetRange(sheetName, `A${nextRow}:AA${endRow}`);

  console.log("WRITE_TARGET:", targetRange);
  console.log("WRITE_VALUES:", JSON.stringify(values));

  const res = await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: targetRange,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });

  console.log("WRITE_RESULT:", JSON.stringify(res.data));
  return res.data;
}

function taipeiDate() {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(new Date());
}

function taipeiNow() {
  return new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
}

function n(value) {
  const num = Number(String(value ?? "0").replace(/,/g, ""));
  return Number.isFinite(num) ? num : 0;
}

function normalizeBool(value) {
  const s = String(value ?? "").trim().toUpperCase();
  return ["TRUE", "YES", "Y", "1", "是", "啟用"].includes(s);
}

function formatStock(balls) {
  const value = Number(balls || 0);
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const tubes = Math.floor(abs / 12);
  const rest = abs % 12;
  if (rest === 0) return `${sign}${tubes}桶`;
  return `${sign}${tubes}桶 ${rest}顆`;
}

async function getEnabledItems(type) {
  try {
    const rows = await getRows(SETTINGS_SHEET, "A:F");
    const items = rows
      .slice(3)
      .filter((row) => String(row[0] || "").trim() === type)
      .filter((row) => normalizeBool(row[2]))
      .map((row) => ({
        item: String(row[1] || "").trim(),
        sort: Number(row[3] || 99),
      }))
      .filter((x) => x.item)
      .sort((a, b) => a.sort - b.sort)
      .map((x) => x.item);

    if (items.length) return items;
  } catch (err) {
    console.error("READ_SETTINGS_FAILED:", err.message);
  }

  if (type === "收入") return ["零打", "球券", "會員", "其他"];
  if (type === "支出") return ["買球", "場租", "聚餐", "雜支"];
  return [];
}

async function appendRecords(records, user) {
  if (!records.length) return null;

  const now = taipeiNow();

  const values = records.map((r) => {
    const income = r.income || 0;
    const expense = r.expense || 0;
    const ballsUsed = r.ballsUsed || 0;
    const ballsIn = r.ballsIn || 0;
    const payment = r.payment || 0;

    const raw = [
      r.date || taipeiDate(), // A
      user.id,                // B
      user.name,              // C
      r.type,                 // D
      r.item,                 // E
      income,                 // F
      expense,                // G
      ballsUsed,              // H
      ballsIn,                // I
      payment,                // J
      r.note || "",           // K
      "有效",                 // L
      now,                    // M
      "",                     // N
      "",                     // O
    ];

    const corrections = ["", "", "", "", "", "", ""]; // P:V

    const finals = [
      income,      // W 最終收入
      expense,     // X 最終支出
      ballsUsed,   // Y 最終耗球
      ballsIn,     // Z 最終入庫
      payment,     // AA 最終交款
    ];

    return raw.concat(corrections).concat(finals);
  });

  return writeRows(DB_SHEET, values);
}

function parseDate(value) {
  if (!value) return null;
  if (typeof value === "number") {
    return new Date((value - 25569) * 86400 * 1000);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isSameDay(dateText, now) {
  const d = parseDate(dateText);
  return (
    d &&
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isSameMonth(dateText, now) {
  const d = parseDate(dateText);
  return d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

async function getSummary(scope, userId = null) {
  const rows = await getRows(DB_SHEET, "A:AA");
  const now = new Date();

  let income = 0;
  let expense = 0;
  let payment = 0;
  let ballsUsed = 0;
  let ballsIn = 0;

  for (const row of rows.slice(3)) {
    const date = row[0];
    const lineId = row[1];
    const status = String(row[11] || "").trim() || "有效";

    if (status !== "有效") continue;
    if (userId && lineId !== userId) continue;

    const match = scope === "today" ? isSameDay(date, now) : isSameMonth(date, now);
    if (!match) continue;

    income += n(row[22] ?? row[5]);
    expense += n(row[23] ?? row[6]);
    ballsUsed += n(row[24] ?? row[7]);
    ballsIn += n(row[25] ?? row[8]);
    payment += n(row[26] ?? row[9]);
  }

  return {
    income,
    expense,
    payment,
    ballsUsed,
    ballsIn,
    profit: income - expense,
    unpaid: income - payment,
  };
}

async function getCurrentStock() {
  const rows = await getRows(DB_SHEET, "A:AA");
  let ballsUsed = 0;
  let ballsIn = 0;

  for (const row of rows.slice(3)) {
    const status = String(row[11] || "").trim() || "有效";
    if (status !== "有效") continue;

    ballsUsed += n(row[24] ?? row[7]);
    ballsIn += n(row[25] ?? row[8]);
  }

  let initialStock = 0;
  try {
    const homeRows = await getRows(HOME_SHEET, "B6:B6");
    initialStock = n(homeRows[0]?.[0]);
  } catch (err) {
    console.error("READ_INITIAL_STOCK_FAILED:", err.message);
  }

  return initialStock + ballsIn - ballsUsed;
}

async function getCurrentBalance() {
  let initialCash = 0;
  try {
    const homeRows = await getRows(HOME_SHEET, "B5:B5");
    initialCash = n(homeRows[0]?.[0]);
  } catch (err) {
    console.error("READ_INITIAL_CASH_FAILED:", err.message);
  }

  const rows = await getRows(DB_SHEET, "A:AA");
  let income = 0;
  let expense = 0;

  for (const row of rows.slice(3)) {
    const status = String(row[11] || "").trim() || "有效";
    if (status !== "有效") continue;
    income += n(row[22] ?? row[5]);
    expense += n(row[23] ?? row[6]);
  }

  return initialCash + income - expense;
}

async function getSafetyCash() {
  try {
    const rows = await getRows("07_年度預算", "B5:B5");
    const value = n(rows[0]?.[0]);
    if (value > 0) return value;
  } catch (err) {
    console.error("READ_SAFETY_CASH_FAILED:", err.message);
  }
  return 150000;
}

function getCashStatus(balance, safetyCash) {
  if (balance >= safetyCash) return "🟢 財務狀況：正常";
  return "🔴 財務狀況：低於安全水位，請留意支出。";
}

function getStockStatus(balls) {
  if (Number(balls || 0) < 120) return "⚠️ 庫存狀態：偏低，建議補貨。";
  return "🟢 庫存狀態：正常";
}

module.exports = {
  getEnabledItems,
  appendRecords,
  getSummary,
  getCurrentStock,
  formatStock,
  getCurrentBalance,
  getSafetyCash,
  getCashStatus,
  getStockStatus,
};
