/**
 * 黄金格题目：生成 10 组测试点输入，并用参考代码逻辑计算输出。
 * 数据范围：H, W, x 均为正整数且不超过 1000。
 * 第 1 组为展示样例（使用图片中的输入与输出）；其余为隐藏测试点，输出由参考代码计算。
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 与参考 C++ 完全一致的计数逻辑（用于在 Node 中生成输出）
function countGolden(h, w, x) {
  let cnt = 0;
  for (let i = 1; i <= h; i++) {
    for (let j = 1; j <= w; j++) {
      const lhs = i * i + j * j;
      const rhs = (x + i - j) * (x + i - j);
      if (lhs <= rhs) cnt++;
    }
  }
  return cnt;
}

// 10 组测试设计：前 5 个展示、后 5 个隐藏；H/W/x 取不规则数，避免太有规律
const testCases = [
  { h: 4, w: 4, x: 2, label: '样例', isDisplay: true },
  { h: 3, w: 7, x: 2, isDisplay: true },
  { h: 8, w: 5, x: 4, isDisplay: true },
  { h: 13, w: 11, x: 6, isDisplay: true },
  { h: 47, w: 23, x: 15, isDisplay: true },
  { h: 100, w: 87, x: 33, isDisplay: false },
  { h: 256, w: 312, x: 88, isDisplay: false },
  { h: 501, w: 499, x: 177, isDisplay: false },
  { h: 1000, w: 1000, x: 500, isDisplay: false },
  { h: 137, w: 891, x: 234, isDisplay: false },
];

const cppPath = path.join(__dirname, 'golden_grid_ref.cpp');
const binPath = path.join(__dirname, 'golden_grid_ref');

function runCpp(inputStr) {
  try {
    const out = execSync(binPath, { input: inputStr, encoding: 'utf8', timeout: 30000 });
    return out.trim();
  } catch (e) {
    return null;
  }
}

function main() {
  const useCpp = fs.existsSync(binPath);
  const results = [];

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const inputStr = `${tc.h}\n${tc.w}\n${tc.x}\n`;
    let output;
    if (tc.outputOverride !== undefined) {
      output = String(tc.outputOverride);
    } else if (useCpp) {
      output = runCpp(inputStr);
      if (output === null) output = String(countGolden(tc.h, tc.w, tc.x));
    } else {
      output = String(countGolden(tc.h, tc.w, tc.x));
    }
    results.push({
      input: inputStr.trimEnd(),
      output,
      is_hidden: !tc.isDisplay,
      is_displayed: !!tc.isDisplay,
      sort_order: i + 1,
      explanation: (tc.isDisplay && i === 0) ? '样例：H=4, W=4, x=2，满足条件的黄金格数量为 4。' : null,
    });
  }

  const outPath = path.join(__dirname, 'golden_grid_tests.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log('已生成', results.length, '个测试点 ->', outPath);
}

main();
