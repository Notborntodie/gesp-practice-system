/**
 * 数字替换：生成 10 组测试点。
 * 第 1 组为题面样例（8459045）；第 2 组为题面样例 2（123）；其余按确定性规则生成。
 * 覆盖：不含4、含一个4、含多个4、全为4、不同位数。输出均由参考程序运行得到。
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const binPath = path.join(__dirname, 'digit_replace_ref');

function runCpp(inputStr) {
  const out = execSync(binPath, {
    input: inputStr,
    encoding: 'utf8',
    timeout: 10000,
  });
  return out.trim();
}

/**
 * 确定性生成一个由数字组成的字符串，位数 len，种子 seed。
 * 首位 1-9（不能为 0），其余位 0-9，保证可复现。
 */
function genDigitString(len, seed) {
  let s = '';
  for (let i = 0; i < len; i++) {
    const d = i === 0
      ? ((seed * (i + 1) * 7 + 13) % 9) + 1   // 首位 1-9
      : (seed * (i + 1) * 7 + 13) % 10;
    s += String(d);
  }
  return s;
}

function main() {
  if (!fs.existsSync(binPath)) {
    console.error('请先在 scripts 目录编译参考代码：g++ -O2 -std=c++17 digit_replace_ref.cpp -o digit_replace_ref');
    process.exit(1);
  }

  const testInputs = [];

  // 1. 题面样例
  testInputs.push({ input: '8459045', label: '样例' });

  // 2. 题面样例 2：不含 4
  testInputs.push({ input: '123', label: '不含4' });

  // 3. 单个 4
  testInputs.push({ input: '4', label: '单字符4' });

  // 4. 多个 4
  testInputs.push({ input: '444', label: '全4' });

  // 5. 含 4 的常规数（边界：含 4 在首位、中间、末位）
  testInputs.push({ input: '10405', label: '多位置含4' });

  // 6-10. 确定性生成：不同位数与含4情况
  const seeds = [42, 17, 99, 5, 31];
  for (let i = 0; i < seeds.length; i++) {
    const len = 4 + (i % 5); // 4~8 位
    let s = genDigitString(len, seeds[i]);
    // 保证至少一组不含4、一组含4（若当前不含4则把某位改成4）
    if (i >= 2 && s.indexOf('4') === -1) {
      s = s.slice(0, 1) + '4' + s.slice(2);
    }
    testInputs.push({ input: s, label: `gen_${i}` });
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
      explanation: sortOrder === 1 ? '题面样例：8459045 中所有 4 替换为 8 得 8859085。' : null,
    });
  }

  const outPath = path.join(__dirname, 'digit_replace_tests.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log('已生成', results.length, '个测试点 ->', outPath);
}

main();
