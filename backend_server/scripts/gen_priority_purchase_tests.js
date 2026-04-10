/**
 * [GESP202512 四级] 优先购买：生成 10 组测试点。
 * 第 1 组为题面样例（与文档一致），其余由确定性参数 (M, N, seed) 生成输入，输出均由参考程序运行得到。
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const refBin = path.join(__dirname, 'priority_purchase_ref');
const cppPath = path.join(__dirname, 'priority_purchase_ref.cpp');

function runRef(inputStr) {
  if (!fs.existsSync(refBin)) {
    console.error('请先编译参考程序: g++ -o priority_purchase_ref priority_purchase_ref.cpp');
    process.exit(1);
  }
  try {
    const out = execSync(refBin, { input: inputStr, encoding: 'utf8', timeout: 30000 });
    return out.trimEnd();
  } catch (e) {
    return null;
  }
}

/** 将 0..N-1 转为不重复的小写字母名，长度 1～10：0->a, 1->b, ..., 26->aa, ... */
function toName(index) {
  if (index < 0) return '';
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  let s = '';
  let n = index;
  do {
    s = letters[n % 26] + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s || 'a';
}

/** 确定性伪随机：返回 [lo, hi] 整数 */
function seeded(seed, lo, hi) {
  const x = (seed * 1103515245 + 12345) & 0x7fffffff;
  return lo + (x % (hi - lo + 1));
}

/** 根据 M, N, seed 生成一组输入 */
function generateInput(M, N, seed) {
  const lines = [`${M} ${N}`];
  const used = new Set();
  for (let i = 0; i < N; i++) {
    let name;
    for (let k = 0; k < 10000; k++) {
      const idx = (seed + i * 7919 + k * 97) % 100000;
      name = toName(idx);
      if (name.length > 10) name = name.slice(0, 10);
      if (!used.has(name)) {
        used.add(name);
        break;
      }
    }
    const P = seeded(seed + i * 31, 1, Math.min(100000, M * 2));
    const V = seeded(seed + i * 37, 1, 10);
    lines.push(`${name} ${P} ${V}`);
  }
  return lines.join('\n');
}

// 第 1 组：题面样例（与文档 3.2.4 一致）
const sampleInput = `20 4
apple 6 8
bus 15 1
cab 1 10
water 4 8`;

const testConfigs = [
  { type: 'sample', input: sampleInput, isDisplay: true },
  { M: 50, N: 8, seed: 42, isDisplay: true },
  { M: 100, N: 15, seed: 123, isDisplay: true },
  { M: 500, N: 30, seed: 456, isDisplay: true },
  { M: 2000, N: 50, seed: 789, isDisplay: true },
  { M: 10000, N: 100, seed: 2025, isDisplay: false },
  { M: 50000, N: 200, seed: 1122, isDisplay: false },
  { M: 80000, N: 400, seed: 3344, isDisplay: false },
  { M: 100000, N: 600, seed: 5566, isDisplay: false },
  { M: 100000, N: 1000, seed: 7788, isDisplay: false },
];

function main() {
  const results = [];
  for (let i = 0; i < testConfigs.length; i++) {
    const tc = testConfigs[i];
    const inputStr = tc.input !== undefined ? tc.input : generateInput(tc.M, tc.N, tc.seed);
    const output = runRef(inputStr);
    if (output === null) {
      console.error('参考程序运行失败，输入:', inputStr.slice(0, 200));
      process.exit(1);
    }
    const isFirst = i === 0;
    results.push({
      input: inputStr.trimEnd(),
      output,
      is_hidden: i >= 5,
      is_displayed: isFirst,
      sort_order: i + 1,
      explanation: i === 0 ? '题面样例：预算 20，4 件商品，按优先级、价格、名字排序后依次购买，输出购买的商品名按字典序。' : null,
    });
  }
  const outPath = path.join(__dirname, 'priority_purchase_tests.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log('已生成', results.length, '个测试点 ->', outPath);
}

main();
