const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// 数据库连接配置（从环境变量读取，支持 .env 文件）
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'gesp_user',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gesp_practice_system',
  charset: 'utf8mb4',
  multipleStatements: true  // 允许多语句执行
};

async function initOJDatabase() {
  let connection;
  
  try {
    console.log('正在连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功！\n');
    
    // 1. 创建 oj_problems 表
    console.log('创建 oj_problems 表...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS oj_problems (
        -- 基础信息
        id INT PRIMARY KEY AUTO_INCREMENT COMMENT '题目ID',
        title VARCHAR(200) NOT NULL COMMENT '题目标题',
        
        -- 题目内容（Markdown格式）
        description TEXT NOT NULL COMMENT '题目描述',
        input_format TEXT COMMENT '输入格式说明',
        output_format TEXT COMMENT '输出格式说明',
        data_range TEXT COMMENT '数据范围说明',
        analysis TEXT COMMENT '题目文字解析说明，用于 Test「我的解析」展示官方解析',
        
        -- 限制条件
        time_limit INT DEFAULT 1000 COMMENT '时间限制（毫秒）',
        memory_limit INT DEFAULT 256 COMMENT '内存限制（MB）',
        
        -- 分类信息
        level INT NOT NULL COMMENT 'GESP级别 1-8',
        publish_date DATE COMMENT '发布日期（年月日）',
        
        -- 统计信息（自动更新）
        total_submissions INT DEFAULT 0 COMMENT '总提交数',
        accepted_submissions INT DEFAULT 0 COMMENT '通过提交数',
        
        -- 题库可见（仅影响 level-exams 题库列表）
        bank_visible TINYINT(1) NOT NULL DEFAULT 1 COMMENT '题库可见：1=可见 0=不可见',
        
        -- 时间戳
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        
        -- 索引
        INDEX idx_level (level),
        INDEX idx_publish_date (publish_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='OJ题目表'
    `);
    console.log('✓ oj_problems 表创建成功\n');
    
    // 2. 创建 oj_samples 表
    console.log('创建 oj_samples 表...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS oj_samples (
        id INT PRIMARY KEY AUTO_INCREMENT COMMENT '样例ID',
        problem_id INT NOT NULL COMMENT '题目ID',
        
        -- 测试数据
        input TEXT NOT NULL COMMENT '输入数据',
        output TEXT NOT NULL COMMENT '预期输出',
        explanation TEXT COMMENT '样例说明（可选，支持Markdown）',
        
        -- 用例属性
        is_hidden BOOLEAN DEFAULT FALSE COMMENT '是否为隐藏测试点（true=提交后不显示详细信息，false=提交后可显示）',
        is_displayed BOOLEAN DEFAULT TRUE COMMENT '是否在查看题目时展示（true=展示，false=不展示）',
        
        -- 排序
        sort_order INT DEFAULT 0 COMMENT '显示顺序',
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        -- 索引
        INDEX idx_problem_id (problem_id),
        INDEX idx_problem_hidden (problem_id, is_hidden),
        INDEX idx_problem_displayed (problem_id, is_displayed),
        
        FOREIGN KEY (problem_id) REFERENCES oj_problems(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='OJ测试样例表'
    `);
    console.log('✓ oj_samples 表创建成功\n');
    
    // 3. 插入示例题目
    console.log('插入示例题目：数组清零...');
    const [result] = await connection.query(`
      INSERT INTO oj_problems (
        title, 
        description, 
        input_format, 
        output_format, 
        data_range,
        analysis,
        time_limit,
        memory_limit,
        level, 
        publish_date,
        bank_visible
      ) VALUES (
        '数组清零',
        '小A有一个由n个非负整数构成的数组 **a = [a₁,a₂,...,aₙ]**。他会对数组a重复进行以下操作：

**操作：** 从数组a中找到**最大**的元素，将其值减1，直到数组a中所有元素都变成0为止。

请你帮小A计算一下，他需要进行多少次操作才能将数组a中的所有整数都变成0？',
        '**第一行**：一个正整数 **n**，表示数组a的长度。

**第二行**：n个非负整数 **a₁, a₂, ..., aₙ**，表示数组a的元素。',
        '**一行**一个正整数，表示a中整数全部变成0所需要的**操作次数**。',
        '对于所有测试点，保证 **1 ≤ n ≤ 100**，**0 ≤ aᵢ ≤ 100**',
        '本题的总操作次数等于数组中所有元素之和，因为每次操作都会把某个元素减 1，直到全部变为 0。',
        1000,
        256,
        4,
        '2024-10-15',
        1
      )
    `);
    
    const problemId = result.insertId;
    console.log(`✓ 题目创建成功，ID: ${problemId}\n`);
    
    // 4. 插入测试样例
    console.log('插入测试样例...');
    
    // 展示样例1
    await connection.query(`
      INSERT INTO oj_samples (problem_id, input, output, explanation, is_hidden, sort_order) 
      VALUES (?, ?, ?, ?, ?, ?)
    `, [problemId, '3\n2 3 4', '7', '按照题目描述的操作步骤，需要 **7** 次操作才能将数组清零。', false, 1]);
    console.log('✓ 展示样例1插入成功');
    
    // 展示样例2
    await connection.query(`
      INSERT INTO oj_samples (problem_id, input, output, explanation, is_hidden, sort_order) 
      VALUES (?, ?, ?, ?, ?, ?)
    `, [problemId, '5\n1 3 2 2 5', '13', '按照题目描述的操作步骤，需要 **13** 次操作才能将数组清零。', false, 2]);
    console.log('✓ 展示样例2插入成功');
    
    // 隐藏测试点1
    await connection.query(`
      INSERT INTO oj_samples (problem_id, input, output, explanation, is_hidden, sort_order) 
      VALUES (?, ?, ?, ?, ?, ?)
    `, [problemId, '4\n1 1 1 1', '4', null, true, 3]);
    console.log('✓ 隐藏测试点1插入成功');
    
    // 隐藏测试点2
    await connection.query(`
      INSERT INTO oj_samples (problem_id, input, output, explanation, is_hidden, sort_order) 
      VALUES (?, ?, ?, ?, ?, ?)
    `, [problemId, '1\n100', '100', null, true, 4]);
    console.log('✓ 隐藏测试点2插入成功');
    
    // 隐藏测试点3
    await connection.query(`
      INSERT INTO oj_samples (problem_id, input, output, explanation, is_hidden, sort_order) 
      VALUES (?, ?, ?, ?, ?, ?)
    `, [problemId, '10\n10 20 30 40 50 60 70 80 90 100', '550', null, true, 5]);
    console.log('✓ 隐藏测试点3插入成功\n');
    
    // 5. 验证数据
    console.log('验证插入的数据...');
    const [problems] = await connection.query('SELECT COUNT(*) as total FROM oj_problems');
    console.log(`题目总数: ${problems[0].total}`);
    
    const [samples] = await connection.query('SELECT COUNT(*) as total FROM oj_samples WHERE problem_id = ?', [problemId]);
    console.log(`测试样例总数: ${samples[0].total}`);
    
    const [displaySamples] = await connection.query('SELECT COUNT(*) as total FROM oj_samples WHERE problem_id = ? AND is_hidden = FALSE', [problemId]);
    console.log(`展示样例数: ${displaySamples[0].total}`);
    
    const [hiddenSamples] = await connection.query('SELECT COUNT(*) as total FROM oj_samples WHERE problem_id = ? AND is_hidden = TRUE', [problemId]);
    console.log(`隐藏测试点数: ${hiddenSamples[0].total}\n`);
    
    console.log('=========================================');
    console.log('✅ OJ数据库初始化完成！');
    console.log('=========================================');
    
  } catch (error) {
    console.error('❌ 初始化失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

// 执行初始化
initOJDatabase();

