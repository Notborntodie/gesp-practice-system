/**
 * 生成 [GESP 4级 模拟1] 最大子矩阵和 的测试点。
 * 确定性生成：不同 n,m,k、矩阵用公式或固定 seed 生成。
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const binPath = path.join(__dirname, 'gesp4_mock1_submatrix_ref');

function runCpp(inputStr) {
  const out = execSync(binPath, {
    input: inputStr,
    encoding: 'utf8',
    timeout: 30000,
  });
  return out.trim();
}

// 确定性生成矩阵：第 i 行第 j 列 = (i * 7 + j * 11 + seed) % 201 - 100，保证有正有负
function genMatrix(n, m, seed) {
  const rows = [];
  for (let i = 1; i <= n; i++) {
    const row = [];
    for (let j = 1; j <= m; j++)
      row.push((i * 7 + j * 11 + seed) % 201 - 100);
    rows.push(row);
  }
  return rows;
}

function buildInput(n, m, k, mat) {
  let s = `${n} ${m} ${k}\n`;
  for (let i = 0; i < n; i++)
    s += mat[i].join(' ') + '\n';
  return s.trimEnd();
}

function main() {
  if (!fs.existsSync(binPath)) {
    console.error('请先在 scripts 目录编译：g++ -O2 -std=c++17 gesp4_mock1_submatrix_ref.cpp -o gesp4_mock1_submatrix_ref');
    process.exit(1);
  }

  const testCases = [];

  // 1. 样例：小矩阵，手算友好
  testCases.push({
    n: 3, m: 4, k: 2,
    mat: [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]],
    explanation: '样例：2×2 子矩阵和最大为 7+8+11+12=38。',
  });

  // 2. k=1，即取单格最大值
  testCases.push({
    n: 2, m: 3, k: 1,
    mat: [[-1, 5, 0], [2, -3, 4]],
  });

  // 3. n=m=k，整个矩阵一块
  testCases.push({
    n: 2, m: 2, k: 2,
    mat: [[10, 20], [30, 40]],
  });

  // 4. 确定性 4×5, k=2
  testCases.push({
    n: 4, m: 5, k: 2,
    mat: genMatrix(4, 5, 42),
  });

  // 5. 稍大 5×6, k=3
  testCases.push({
    n: 5, m: 6, k: 3,
    mat: genMatrix(5, 6, 100),
  });

  // 6～10 更多组合
  testCases.push({ n: 6, m: 6, k: 2, mat: genMatrix(6, 6, 0) });
  testCases.push({ n: 8, m: 7, k: 4, mat: genMatrix(8, 7, 17) });
  testCases.push({ n: 10, m: 10, k: 5, mat: genMatrix(10, 10, 99) });
  testCases.push({ n: 4, m: 8, k: 2, mat: genMatrix(4, 8, 33) });
  testCases.push({ n: 7, m: 9, k: 3, mat: genMatrix(7, 9, 123) });

  const results = [];
  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const inputStr = buildInput(tc.n, tc.m, tc.k, tc.mat);
    const output = runCpp(inputStr);
    const sortOrder = i + 1;
    results.push({
      input: inputStr,
      output,
      is_hidden: sortOrder > 5,
      is_displayed: sortOrder === 1,
      sort_order: sortOrder,
      explanation: tc.explanation || null,
    });
  }

  const outPath = path.join(__dirname, 'gesp4_mock1_submatrix_tests.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log('已生成', results.length, '个测试点 ->', outPath);
}

main();
