/**
 * [GESP202603 三级] 凯撒密码：生成 10 组测试点。
 * 第 1 组为题面样例；其余按确定性规则生成（偏移、明文1、明文2），用参考程序跑出 output。
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const binPath = path.join(__dirname, 'caesar_ref');

function runCpp(inputStr) {
  const out = execSync(binPath, {
    input: inputStr,
    encoding: 'utf8',
    timeout: 5000,
  });
  return out.trimEnd();
}

function shift(s, offset) {
  let t = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] >= 'A' && s[i] <= 'Z')
      t += String.fromCharCode(((s[i].charCodeAt(0) - 65 + offset) % 26) + 65);
    else t += s[i];
  }
  return t;
}

/** 确定性生成一段仅含 A-Z 的字符串，长度 len，种子 seed */
function genStr(len, seed) {
  let s = '';
  for (let i = 0; i < len; i++)
    s += String.fromCharCode(65 + (seed * (i + 1) * 7 + 13) % 26);
  return s;
}

function main() {
  if (!fs.existsSync(binPath)) {
    console.error('请先在 scripts 目录编译参考代码：g++ -O2 -std=c++17 caesar_ref.cpp -o caesar_ref');
    process.exit(1);
  }

  const testInputs = [];

  // 1. 题面样例
  testInputs.push({
    input: 'ABCDEFGVWXYZ\nDEFGHIJYZABC\nWKHTXLFNEURZQIRAMXPSVRYHUWKHODCBGRJ',
    label: '样例',
  });

  // 2. 偏移 0
  testInputs.push({
    input: 'ABC\nABC\nHELLO',
    label: '偏移0',
  });

  // 3. 偏移 1
  testInputs.push({
    input: 'A\nB\nB',
    label: '偏移1单字',
  });

  // 4. 偏移 25
  testInputs.push({
    input: 'AB\nZA\nZA',
    label: '偏移25',
  });

  // 5. 短串
  testInputs.push({
    input: 'XYZ\nWXY\nWXY',
    label: '短串',
  });

  // 6-10. 确定性生成：偏移 + 两段明文
  const seeds = [42, 17, 99, 5, 31];
  for (let i = 0; i < seeds.length; i++) {
    const k = seeds[i] % 26;
    const len1 = 5 + (seeds[i] % 10);
    const len2 = 8 + (seeds[i] % 15);
    const s1 = genStr(len1, seeds[i]);
    const s2 = genStr(len2, seeds[i] + 7);
    const c1 = shift(s1, k);
    const c2 = shift(s2, k);
    testInputs.push({
      input: `${s1}\n${c1}\n${c2}`,
      label: `gen_${i}`,
    });
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
      explanation: sortOrder === 1 ? '题面样例：已知明文 ABCDEFGVWXYZ 与密文 DEFGHIJYZABC 得偏移 3，将第三行密文按偏移 3 解密得 THEQUICKBROWNFOXJUMPSOVERTHELAZYDOG。' : null,
    });
  }

  const outPath = path.join(__dirname, 'caesar_tests.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log('已生成', results.length, '个测试点 ->', outPath);
}

main();
