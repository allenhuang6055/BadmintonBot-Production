function taipeiTodayParts() {
  const parts = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());

  return {
    year: Number(parts.find((p) => p.type === "year")?.value),
    month: Number(parts.find((p) => p.type === "month")?.value),
    day: Number(parts.find((p) => p.type === "day")?.value),
  };
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function isValidDate(y, m, d) {
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

function formatDate(y, m, d) {
  return `${y}/${pad2(m)}/${pad2(d)}`;
}

function parseRecordDate(text) {
  const raw = String(text || "").replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0));

  let m = raw.match(/(日期|補單日期|补单日期|記帳日期|记帐日期|日)\s*[:：=]?\s*(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/i);
  if (m) {
    const y = Number(m[2]);
    const mo = Number(m[3]);
    const d = Number(m[4]);
    if (isValidDate(y, mo, d)) return formatDate(y, mo, d);
  }

  m = raw.match(/(日期|補單日期|补单日期|記帳日期|记帐日期|日)\s*[:：=]?\s*(\d{1,2})[\/\-\.](\d{1,2})/i);
  if (m) {
    const today = taipeiTodayParts();
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (isValidDate(today.year, mo, d)) return formatDate(today.year, mo, d);
  }

  return null;
}

module.exports = {
  parseRecordDate,
};
