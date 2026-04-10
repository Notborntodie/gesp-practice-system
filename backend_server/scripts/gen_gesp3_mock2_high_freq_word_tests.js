/**
 * 生成 [GESP 3级 模拟2] 高频词 的测试点。
 * 确定性生成：覆盖唯一最多、并列最多（字典序）、单词、多词等。
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const binPath = path.join(__dirname, 'gesp3_mock2_high_freq_word_ref');

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
    console.error('请先在 scripts 目录编译：g++ -O2 -std=c++17 gesp3_mock2_high_freq_word_ref.cpp -o gesp3_mock2_high_freq_word_ref');
    process.exit(1);
  }

  const testCases = [];

  // 1. 样例：多个出现次数相同，取字典序最小
  testCases.push({
    words: ['apple', 'banana', 'apple', 'banana', 'cat'],
    explanation: '样例：apple 和 banana 各 2 次，字典序最小为 apple。',
  });

  // 2. 唯一最多
  testCases.push({ words: ['a', 'b', 'a', 'a', 'c'] });

  // 3. 单个单词
  testCases.push({ words: ['only'] });

  // 4. 两个单词各一次，字典序
  testCases.push({ words: ['zz', 'aa'] });

  // 5. 三个并列 2 次，取字典序最小
  testCases.push({ words: ['x', 'y', 'z', 'x', 'y', 'z'] });

  // 6. 较长单词，唯一最多
  testCases.push({
    words: ['hello', 'world', 'hello', 'hello', 'world'],
  });

  // 7. 多组并列，取字典序
  testCases.push({
    words: ['dog', 'cat', 'dog', 'cat', 'bird', 'bird'],
  });

  // 8. 规模稍大，确定性序列
  const w8 = [];
  for (let i = 0; i < 10; i++) w8.push('same');
  for (let i = 0; i < 5; i++) w8.push('other');
  testCases.push({ words: w8 });

  // 9. 多个不同词，一个明显最多
  const w9 = ['a', 'b', 'c', 'd', 'e', 'a', 'a', 'a'];
  testCases.push({ words: w9 });

  // 10. 并列两个，字典序
  const w10 = ['first', 'second', 'first', 'second'];
  testCases.push({ words: w10 });

  const results = [];
  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const inputStr = `${tc.words.length}\n${tc.words.join('\n')}\n`;
    const output = runCpp(inputStr);
    const sortOrder = i + 1;
    results.push({
      input: inputStr.trimEnd(),
      output,
      is_hidden: sortOrder > 5,
      is_displayed: sortOrder === 1,
      sort_order: sortOrder,
      explanation: tc.explanation || null,
    });
  }

  const outPath = path.join(__dirname, 'gesp3_mock2_high_freq_word_tests.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log('已生成', results.length, '个测试点 ->', outPath);
}

main();
