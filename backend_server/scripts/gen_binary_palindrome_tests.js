/**
 * [GESP202603 三级] 二进制回文串：生成 10 组测试点。
 * 第 1 组为题面样例（n=15）；其余按确定性规则生成 n，输出均由参考程序运行得到。
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const binPath = path.join(__dirname, 'binary_palindrome_ref');

function runCpp(inputStr) {
  const out = execSync(binPath, {
    input: inputStr,
    encoding: 'utf8',
    timeout: 10000,
  });
  return out.trim();
}

function main() {
  if (!fs.existsSync(binPath)) {
    console.error('请先在 scripts 目录编译参考代码：g++ -O2 -std=c++17 binary_palindrome_ref.cpp -o binary_palindrome_ref');
    process.exit(1);
  }

  const testInputs = [];

  // 1. 题面样例 n=15 -> 6
  testInputs.push({ input: '15', label: '样例' });

  // 2. n=1 边界
  testInputs.push({ input: '1', label: 'n=1' });

  // 3. n=2, 4. n=3, 5. n=7
  testInputs.push({ input: '2', label: 'n=2' });
  testInputs.push({ input: '3', label: 'n=3' });
  testInputs.push({ input: '7', label: 'n=7' });

  // 6-10. 确定性生成 n (覆盖中等与较大值，n<=10^5)
  const seeds = [42, 17, 99, 5, 31];
  for (let i = 0; i < seeds.length; i++) {
    const n = 10 + (seeds[i] * 7) % 99991; // 10 ~ 10^5 量级
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
      explanation: sortOrder === 1 ? '题面样例：在 [1,15] 中 1、3、5、7、9、15 的二进制分别为 1、11、101、111、1001、1111，均为回文，共 6 个。' : null,
    });
  }

  const outPath = path.join(__dirname, 'binary_palindrome_tests.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log('已生成', results.length, '个测试点 ->', outPath);
}

main();
