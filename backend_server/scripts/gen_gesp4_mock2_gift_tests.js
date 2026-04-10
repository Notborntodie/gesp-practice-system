/**
 * 生成 [GESP 4级 模拟2] 礼物分配（人数优先再满意度）的测试点。
 * 每组：n, C，以及 n 个 (a_i, v_i)。
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const binPath = path.join(__dirname, 'gesp4_mock2_gift_ref');

function runCpp(inputStr) {
  const out = execSync(binPath, {
    input: inputStr,
    encoding: 'utf8',
    timeout: 30000,
  });
  return out.trim();
}

function buildInput(n, C, items) {
  let s = n + ' ' + C + '\n';
  for (const [a, v] of items) s += a + ' ' + v + '\n';
  return s.trimEnd();
}

function main() {
  if (!fs.existsSync(binPath)) {
    console.error('请先在 scripts 目录编译：g++ -O2 -std=c++17 gesp4_mock2_gift_ref.cpp -o gesp4_mock2_gift_ref');
    process.exit(1);
  }

  const testCases = [];

  // 1. 样例：多关键字体现同需求选满意度高的
  testCases.push({
    n: 4, C: 10,
    items: [[3, 5], [2, 1], [5, 20], [4, 10]],
    explanation: '排序后 (2,1)(3,5)(4,10)(5,20)。分 2,3,4 后剩 1，最多 3 人，总满意度 1+5+10=16。',
  });

  // 2. 全满足
  testCases.push({ n: 3, C: 60, items: [[10, 1], [20, 2], [30, 3]] });

  // 3. 满足 0 人
  testCases.push({ n: 2, C: 1, items: [[5, 10], [10, 20]] });

  // 4. 单人
  testCases.push({ n: 1, C: 7, items: [[7, 100]] });

  // 5. 同需求不同满意度，选满意度高的
  testCases.push({ n: 4, C: 8, items: [[2, 1], [2, 5], [2, 3], [2, 4]] });

  // 6. 确定性 10 人
  const t6 = [];
  for (let i = 0; i < 10; i++) t6.push([(i * 3 + 1) % 5 + 1, (i * 7 + 2) % 20 + 1]);
  testCases.push({ n: 10, C: 20, items: t6 });

  // 7. C=0
  testCases.push({ n: 3, C: 0, items: [[1, 10], [2, 20], [3, 30]] });

  // 8. 规模稍大
  const t8 = [];
  for (let i = 0; i < 15; i++) t8.push([(i * 7 + 2) % 10 + 1, (i * 11 + 5) % 50 + 1]);
  testCases.push({ n: 15, C: 50, items: t8 });

  // 9. 同需求选前几个（按 v 降序）
  testCases.push({ n: 5, C: 6, items: [[2, 100], [2, 90], [2, 80], [2, 70], [2, 60]] });

  // 10. 混合
  testCases.push({ n: 6, C: 15, items: [[1, 1], [2, 5], [3, 8], [4, 2], [5, 10], [6, 3]] });

  const results = [];
  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const inputStr = buildInput(tc.n, tc.C, tc.items);
    const output = runCpp(inputStr);
    const sortOrder = i + 1;
    results.push({
      input: inputStr,
      output,
      is_hidden: sortOrder > 5,
      is_displayed: sortOrder === 1,
      sort_order: sortOrder,
      explanation: tc.explanation || null,
    });
  }

  const outPath = path.join(__dirname, 'gesp4_mock2_gift_tests.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log('已生成', results.length, '个测试点 ->', outPath);
}

main();
