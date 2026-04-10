/**
 * 小杨的智慧购物：每类文具只买最便宜的一件，求总花费。生成 10 个测试点。
 */
const fs = require('fs');
const path = require('path');

function run(inputStr) {
  const lines = inputStr.trim().split('\n');
  const [M, N] = lines[0].split(/\s+/).map(Number);
  const minPrice = Array(M + 1).fill(10000);
  for (let i = 1; i <= N && i < lines.length; i++) {
    const [K, P] = lines[i].split(/\s+/).map(Number);
    if (K >= 1 && K <= M) minPrice[K] = Math.min(minPrice[K], P);
  }
  let total = 0;
  for (let k = 1; k <= M; k++) total += minPrice[k];
  return String(total);
}

const sampleInput = `2 5
1 1
1 2
1 1
2 3
2 10`;
const sampleOutput = run(sampleInput);

const testCases = [
  { input: sampleInput, output: sampleOutput, is_displayed: true, is_hidden: false, sort_order: 1, explanation: '样例：类别 1 最便宜 1，类别 2 最便宜 3，总花费 4。' },
  { input: '1 3\n1 5\n1 2\n1 8', output: '2', is_displayed: false, is_hidden: false, sort_order: 2, explanation: null },
  { input: '3 6\n1 10\n2 20\n3 30\n1 5\n2 15\n3 25', output: '45', is_displayed: false, is_hidden: false, sort_order: 3, explanation: null },
  { input: '2 4\n1 7\n1 3\n2 9\n2 3', output: '6', is_displayed: false, is_hidden: false, sort_order: 4, explanation: null },
  { input: '5 10\n1 1\n2 2\n3 3\n4 4\n5 5\n1 10\n2 20\n3 30\n4 40\n5 50', output: '15', is_displayed: false, is_hidden: false, sort_order: 5, explanation: null },
  { input: '4 8\n1 100\n2 50\n3 80\n4 60\n1 90\n2 40\n3 70\n4 55', output: '255', is_displayed: false, is_hidden: true, sort_order: 6, explanation: null },
  { input: '3 7\n1 5\n1 5\n2 3\n2 4\n3 1\n3 1\n3 2', output: '9', is_displayed: false, is_hidden: true, sort_order: 7, explanation: null },
  { input: '6 12\n1 2\n2 3\n3 4\n4 5\n5 6\n6 7\n1 1\n2 2\n3 3\n4 4\n5 5\n6 6', output: '21', is_displayed: false, is_hidden: true, sort_order: 8, explanation: null },
  { input: '2 3\n1 999\n2 1000\n1 1', output: '1001', is_displayed: false, is_hidden: true, sort_order: 9, explanation: null },
  { input: '1 1\n1 42', output: '42', is_displayed: false, is_hidden: true, sort_order: 10, explanation: null },
];

const results = testCases.map(tc => ({
  input: tc.input,
  output: tc.output,
  is_hidden: tc.is_hidden,
  is_displayed: tc.is_displayed,
  sort_order: tc.sort_order,
  explanation: tc.explanation || null,
}));

fs.writeFileSync(path.join(__dirname, 'smart_shopping_tests.json'), JSON.stringify(results, null, 2), 'utf8');
console.log('已生成', results.length, '个测试点 -> smart_shopping_tests.json');
