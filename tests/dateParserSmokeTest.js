const { parseRecordDate } = require("../services/dateParser");

function assert(name, condition) {
  if (!condition) {
    console.error(`❌ ${name}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${name}`);
  }
}

assert("full date", parseRecordDate("日期：2026/07/01\n零打500") === "2026/07/01");
assert("dash date", parseRecordDate("補單日期=2026-7-2") === "2026/07/02");
assert("no date", parseRecordDate("零打500") === null);
