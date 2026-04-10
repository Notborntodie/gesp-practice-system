/**
 * [GESP202603 四级] 礼盒排序：生成 10 组测试点。
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const binPath = path.join(__dirname, 'gift_box_sort_ref');

function runCpp(inputStr) {
  const out = execSync(binPath, { input: inputStr, encoding: 'utf8', timeout: 10000 });
  return out.trimEnd();
}

function genBox(seed, idx) {
  const L = 1 + (seed * 17 + idx * 7) % 100;
  const W = 1 + (seed * 13 + idx * 11) % 100;
  const H = 1 + (seed * 19 + idx * 5) % 100;
  const WT = 1 + (seed * 23 + idx * 3) % 100;
  return { L, W, H, WT };
}

function main() {
  if (!fs.existsSync(binPath)) {
    console.error('请先编译: g++ -O2 -std=c++17 gift_box_sort_ref.cpp -o gift_box_sort_ref');
    process.exit(1);
  }

  const testInputs = [];

  // 1. 题面样例
  testInputs.push({
    input: '3\n10 20 30 40\n15 25 35 45\n12 22 32 42',
    label: '样例',
  });

  // 2. N=1
  testInputs.push({ input: '1\n1 2 3 4', label: 'N=1' });

  // 3. N=2
  testInputs.push({ input: '2\n5 5 5 5\n3 3 3 3', label: 'N=2' });

  // 4. 同 L 比 W+H+WT
  testInputs.push({
    input: '3\n10 1 1 1\n10 2 2 2\n10 3 3 3',
    label: '同L',
  });

  // 5. 多组
  testInputs.push({
    input: '4\n1 10 10 10\n2 9 9 9\n2 8 8 8\n3 7 7 7',
    label: '4盒',
  });

  // 6-10 确定性生成
  const seeds = [42, 17, 99, 5, 31];
  for (let i = 0; i < seeds.length; i++) {
    const n = 5 + (seeds[i] % 20);
    const lines = [String(n)];
    for (let j = 0; j < n; j++) {
      const b = genBox(seeds[i], j);
      lines.push(`${b.L} ${b.W} ${b.H} ${b.WT}`);
    }
    testInputs.push({ input: lines.join('\n'), label: `gen_${i}` });
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
      explanation: sortOrder === 1 ? '题面样例：按 L 降序得 15>12>10，输出顺序 15 25 35 45、12 22 32 42、10 20 30 40。' : null,
    });
  }

  fs.writeFileSync(path.join(__dirname, 'gift_box_sort_tests.json'), JSON.stringify(results, null, 2), 'utf8');
  console.log('已生成', results.length, '个测试点 -> gift_box_sort_tests.json');
}

main();
