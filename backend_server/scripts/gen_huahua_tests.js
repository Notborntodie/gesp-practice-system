/**
 * [GESP202603 二级] 画画：生成 10 组测试点。
 * 第 1 组为题面样例（n=5）；其余按确定性规则生成 n，输出均由参考程序运行得到。
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const binPath = path.join(__dirname, 'huahua_ref');

function runCpp(inputStr) {
  const out = execSync(binPath, {
    input: inputStr,
    encoding: 'utf8',
    timeout: 5000,
  });
  return out.trimEnd();
}

function main() {
  if (!fs.existsSync(binPath)) {
    console.error('请先在 scripts 目录编译参考代码：g++ -O2 -std=c++17 huahua_ref.cpp -o huahua_ref');
    process.exit(1);
  }

  const testInputs = [];

  // 1. 题面样例 n=5
  testInputs.push({ input: '5', label: '样例' });

  // 2. n=1 边界
  testInputs.push({ input: '1', label: 'n=1' });

  // 3. n=2
  testInputs.push({ input: '2', label: 'n=2' });

  // 4. n=3
  testInputs.push({ input: '3', label: 'n=3' });

  // 5. n=4
  testInputs.push({ input: '4', label: 'n=4' });

  // 6-10. 确定性生成 n
  const seeds = [42, 17, 99, 5, 31];
  for (let i = 0; i < seeds.length; i++) {
    const n = 6 + (seeds[i] % 15); // 6..20
    testInputs.push({ input: String(n), label: `gen_${i}` });
  }

  const results = [];
  for (let i = 0; i < testInputs.length; i++) {
    const tc = testInputs[i];
    const output = runCpp(tc.input);
    const sortOrder = i + 1;
    const isDisplayed = sortOrder === 1;
    const isHidden = sortOrder > 5;
    results.push({
      input: tc.input,
      output,
      is_hidden: isHidden,
      is_displayed: isDisplayed,
      sort_order: sortOrder,
      explanation: sortOrder === 1 ? '题面样例：n=5 时 5×5 方阵，四角为 +，首末行为 -，首末列为 |，中间为 *。' : null,
    });
  }

  const outPath = path.join(__dirname, 'huahua_tests.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log('已生成', results.length, '个测试点 ->', outPath);
}

main();
