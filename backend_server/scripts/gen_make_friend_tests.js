/**
 * 交朋友：生成 10 组测试点，覆盖（1）题面样例（2）唯一最近（3）两人同距取较矮
 * （4）Alice 最小/最大（5）边界 100/199（6）确定性伪随机多组。
 * 明确覆盖 H2、H3、H4 乱序：多组用例中「其他三人」顺序打乱，避免只测升序/固定顺序。
 * 输出由参考程序 make_friend_ref 运行得到。
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const binPath = path.join(__dirname, 'make_friend_ref');

function runRef(inputStr) {
  try {
    const out = execSync(binPath, { input: inputStr, encoding: 'utf8', timeout: 5000 });
    return out.trim();
  } catch (e) {
    return null;
  }
}

// 确定性生成 [100,199] 中 4 个互不相同的整数：用 LCG 按 seed 生成
function genFourHeights(seed) {
  const LCG = (s) => (s * 1103515245 + 12345) >>> 0;
  const used = new Set();
  const arr = [];
  let s = seed;
  while (arr.length < 4) {
    s = LCG(s);
    const h = 100 + (s % 100);
    if (!used.has(h)) {
      used.add(h);
      arr.push(h);
    }
  }
  return arr;
}

// 对 [a, b, c] 做第 permIndex(0~5) 种排列，确定性打乱 H2,H3,H4 顺序
function permuteThree(arr, permIndex) {
  const [a, b, c] = arr;
  const perms = [[a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a]];
  return perms[permIndex % 6];
}

// 10 组测试：前 5 组为展示（is_hidden=false），第 1 组为题面展示（is_displayed=true）
// 场景 1：题面样例 — 两人与 Alice 同距取较矮（H2,H3,H4 为题面顺序）
const scenario1 = [150, 165, 135, 133];
// 场景 2：Alice 最小(100)，唯一最近 101 — 乱序：101 放在最后，检验不是“总看 H2”
const scenario2 = [100, 103, 102, 101];
// 场景 3：Alice 最大(199)，唯一最近 198 — 乱序：198 放在中间
const scenario3 = [199, 196, 198, 197];
// 场景 4：两人同距(130 与 115、145 差均为 15)，取较矮 115 — 乱序：115 在 H4
const scenario4 = [130, 145, 140, 115];
// 场景 5：唯一最近 148 — 乱序：148 在 H4
const scenario5 = [150, 160, 170, 148];
// 场景 6–10：确定性伪随机四元组，且 H2,H3,H4 用 permIndex 打乱，保证乱序
const raw6 = genFourHeights(6);
const raw7 = genFourHeights(7);
const raw8 = genFourHeights(8);
const raw9 = genFourHeights(9);
const raw10 = genFourHeights(10);
if (!raw6.includes(100)) raw6[0] = 100;
if (!raw7.includes(199)) raw7[0] = 199;
const scenario6 = [raw6[0], ...permuteThree(raw6.slice(1), 6)];
const scenario7 = [raw7[0], ...permuteThree(raw7.slice(1), 7)];
const scenario8 = [raw8[0], ...permuteThree(raw8.slice(1), 8)];
const scenario9 = [raw9[0], ...permuteThree(raw9.slice(1), 9)];
const scenario10 = [raw10[0], ...permuteThree(raw10.slice(1), 10)];

const allInputs = [
  { heights: scenario1, isDisplay: true, explanation: '样例中 Alice 身高为 150，第 2、3 个小朋友与 Alice 身高差均为 15，选较矮的 135。' },
  { heights: scenario2, isDisplay: false, explanation: null },
  { heights: scenario3, isDisplay: false, explanation: null },
  { heights: scenario4, isDisplay: false, explanation: null },
  { heights: scenario5, isDisplay: false, explanation: null },
  { heights: scenario6, isDisplay: false, explanation: null },
  { heights: scenario7, isDisplay: false, explanation: null },
  { heights: scenario8, isDisplay: false, explanation: null },
  { heights: scenario9, isDisplay: false, explanation: null },
  { heights: scenario10, isDisplay: false, explanation: null },
];

function main() {
  if (!fs.existsSync(binPath)) {
    console.error('请先编译参考程序: g++ -o make_friend_ref make_friend_ref.cpp');
    process.exit(1);
  }
  const results = [];
  for (let i = 0; i < allInputs.length; i++) {
    const { heights, isDisplay, explanation } = allInputs[i];
    const inputStr = heights.join('\n');
    const output = runRef(inputStr);
    if (output === null) {
      console.error('参考程序运行失败，input:', inputStr);
      process.exit(1);
    }
    results.push({
      input: inputStr,
      output,
      is_hidden: i >= 5,
      is_displayed: i === 0,
      sort_order: i + 1,
      explanation: i === 0 ? explanation : null,
    });
  }
  const outPath = path.join(__dirname, 'make_friend_tests.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log('已生成', results.length, '个测试点 ->', outPath);
}

main();
