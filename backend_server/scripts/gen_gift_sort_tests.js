/**
 * [GESP202603 四级] 礼物排序：生成 10 组测试点。
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const binPath = path.join(__dirname, 'gift_sort_ref');

function runCpp(inputStr) {
  const out = execSync(binPath, { input: inputStr, encoding: 'utf8', timeout: 10000 });
  return out.trimEnd();
}

function buildInput(n, k, rows) {
  const lines = [`${n} ${k}`];
  for (let i = 0; i < n; i++) lines.push(rows[i].join(' '));
  return lines.join('\n');
}

function main() {
  if (!fs.existsSync(binPath)) {
    console.error('请先编译: g++ -O2 -std=c++17 gift_sort_ref.cpp -o gift_sort_ref');
    process.exit(1);
  }

  const testInputs = [];

  // 1. 题面样例
  testInputs.push({
    input: buildInput(3, 3, [
      [10, 20, 30],
      [15, 25, 35],
      [10, 20, 30],
    ]),
    label: '样例',
  });

  // 2. N=1
  testInputs.push({ input: buildInput(1, 2, [[5, 10]]), label: 'N=1' });

  // 3. N=2 不同总价
  testInputs.push({
    input: buildInput(2, 2, [[1, 2], [3, 4]]),
    label: 'N=2',
  });

  // 4. 总价同比最大
  testInputs.push({
    input: buildInput(2, 2, [[1, 9], [5, 5]]),
    label: '总价同',
  });

  // 5. 多盒
  testInputs.push({
    input: buildInput(4, 2, [[1, 1], [2, 2], [1, 2], [2, 1]]),
    label: '4盒',
  });

  // 6-10 确定性生成
  const seeds = [42, 17, 99, 5, 31];
  for (let i = 0; i < seeds.length; i++) {
    const n = 2 + (seeds[i] % 10);
    const k = 2 + (seeds[i] * 7 % 5);
    const rows = [];
    for (let r = 0; r < n; r++) {
      const row = [];
      for (let c = 0; c < k; c++)
        row.push(1 + (seeds[i] * (r * k + c + 1) * 13) % 100);
      rows.push(row);
    }
    testInputs.push({ input: buildInput(n, k, rows), label: `gen_${i}` });
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
      explanation: sortOrder === 1 ? '题面样例：礼盒1与3 总价、最大、最小均相同，按输入顺序 1 在 3 前；礼盒2 总价最大排最后，故输出 1 3 2。' : null,
    });
  }

  fs.writeFileSync(path.join(__dirname, 'gift_sort_tests.json'), JSON.stringify(results, null, 2), 'utf8');
  console.log('已生成', results.length, '个测试点 -> gift_sort_tests.json');
}

main();
