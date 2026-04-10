/**
 * 仅更新「黄金格」题目的 description 为 Markdown 格式（便于渲染）。
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'gesp_user',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gesp_practice_system',
  charset: 'utf8mb4',
};

const DESCRIPTION = `小杨发现了一张神奇的矩形地图，地图有 $H$ 行和 $W$ 列。

每个格子的坐标表示为 $(r, c)$，其中 $r$ 代表行号（从 $1$ 到 $H$），$c$ 代表列号（从 $1$ 到 $W$）。

地图中隐藏着「黄金格」，这些格子满足一个特定的数学不等式关系。

黄金格的条件是：$\\sqrt{r^2 + c^2} \\leq x + r - c$

示例：如果参数 $x=5$，格子 $(4,3)$ 就是黄金格。因为左边 $\\sqrt{4^2 + 3^2} = \\sqrt{25} = 5$，而右边 $x + r - c = 5 + 4 - 3 = 6$。$5 \\leq 6$ 成立，所以 $(4,3)$ 是黄金格。

请你计算满足条件的黄金格总数。`;

async function main() {
  const connection = await mysql.createConnection(dbConfig);
  const [res] = await connection.execute(
    "UPDATE oj_problems SET description = ? WHERE title = '[GESP202512 二级] 黄金格'",
    [DESCRIPTION]
  );
  await connection.end();
  console.log('已更新题目描述，影响行数:', res.affectedRows);
}

main().catch((e) => { console.error(e); process.exit(1); });
