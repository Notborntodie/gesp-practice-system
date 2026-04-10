const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const binPath = path.join(__dirname, 'gesp2_mock2_manhattan_ring_ref');

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
    console.error('请先在 scripts 目录编译参考代码：g++ -O2 -std=c++17 gesp2_mock2_manhattan_ring_ref.cpp -o gesp2_mock2_manhattan_ring_ref');
    process.exit(1);
  }

  const cases = [];

  // 1. 样例：n=5, r=1
  cases.push({
    n: 5,
    r: 1,
    explanation: '样例：5×5，曼哈顿半径为 1 的「圈」。',
  });

  // 2. 题面可见：n=7, r=2，菱形更明显，便于找规律
  cases.push({
    n: 7,
    r: 2,
    explanation: '样例 2：7×7，步数 2，从中心出发恰好 2 步能到的格子构成一圈菱形，便于观察规律。',
  });

  // 3. 最小非平凡：n=3, r=1
  cases.push({
    n: 3,
    r: 1,
  });

  // 4. 中等大小：n=9, r=3
  cases.push({
    n: 9,
    r: 3,
  });

  // 5. 中心附近较小半径：n=11, r=2
  cases.push({
    n: 11,
    r: 2,
  });

  // 6. 接近最大半径：n=11, r=5
  cases.push({
    n: 11,
    r: 5,
  });

  // 7. 较大矩阵，小半径：n=51, r=1
  cases.push({
    n: 51,
    r: 1,
  });

  // 8. 较大矩阵，中等半径：n=51, r: 10
  cases.push({
    n: 51,
    r: 10,
  });

  // 9. 接近上界：n=99, r=1
  cases.push({
    n: 99,
    r: 1,
  });

  // 10. 接近上界：n=99, r=49
  cases.push({
    n: 99,
    r: 49,
  });

  const results = [];

  for (let i = 0; i < cases.length; i++) {
    const tc = cases[i];
    const inputStr = `${tc.n}\n${tc.r}\n`;
    const output = runCpp(inputStr);
    const sortOrder = i + 1;
    const isDisplayed = sortOrder <= 2;  // 前两个样例在题面展示
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

  const outPath = path.join(__dirname, 'gesp2_mock2_manhattan_ring_tests.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log('已生成', results.length, '个测试点 ->', outPath);
}

main();

