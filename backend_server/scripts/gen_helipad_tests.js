/**
 * [GESP202512 四级] 建造：测试点输入与输出均由脚本生成。
 * 输入由确定性网格生成器根据 M、N、H、seed 生成，输出由与参考程序等价的 solveHelipad 计算。
 */

const fs = require('fs');
const path = require('path');

// 与参考 C++ 一致：枚举 3×3 区域，满足 max-min<=H 时取海拔和的最大值
function solveHelipad(inputStr) {
  const lines = inputStr.trim().split('\n');
  const [M, N, H] = lines[0].split(/\s+/).map(Number);
  const a = [];
  for (let i = 1; i <= M; i++) {
    a.push(lines[i].split(/\s+/).map(Number));
  }

  let ans = 0;
  for (let r = 0; r + 2 < M; r++) {
    for (let c = 0; c + 2 < N; c++) {
      let mn = a[r][c], mx = a[r][c], sum = 0;
      for (let i = r; i <= r + 2; i++) {
        for (let j = c; j <= c + 2; j++) {
          sum += a[i][j];
          if (a[i][j] < mn) mn = a[i][j];
          if (a[i][j] > mx) mx = a[i][j];
        }
      }
      if (mx - mn <= H && sum > ans) ans = sum;
    }
  }
  return String(ans);
}

// 确定性生成网格，保证任意 3×3 内最大最小之差不超过 H（题面保证存在合法区域）
// 策略：a[i][j] 在 [base, base+H] 内由 seed 决定，使相邻格子差异受控
function genGrid(M, N, seed, H, minVal = 1, maxVal = 100000) {
  const range = Math.min(H + 1, maxVal - minVal + 1);
  const base = minVal;
  let s = seed >>> 0;
  const grid = [];
  for (let i = 0; i < M; i++) {
    const row = [];
    for (let j = 0; j < N; j++) {
      s = (s * 1103515245 + 12345) >>> 0;
      row.push(base + (s % range));
    }
    grid.push(row);
  }
  return grid;
}

function buildInput(M, N, H, grid) {
  const header = `${M} ${N} ${H}`;
  const rows = grid.map((row) => row.join(' '));
  return header + '\n' + rows.join('\n');
}

// 题面样例（GESP 官方）：5×5，H=3，答案为 40
function genSampleGrid() {
  return [
    [5, 5, 5, 5, 5],
    [5, 1, 5, 1, 5],
    [5, 5, 5, 5, 5],
    [5, 2, 5, 2, 5],
    [3, 5, 5, 5, 2],
  ];
}

// 测试用例：仅定义 (M, N, H, seed) 及展示/隐藏；输入由脚本生成
const testCaseSpecs = [
  { M: 5, N: 5, H: 3, grid: genSampleGrid(), is_displayed: true, is_hidden: false, explanation: '样例：5×5 地形，H=3，满足条件的 3×3 区域中海拔和最大为 40。' },
  { M: 4, N: 4, H: 2, seed: 42, is_displayed: false, is_hidden: false },
  { M: 6, N: 7, H: 4, seed: 101, is_displayed: false, is_hidden: false },
  { M: 10, N: 10, H: 5, seed: 202, is_displayed: false, is_hidden: false },
  { M: 12, N: 12, H: 6, seed: 303, is_displayed: false, is_hidden: false },
  { M: 50, N: 50, H: 12, seed: 404, is_displayed: false, is_hidden: true },
  { M: 3, N: 3, H: 1, seed: 7, is_displayed: false, is_hidden: true },
  { M: 3, N: 4, H: 2, seed: 8, is_displayed: false, is_hidden: true },
  { M: 5, N: 6, H: 10, seed: 9, is_displayed: false, is_hidden: true },
  { M: 8, N: 8, H: 5, seed: 10, is_displayed: false, is_hidden: true },
];

function main() {
  const results = testCaseSpecs.map((spec, i) => {
    const grid = spec.grid || genGrid(spec.M, spec.N, spec.seed, spec.H);
    const input = buildInput(spec.M, spec.N, spec.H, grid);
    const output = solveHelipad(input);
    return {
      input: input.trimEnd(),
      output,
      is_hidden: !!spec.is_hidden,
      is_displayed: !!spec.is_displayed,
      sort_order: i + 1,
      explanation: spec.explanation || null,
    };
  });

  const outPath = path.join(__dirname, 'helipad_tests.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log('已生成', results.length, '个测试点 ->', outPath);
}

main();
