/**
 * [GESP202603 四级] 山谷（二维矩阵谷格）：生成 10 组测试点。
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const binPath = path.join(__dirname, 'valley_ref');

function runCpp(inputStr) {
  const out = execSync(binPath, { input: inputStr, encoding: 'utf8', timeout: 10000 });
  return out.trimEnd();
}

function buildInput(n, m, rows) {
  const lines = [`${n} ${m}`];
  for (let i = 0; i < n; i++) lines.push(rows[i].join(' '));
  return lines.join('\n');
}

function main() {
  if (!fs.existsSync(binPath)) {
    console.error('请先编译: g++ -O2 -std=c++17 valley_ref.cpp -o valley_ref');
    process.exit(1);
  }

  const testInputs = [];

  // 1. 题面样例 3×3 -> 3 个山谷
  testInputs.push({
    input: buildInput(3, 3, [
      [5, 4, 3],
      [2, 1, 2],
      [1, 1, 2],
    ]),
    label: '样例',
  });

  // 2. 1×1
  testInputs.push({ input: buildInput(1, 1, [[1]]), label: '1x1' });

  // 3. 全同值，每格都是山谷
  testInputs.push({
    input: buildInput(2, 2, [[5, 5], [5, 5]]),
    label: '2x2全同',
  });

  // 4. 2×3
  testInputs.push({
    input: buildInput(2, 3, [[3, 2, 3], [2, 1, 2]]),
    label: '2x3',
  });

  // 5. 单行
  testInputs.push({
    input: buildInput(1, 4, [[2, 1, 1, 2]]),
    label: '1x4',
  });

  // 6-10 确定性生成 n×m 矩阵
  const seeds = [42, 17, 99, 5, 31];
  for (let i = 0; i < seeds.length; i++) {
    const n = 2 + (seeds[i] % 8);
    const m = 2 + (seeds[i] * 7 % 8);
    const rows = [];
    for (let r = 0; r < n; r++) {
      const row = [];
      for (let c = 0; c < m; c++)
        row.push(1 + (seeds[i] * (r * m + c + 1) * 13) % 100);
      rows.push(row);
    }
    testInputs.push({ input: buildInput(n, m, rows), label: `gen_${i}` });
  }

  const results = [];
  for (let i = 0; i < testInputs.length; i++) {
    const output = runCpp(testInputs[i].input);
    const sortOrder = i + 1;
    results.push({
      input: testInputs[i].input,
      output,
      is_hidden: sortOrder > 5,
      is_displayed: sortOrder === 1,
      sort_order: sortOrder,
      explanation: sortOrder === 1 ? '题面样例：位置 (2,2)、(3,1)、(3,2) 的高程均为 1，均不大于其八邻，故共 3 个山谷。' : null,
    });
  }

  fs.writeFileSync(path.join(__dirname, 'valley_tests.json'), JSON.stringify(results, null, 2), 'utf8');
  console.log('已生成', results.length, '个测试点 -> valley_tests.json');
}

main();
