const mysql = require('mysql2/promise');

// 数据库连接池配置（从环境变量读取，如果没有则使用默认值）
const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME ,
  charset: 'utf8mb4',
  // 连接池优化配置
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 20,  // 连接池大小
  acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 60000, // 获取连接超时时间
  timeout: parseInt(process.env.DB_TIMEOUT) || 60000,                // 查询超时时间
  reconnect: true,              // 自动重连
  queueLimit: 0,                // 队列限制（0表示无限制）
  enableKeepAlive: true,        // 启用连接保活
  keepAliveInitialDelay: 0,     // 保活初始延迟
  // 高并发优化
  multipleStatements: false,    // 禁用多语句查询（安全考虑）
  dateStrings: true,            // 日期作为字符串返回
  supportBigNumbers: true,      // 支持大数字
  bigNumberStrings: true,       // 大数字作为字符串
  // 连接池监控
  waitForConnections: true,
  maxIdle: parseInt(process.env.DB_MAX_IDLE) || 60000,      // 最大空闲时间
  idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT) || 60000  // 空闲超时
};

// 创建连接池
const pool = mysql.createPool(dbConfig);

// 连接池事件监听
pool.on('connection', (connection) => {
  console.log('新的数据库连接已创建');
  
  // 设置连接级别的配置
  connection.query('SET SESSION sql_mode = "NO_AUTO_VALUE_ON_ZERO"');
  connection.query('SET SESSION time_zone = "+08:00"');
});

pool.on('acquire', (connection) => {
  console.log('连接 %d 已从连接池获取', connection.threadId);
});

pool.on('release', (connection) => {
  console.log('连接 %d 已释放回连接池', connection.threadId);
});

pool.on('enqueue', () => {
  console.log('等待可用的连接...');
});

// 健康检查函数
const healthCheck = async () => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log('数据库连接池健康检查通过');
    return true;
  } catch (error) {
    console.error('数据库连接池健康检查失败:', error);
    return false;
  }
};

// ================================================================
// 题目类型验证函数
// ================================================================

/**
 * 获取所有启用的题目类型名称
 * @returns {Promise<string[]>} 题目类型名称数组
 */
const getValidCategories = async () => {
  try {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(`
        SELECT name
        FROM question_types
        WHERE is_active = 1
        ORDER BY sort_order ASC
      `);
      return rows.map(row => row.name);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('获取题目类型失败:', error);
    // 如果查询失败（比如表不存在），返回默认值
    return ['GESP', 'CSP_J', 'CSP_S', 'NOI_P', 'NOI_A', 'NOI_IOI', 'Other'];
  }
};

/**
 * 验证题目类型是否有效
 * @param {string} category - 题目类型
 * @returns {Promise<boolean>} 是否有效
 */
const isValidCategory = async (category) => {
  const validCategories = await getValidCategories();
  return validCategories.includes(category);
};

// 定期健康检查（每5分钟）
setInterval(healthCheck, 5 * 60 * 1000);

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('正在关闭数据库连接池...');
  await pool.end();
  process.exit(0);
});

module.exports = {
  pool,
  healthCheck,
  getValidCategories,
  isValidCategory
};

