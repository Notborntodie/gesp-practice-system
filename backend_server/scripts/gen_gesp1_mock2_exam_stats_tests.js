const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 参考程序编译后生成的可执行文件名
const binPath = path.join(__dirname, 'gesp1_mock2_exam_stats_ref');

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
    console.error('请先在 scripts 目录编译参考代码：g++ -O2 -std=c++17 gesp1_mock2_exam_stats_ref.cpp -o gesp1_mock2_exam_stats_ref');
    process.exit(1);
  }

  // 按 SKILL 约定生成 10 组确定性的测试数据：
  // - 覆盖：全不及格、全合格无优秀、全优秀、边界 0/60/90/100、大人数、多人数混合等
  // - 使用公式和简单规则生成，避免手写一长串具体数字

  function genAllFail(count) {
    const scores = [];
    for (let i = 0; i < count; i++) {
      scores.push((i * 7 + 5) % 60); // 0~59 内循环
    }
    return scores;
  }

  function genAllPassNoExcellent(count) {
    const scores = [];
    for (let i = 0; i < count; i++) {
      const base = 60 + (i * 7) % 30; // 60~89
      scores.push(base);
    }
    return scores;
  }

  function genAllExcellent(count) {
    const scores = [];
    for (let i = 0; i < count; i++) {
      const base = 90 + (i * 3) % 11; // 90~100
      scores.push(base);
    }
    return scores;
  }

  function genMixed(count) {
    const scores = [];
    for (let i = 0; i < count; i++) {
      if (i % 4 === 0) scores.push(55); // 不及格
      else if (i % 4 === 1) scores.push(60); // 刚合格
      else if (i % 4 === 2) scores.push(89); // 合格但非优秀
      else scores.push(90 + (i % 5)); // 优秀区间
    }
    return scores;
  }

  const testCases = [];

  // 1. 样例：少量学生，混合
  testCases.push({
    scores: [59, 60, 75, 89, 90],
    explanation: '样例：合格 3 人（60,75,90），优秀 1 人（90）。',
  });

  // 2. 全不及格（4 人）
  testCases.push({ scores: genAllFail(4) });

  // 3. 全合格但无优秀（5 人）
  testCases.push({ scores: genAllPassNoExcellent(5) });

  // 4. 全优秀（3 人）
  testCases.push({ scores: genAllExcellent(3) });

  // 5. 中等人数混合（10 人）
  testCases.push({ scores: genMixed(10) });

  // 6. 含 0 和 100 的边界（6 人）
  testCases.push({ scores: [0, 100, 60, 90, 59, 89] });

  // 7. 大部分合格，少数不及格（7 人）
  testCases.push({ scores: genAllPassNoExcellent(5).concat([50, 59]) });

  // 8. 大部分优秀，少数合格（8 人）
  testCases.push({ scores: genAllExcellent(5).concat([60, 70, 89]) });

  // 9. 单个学生（1 人）
  testCases.push({ scores: [75] });

  // 10. 较多学生（20 人），用混合生成
  testCases.push({ scores: genMixed(20) });

  const results = [];

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const T = tc.scores.length;
    const scoresLine = tc.scores.join(' ');
    const inputStr = `${T}\n${scoresLine}\n`;
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

  const outPath = path.join(__dirname, 'gesp1_mock2_exam_stats_tests.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log('已生成', results.length, '个测试点 ->', outPath);
}

main();

