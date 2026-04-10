/**
 * 生成 [GESP 4级 模拟2] 任务调度 的测试点。
 * 确定性生成：多组 (d, w)，覆盖全做、部分做、边界等。
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const binPath = path.join(__dirname, 'gesp4_mock2_task_greedy_ref');

function runCpp(inputStr) {
  const out = execSync(binPath, {
    input: inputStr,
    encoding: 'utf8',
    timeout: 30000,
  });
  return out.trim();
}

function buildInput(tasks) {
  let s = tasks.length + '\n';
  for (const [d, w] of tasks)
    s += d + ' ' + w + '\n';
  return s.trimEnd();
}

function main() {
  if (!fs.existsSync(binPath)) {
    console.error('请先在 scripts 目录编译：g++ -O2 -std=c++17 gesp4_mock2_task_greedy_ref.cpp -o gesp4_mock2_task_greedy_ref');
    process.exit(1);
  }

  const testCases = [];

  // 1. 样例：按 d 升序贪心
  testCases.push({
    tasks: [[1, 10], [2, 20], [2, 15], [3, 30]],
    explanation: '样例：排序后 (1,10)(2,20)(2,15)(3,30)，时刻 0,1,2,3 各做一个，总得分 10+20+15+30=75。',
  });

  // 2. 单任务
  testCases.push({ tasks: [[5, 100]] });

  // 3. 全部能做
  testCases.push({
    tasks: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]],
  });

  // 4. 有截止时间早的，会放弃后面的
  testCases.push({
    tasks: [[0, 50], [1, 10], [1, 10]],
  });

  // 5. 多关键字：同 d 按 w 降序
  testCases.push({
    tasks: [[2, 5], [2, 10], [2, 8], [3, 1]],
  });

  // 6. 确定性 10 个任务
  const t6 = [];
  for (let i = 0; i < 10; i++) t6.push([i, (i * 7 + 3) % 20 + 1]);
  testCases.push({ tasks: t6 });

  // 7. 部分超过截止
  testCases.push({
    tasks: [[0, 100], [0, 90], [1, 80], [2, 70]],
  });

  // 8. 规模稍大
  const t8 = [];
  for (let i = 0; i < 20; i++) t8.push([(i * 3) % 15, (i * 11 + 5) % 50 + 1]);
  testCases.push({ tasks: t8 });

  // 9. 边界：d 都很大
  testCases.push({
    tasks: [[10, 1], [10, 2], [10, 3], [10, 4], [10, 5]],
  });

  // 10. 边界：d 紧挨
  testCases.push({
    tasks: [[0, 5], [1, 4], [2, 3], [3, 2], [4, 1]],
  });

  const results = [];
  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const inputStr = buildInput(tc.tasks);
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

  const outPath = path.join(__dirname, 'gesp4_mock2_task_greedy_tests.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log('已生成', results.length, '个测试点 ->', outPath);
}

main();
