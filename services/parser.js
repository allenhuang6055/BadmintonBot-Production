function normalizeText(text) {
  return String(text || "")
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(/[：﹕]/g, ":")
    .replace(/[＝]/g, "=")
    .replace(/[，、]/g, ",")
    .replace(/[＋]/g, "+")
    .replace(/\u3000/g, " ")
    .replace(/元/g, "")
    .replace(/塊/g, "")
    .replace(/顆/g, "")
    .replace(/颗/g, "")
    .replace(/粒/g, "")
    .trim();
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SYNONYMS = {
  零打: ["零打", "臨打", "临打", "零打收入", "臨打收入", "散打"],
  球券: ["球券", "球卷", "球劵", "球資", "球资", "球票", "球費", "球费", "球錢", "球钱", "打球費", "打球费"],
  會員: ["會員", "会员", "會員費", "会员费", "會費", "会费", "年費", "年费", "入會費", "入会费"],
  活動: ["活動", "活动", "活動費", "活动费", "活動收入", "聚會", "聚会"],
  贊助: ["贊助", "赞助", "捐款", "贊助費", "赞助费"],
  其他: ["其他", "其它", "雜項", "杂项", "其他收入"],
  耗球: ["耗球", "用球", "打球", "球耗", "消耗", "耗用"],

  買球: ["買球", "买球", "購球", "购球", "買羽球", "买羽球"],
  場租: ["場租", "场租", "租金", "場地", "场地", "場地費", "场地费"],
  聚餐: ["聚餐", "餐費", "餐费", "餐點", "餐点", "吃飯", "吃饭", "飲料", "饮料"],
  比賽: ["比賽", "比赛", "賽事", "赛事", "友誼賽", "友谊赛"],
  行政: ["行政", "文具", "影印"],
  雜支: ["雜支", "杂支", "雜費", "杂费"],

  交款: ["交款", "幹部交款", "干部交款", "繳回", "缴回", "上繳", "上缴", "交回"],
};

function aliasesFor(label) {
  const base = String(label || "").trim();
  const list = SYNONYMS[base] || [];
  return Array.from(new Set([base, ...list].filter(Boolean)));
}

function canonicalFromAlias(inputLabel) {
  const clean = String(inputLabel || "").replace(/\s/g, "");
  for (const [label, aliases] of Object.entries(SYNONYMS)) {
    for (const alias of [label, ...aliases]) {
      if (clean === String(alias || "").replace(/\s/g, "")) return label;
    }
  }
  return null;
}

function levenshtein(a, b) {
  a = String(a || "");
  b = String(b || "");
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

function parseLines(text) {
  return normalizeText(text).split(/\n|,|;/).map((line) => line.trim()).filter(Boolean);
}

function extractLabelAmount(line) {
  const m = String(line || "").match(/^(.+?)\s*[:=]?\s*([0-9][0-9,]*)\s*$/);
  if (!m) return null;
  const label = String(m[1] || "").trim();
  const amount = Number(String(m[2]).replace(/,/g, ""));
  if (!label || !Number.isFinite(amount)) return null;
  return { label, amount };
}

function bestMatchLabel(inputLabel, candidateLabels) {
  const clean = String(inputLabel || "").replace(/\s/g, "");
  const canonical = canonicalFromAlias(clean);

  // 明確是別的類別，就不能被目前候選類別吃掉。
  if (canonical && !candidateLabels.includes(canonical)) return null;

  let best = null;
  for (const label of candidateLabels) {
    for (const alias of aliasesFor(label)) {
      const a = String(alias || "").replace(/\s/g, "");
      const distance = levenshtein(clean, a);
      const threshold = Math.max(1, Math.floor(Math.max(clean.length, a.length) / 3));
      if (distance <= threshold) {
        if (!best || distance < best.distance) best = { label, alias, distance };
      }
    }
  }
  return best;
}

function parseAmount(text, label) {
  const normalized = normalizeText(text);
  for (const alias of aliasesFor(label)) {
    const a = escapeRegExp(alias);
    const patterns = [
      new RegExp(`${a}\\s*[:=]?\\s*([0-9][0-9,]*)`, "i"),
      new RegExp(`${a}\\s+([0-9][0-9,]*)`, "i"),
    ];
    for (const re of patterns) {
      const m = normalized.match(re);
      if (m) {
        const num = Number(String(m[1]).replace(/,/g, ""));
        if (Number.isFinite(num) && num >= 0) return num;
      }
    }
  }
  return 0;
}

function parseByFuzzyLines(text, candidateLabels) {
  const result = {};
  const matched = [];
  const unknown = [];
  for (const label of candidateLabels) result[label] = 0;

  for (const line of parseLines(text)) {
    if (/備註\s*[:=]?/i.test(line)) continue;
    if (/^(收入|支出|幹部交款|交款|付款|庫存)$/i.test(line)) continue;

    const parsed = extractLabelAmount(line);
    if (!parsed) continue;

    const exact = candidateLabels.find((label) => parseAmount(line, label) > 0);
    if (exact) {
      const amount = parseAmount(line, exact);
      result[exact] += amount;
      matched.push({ input: parsed.label, label: exact, amount, mode: "exact" });
      continue;
    }

    const fuzzy = bestMatchLabel(parsed.label, candidateLabels);
    if (fuzzy) {
      result[fuzzy.label] += parsed.amount;
      matched.push({ input: parsed.label, label: fuzzy.label, amount: parsed.amount, mode: "fuzzy", alias: fuzzy.alias, distance: fuzzy.distance });
    } else {
      unknown.push({ input: parsed.label, amount: parsed.amount, line });
    }
  }

  return { result, matched, unknown };
}

function parseNote(text) {
  const normalized = String(text || "").replace(/[：﹕]/g, ":").replace(/[＝]/g, "=");
  const m = normalized.match(/備註\s*[:=]?\s*(.*)/i);
  return m ? String(m[1] || "").trim() : "";
}

module.exports = {
  normalizeText,
  parseAmount,
  parseNote,
  aliasesFor,
  parseByFuzzyLines,
  bestMatchLabel,
  canonicalFromAlias,
};
