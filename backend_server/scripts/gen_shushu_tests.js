/**
 * [GESP202603 二级] 数数：生成 10 组测试点。
 * 第 1 组为题面样例（2221 2223）；其余按确定性规则生成 (a,b)，输出均由参考程序运行得到。
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const binPath = path.join(__dirname, 'shushu_ref');

function runCpp(inputStr) {
  const out = execSync(binPath, {
    input: inputStr,
    encoding: 'utf8',
    timeout: 15000,
  });
  return out.trim();
}

/**
 * 确定性生成 [a, b]：a < b，且 a、b 在合理范围内（便于暴力枚举）。
 */
function genRange(seed) {
  const base = 1000 + (seed * 17) % 8000;
  const len = 20 + (seed * 7) % 180;
  const a = base;
  const b = base + len;
  return { a, b };
}

function main() {
  if (!fs.existsSync(binPath)) {
    console.error('请先在 scripts 目录编译参考代码：g++ -O2 -std=c++17 shushu_ref.cpp -o shushu_ref');
    process.exit(1);
  }

  const testInputs = [];

  // 1. 题面样例
  testInputs.push({ input: '2221 2223', label: '样例' });

  // 2. 小范围、无美丽数
  testInputs.push({ input: '1 100', label: '小范围' });

  // 3. 含 1 个美丽数（如 222）
  testInputs.push({ input: '200 300', label: '含222' });

  // 4. 边界：区间内多个
  testInputs.push({ input: '1220 1230', label: '1222等' });

  // 5. 稍大区间
  testInputs.push({ input: '2000 2500', label: '中等区间' });

  // 6-10. 确定性生成
  const seeds = [42, 17, 99, 5, 31];
  for (let i = 0; i < seeds.length; i++) {
    const { a, b } = genRange(seeds[i]);
    testInputs.push({ input: `${a} ${b}`, label: `gen_${i}` });
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
      explanation: sortOrder === 1 ? '题面样例：[2221,2223] 内 2221、2223 均恰有 3 个 2，故为 2。' : null,
    });
  }

  const outPath = path.join(__dirname, 'shushu_tests.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log('已生成', results.length, '个测试点 ->', outPath);
}

main();
