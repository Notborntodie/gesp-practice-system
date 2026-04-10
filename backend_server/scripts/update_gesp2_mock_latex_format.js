require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');
const path = require('path');
const { execSync } = require('child_process');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'gesp_user',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gesp_practice_system',
  charset: 'utf8mb4',
};

async function main() {
  const connection = await mysql.createConnection(dbConfig);

  // 题目 132：小杨的曼哈顿圈 —— 只描述规则含义，不直接给公式
  const desc132 = `小杨在方格纸上画了一个 $n \\times n$ 的矩阵（$n$ 为奇数），行列编号从 1 到 $n$。

他从矩阵**正中心**的格子出发，每次只能向**上、下、左、右**走一格（不能斜走）。在所有格子中，**恰好走 $r$ 步能到达**的格子画 \`#\`，不能恰好 $r$ 步到达的格子画 \`.\`。这样得到的图案叫做 **曼哈顿圈**。

例如 $n=5$、$r=1$ 时，中心是第 3 行第 3 列，恰好 1 步能到的格子是上下左右四个邻格，输出如样例所示。

请你根据给定的 $n$ 和 $r$ 输出这个曼哈顿圈图案。`;

  const input132 = `输入共两行：

- 第一行，一个奇数整数 $n$，表示矩阵大小；
- 第二行，一个正整数 $r$，表示“步数”。`;

  const output132 = `输出共 $n$ 行，每行 $n$ 个字符，只包含 \`#\` 和 \`.\`，中间不能有多余的空格。`;

  const range132 = `- $1 \\le n \\le 99$，且 $n$ 为奇数；
- $1 \\le r \\le \\dfrac{n-1}{2}$。`;

  const analysis132 = `本题属于 **嵌套循环画图** 类型，需要自己归纳“规律”。

解题思路：

1. 读入 $n$ 和 $r$。矩阵正中心即第 $\\dfrac{n+1}{2}$ 行、第 $\\dfrac{n+1}{2}$ 列；
2. “恰好走 $r$ 步能到达”等价于该格子到中心的**曼哈顿距离**为 $r$，即 $|i - mid| + |j - mid| = r$；
3. 两重循环枚举行 $i$、列 $j$，若 $|i-mid|+|j-mid| = r$ 输出 \`#\`，否则输出 \`.\`；
4. 每行结束后换行。`;

  try {
    // 更新 132
    console.log('更新题目 132（小杨的曼哈顿圈）的文本字段为 $...$ 数学格式...');
    await connection.execute(
      `UPDATE oj_problems
       SET description = ?, input_format = ?, output_format = ?, data_range = ?, analysis = ?
       WHERE id = 132`,
      [desc132, input132, output132, range132, analysis132]
    );

    console.log('题目 132 文本字段更新完成。');

    // 清缓存
    for (const id of [132]) {
      try {
        console.log(`调用 clear_problem_cache.js 清理题目 ${id} 的缓存...`);
        execSync(`node ${path.join(__dirname, 'clear_problem_cache.js')} ${id}`, {
          stdio: 'inherit',
        });
      } catch (e) {
        console.error(`清理题目 ${id} 缓存时出错:`, e.message);
      }
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();

