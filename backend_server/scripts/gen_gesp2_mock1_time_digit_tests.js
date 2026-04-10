/**
 * [GESP 2级 模拟1] 小杨的幸运编号：生成 10 组测试点。
 * 输入格式：一行四个整数 L R d k
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const binPath = path.join(__dirname, 'gesp2_mock1_time_digit_ref');

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
    console.error('请先在 scripts 目录编译参考代码：g++ -O2 -std=c++17 gesp2_mock1_time_digit_ref.cpp -o gesp2_mock1_time_digit_ref');
    process.exit(1);
  }

  const cases = [];

  // 1. 样例： [10,25] 中数字 1 恰好出现 1 次 → 10
  cases.push({
    L: 10, R: 25, d: 1, k: 1,
    explanation: '样例：[10,25] 中数字 1 恰好出现 1 次的数有 10,12,13,14,15,16,17,18,19,21，共 10 个。',
  });

  // 2. [1,100] 中数字 0 恰好 1 次 → 9
  cases.push({
    L: 1, R: 100, d: 0, k: 1,
    explanation: null,
  });

  // 3. 小区间，k=2
  cases.push({ L: 11, R: 33, d: 1, k: 2 });
  // 4. 区间含 0，d=0,k=1：0 和 10 都算（漏写 0 特判的 while(j!=0) 会少算 0）
  cases.push({
    L: 0, R: 10, d: 0, k: 1,
    explanation: null,
  });
  // 5. 区间含 0，d=0,k=1：0,10,20,...,90 共 10 个（同上，专卡漏判 0）
  cases.push({
    L: 0, R: 100, d: 0, k: 1,
    explanation: null,
  });
  // 6. 较大区间
  cases.push({ L: 1, R: 1000, d: 5, k: 1 });
  // 7. d=9, k=1
  cases.push({ L: 90, R: 200, d: 9, k: 1 });
  // 8. k=2，多位数
  cases.push({ L: 100, R: 500, d: 0, k: 1 });
  // 9. 边界 1~1
  cases.push({ L: 1, R: 1, d: 1, k: 1 });
  // 10. 接近上界
  cases.push({ L: 99000, R: 100000, d: 0, k: 2 });

  const results = [];

  for (let i = 0; i < cases.length; i++) {
    const tc = cases[i];
    const inputStr = `${tc.L} ${tc.R} ${tc.d} ${tc.k}\n`;
    const output = runCpp(inputStr);
    const sortOrder = i + 1;
    const isDisplayed = sortOrder === 1;
    const isHidden = sortOrder > 5;

    results.push({
      input: inputStr.trimEnd(),
      output,
      is_hidden: isHidden,
      is_displayed: isDisplayed,
      sort_order: sortOrder,
      explanation: tc.explanation || null,
    });
  }

  const outPath = path.join(__dirname, 'gesp2_mock1_time_digit_tests.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log('已生成', results.length, '个测试点 ->', outPath);
}

main();
