/**
 * 密码强度：生成 password_strength_tests.json。
 * 安全密码 = 至少8字符 + 至少一大写字母 + 至少一数字。
 */
const fs = require('fs');
const path = require('path');

function isSecure(pwd) {
  if (pwd.length < 8) return false;
  var u = false, d = false;
  for (var i = 0; i < pwd.length; i++) {
    if (pwd[i] >= 'A' && pwd[i] <= 'Z') u = true;
    if (pwd[i] >= '0' && pwd[i] <= '9') d = true;
  }
  return u && d;
}

function run(s) {
  var lines = s.trim().split('\n');
  var T = parseInt(lines[0], 10);
  var out = [];
  for (var i = 1; i <= T && i < lines.length; i++) {
    out.push(isSecure(lines[i]) ? 'Y' : 'N');
  }
  return out.join('\n');
}

var sampleInput = '6\nPAs1s2an\n1a2bCql3\nPa12bsna\nab1da3cd\nPaabdbcd\nPa2';
var results = [
  { input: sampleInput, output: run(sampleInput), is_hidden: false, is_displayed: true, sort_order: 1, explanation: '样例：6 组密码，前三个满足 8 位+大写+数字输出 Y，后三个不满足输出 N。' },
  { input: '1\nAbcdef12', output: 'Y', is_hidden: true, is_displayed: false, sort_order: 2, explanation: null },
  { input: '1\naaaaaaaa', output: 'N', is_hidden: true, is_displayed: false, sort_order: 3, explanation: null },
  { input: '1\nAB1', output: 'N', is_hidden: true, is_displayed: false, sort_order: 4, explanation: null },
  { input: '2\nXyZ12345\nshort', output: 'Y\nN', is_hidden: true, is_displayed: false, sort_order: 5, explanation: null },
  { input: '3\nA1bcdefg\nabcdefG8\n12345678', output: 'Y\nY\nN', is_hidden: true, is_displayed: false, sort_order: 6, explanation: null },
  { input: '5\nSecureP1\nNoUpper1\nNoDigitAb\nTooShort\nQwErTy99', output: 'Y\nY\nN\nN\nY', is_hidden: true, is_displayed: false, sort_order: 7, explanation: null },
  { input: '1\naaaaaaaA1', output: 'Y', is_hidden: true, is_displayed: false, sort_order: 8, explanation: null },
  { input: '1\nAbcdefgh', output: 'N', is_hidden: true, is_displayed: false, sort_order: 9, explanation: null },
  { input: '2\n1234567A\nB2345678', output: 'Y\nY', is_hidden: true, is_displayed: false, sort_order: 10, explanation: null },
];

fs.writeFileSync(path.join(__dirname, 'password_strength_tests.json'), JSON.stringify(results, null, 2), 'utf8');
console.log('已生成', results.length, '个测试点 -> password_strength_tests.json');
