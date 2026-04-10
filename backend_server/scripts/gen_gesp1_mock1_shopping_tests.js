const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 参考程序编译后生成的可执行文件名
const binPath = path.join(__dirname, 'gesp1_mock1_shopping_ref');

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
    console.error('请先在 scripts 目录编译参考代码：g++ -O2 -std=c++17 gesp1_mock1_shopping_ref.cpp -o gesp1_mock1_shopping_ref');
    process.exit(1);
  }

  // 10 组测试：按规则生成，覆盖
  // - 不打折（total < 100）
  // - 只打九折（100 <= total < 150）
  // - 九折后仍 >=150 再减 20
  // - 大数量 / 大金额 / 小数精度 等
  //
  // 生成规则是确定性的，避免手写一长串具体数字。
  const testCases = [];

  // 1. 样例：固定为一个易算的小数场景（不打折），用于题面展示
  testCases.push({
    p: 9.5,
    n: 5,
    explanation: '样例：总价 9.5×5=47.5，小于 100 元，不打折。',
  });

  // 2. 恰好 100（只打九折），通过公式构造：p = 10 + i, n = 100 / p 向下取整，选第一个恰好等于 100 的组合
  (function generateExactly100() {
    for (let pInt = 10; pInt <= 50; pInt++) {
      const p = pInt * 1.0;
      const n = Math.round(100 / p);
      const total = p * n;
      if (Math.abs(total - 100) < 1e-6 && n >= 1) {
        testCases.push({ p, n });
        return;
      }
    }
    // 兜底：如果上面没找到，退回一个简单组合
    testCases.push({ p: 20.0, n: 5 });
  })();

  // 3. 原价在 (100, 150) 之间（只打九折），用等差构造
  for (let k = 1; k <= 2; k++) {
    const p = 30 + 5 * k; // 35, 40
    const n = 3 + k; // 4,5
    const total = p * n;
    if (total > 100 && total < 150) {
      testCases.push({ p, n });
    }
  }

  // 4. 原价在 [170, 260]，打九折后 >=150，可再减 20，构造两种规模
  const bigPs = [50, 65];
  const bigNs = [4, 5];
  for (let i = 0; i < bigPs.length; i++) {
    const p = bigPs[i];
    const n = bigNs[i];
    const total = p * n;
    if (total >= 170 && total <= 260) {
      testCases.push({ p, n });
    }
  }

  // 5. 若数量不足 10，再用小数单价 + 大 n 补足，保证 total > 200 且有精度考察
  let seed = 7;
  while (testCases.length < 10) {
    // 生成一个 5.x 到 15.x 的单价，带两位小数
    const p = 5 + (seed % 11) + (seed % 7) / 10.0;
    const n = 10 + (seed % 21); // 10~30
    const total = p * n;
    if (total > 200 && total < 1000) {
      testCases.push({ p, n });
    }
    seed += 5;
  }

  const results = [];

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const inputStr = `${tc.p}\n${tc.n}\n`;
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

  const outPath = path.join(__dirname, 'gesp1_mock1_shopping_tests.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log('已生成', results.length, '个测试点 ->', outPath);
}

main();

