const { parseByFuzzyLines } = require("../services/parser");

function assert(name, condition, detail = "") {
  if (!condition) {
    console.error(`❌ ${name} failed ${detail}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${name}`);
  }
}

const incomeLabels = ["零打", "球券", "會員", "活動", "贊助", "其他", "耗球"];
const expenseLabels = ["買球", "場租", "聚餐", "比賽", "行政", "雜支", "其他"];

const income = parseByFuzzyLines("零打：500\n球券：600\n會員：800\n其他：890\n耗球：59", incomeLabels);
assert("income 零打", income.result["零打"] === 500);
assert("income 球券", income.result["球券"] === 600);
assert("income 會員", income.result["會員"] === 800);
assert("income 其他", income.result["其他"] === 890);
assert("income 耗球", income.result["耗球"] === 59);

const expense = parseByFuzzyLines("買球：5\n場租：66\n餐點：4\n雜支：4\n其他：4", expenseLabels);
assert("expense 買球", expense.result["買球"] === 5);
assert("expense 場租", expense.result["場租"] === 66);
assert("expense 餐點->聚餐", expense.result["聚餐"] === 4);
assert("expense 雜支", expense.result["雜支"] === 4);
assert("expense 其他", expense.result["其他"] === 4);
