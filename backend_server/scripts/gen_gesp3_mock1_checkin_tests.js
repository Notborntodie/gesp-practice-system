/**
 * 生成 [GESP 3级 模拟1] 签到统计 的测试点。
 * 确定性生成：覆盖全到、部分到、无人到、边界 N/M、多人等。
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const binPath = path.join(__dirname, 'gesp3_mock1_checkin_ref');

function runCpp(inputStr) {
  const out = execSync(binPath, {
    input: inputStr,
    encoding: 'utf8',
    timeout: 30000,
  });
  return out.trim();
}

function main() {
  if (!fs.existsSync(binPath)) {
    console.error('请先在 scripts 目录编译：g++ -O2 -std=c++17 gesp3_mock1_checkin_ref.cpp -o gesp3_mock1_checkin_ref');
    process.exit(1);
  }

  const testCases = [];

  // 1. 样例：题面展示用，所有人都到了
  testCases.push({
    n: 3,
    m: 3,
    ids: [0, 2, 1],
    explanation: '样例：3 人全部签到，输出 3。',
  });

  // 2. 部分未到（1 人未到）
  testCases.push({ n: 3, m: 5, ids: [0, 0, 0, 0, 0] });

  // 3. 多人未到
  testCases.push({ n: 5, m: 2, ids: [0, 4] });

  // 4. 边界：N=2, M=1，一人未到
  testCases.push({ n: 2, m: 1, ids: [0] });

  // 5. 边界：N=2, M=2 都到
  testCases.push({ n: 2, m: 2, ids: [0, 1] });

  // 6. 中等规模，混合
  const ids6 = [];
  for (let i = 0; i < 20; i++) ids6.push(i % 10); // 0~9 各出现 2 次，共 10 人
  testCases.push({ n: 10, m: 20, ids: ids6 });

  // 7. 缺多个
  testCases.push({ n: 8, m: 4, ids: [1, 3, 5, 7] });

  // 8. 只签一个人，缺很多
  testCases.push({ n: 6, m: 3, ids: [2, 2, 2] });

  // 9. 较大 N/M
  const ids9 = [];
  for (let i = 0; i < 200; i++) ids9.push(i % 100);
  testCases.push({ n: 100, m: 200, ids: ids9 });

  // 10. 较大 N，缺中间一段
  const ids10 = [];
  for (let i = 0; i < 50; i++) ids10.push(i);
  for (let i = 60; i < 100; i++) ids10.push(i);
  testCases.push({ n: 100, m: 90, ids: ids10 });

  const results = [];
  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const inputStr = `${tc.n} ${tc.m}\n${tc.ids.join(' ')}\n`;
    const output = runCpp(inputStr);
    const sortOrder = i + 1;
    results.push({
      input: inputStr.trimEnd(),
      output,
      is_hidden: sortOrder > 5,
      is_displayed: sortOrder === 1,
      sort_order: sortOrder,
      explanation: tc.explanation || null,
    });
  }

  const outPath = path.join(__dirname, 'gesp3_mock1_checkin_tests.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log('已生成', results.length, '个测试点 ->', outPath);
}

main();
