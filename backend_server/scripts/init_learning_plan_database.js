const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// 数据库连接配置（从环境变量读取）
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'gesp_user',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gesp_practice_system',
  charset: 'utf8mb4',
  multipleStatements: true
};

async function initLearningPlanDatabase() {
  let connection;
  
  try {
    console.log('正在连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功！\n');
    
    console.log('=========================================');
    console.log('开始创建学习计划系统数据表');
    console.log('=========================================\n');
    
    // 1. 创建 learning_plans 表
    console.log('1. 创建 learning_plans 表（学习计划）...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS learning_plans (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL COMMENT '计划名称',
        description TEXT COMMENT '计划描述',
        level INT NOT NULL COMMENT 'GESP级别(1-8)',
        start_time DATETIME NOT NULL COMMENT '开始时间',
        end_time DATETIME NOT NULL COMMENT '结束时间',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by INT COMMENT '创建者ID',
        is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
        INDEX idx_level (level),
        INDEX idx_time (start_time, end_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='学习计划表'
    `);
    console.log('✓ learning_plans 表创建成功\n');
    
    // 2. 创建 learning_tasks 表
    console.log('2. 创建 learning_tasks 表（学习任务）...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS learning_tasks (
        id INT PRIMARY KEY AUTO_INCREMENT,
        plan_id INT NOT NULL COMMENT '所属计划ID',
        name VARCHAR(255) NOT NULL COMMENT '任务名称',
        description TEXT COMMENT '任务描述',
        review_content TEXT COMMENT '复习内容（文本）',
        review_video_url VARCHAR(500) COMMENT '复习视频链接',
        start_time DATETIME NOT NULL COMMENT '开始时间',
        end_time DATETIME NOT NULL COMMENT '结束时间',
        task_order INT DEFAULT 0 COMMENT '任务顺序',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (plan_id) REFERENCES learning_plans(id) ON DELETE CASCADE,
        INDEX idx_plan_id (plan_id),
        INDEX idx_order (task_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='学习任务表'
    `);
    console.log('✓ learning_tasks 表创建成功\n');
    
    // 3. 创建 task_exams 表
    console.log('3. 创建 task_exams 表（任务-客观题关联）...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS task_exams (
        id INT PRIMARY KEY AUTO_INCREMENT,
        task_id INT NOT NULL COMMENT '任务ID',
        exam_id INT NOT NULL COMMENT '考试ID',
        exam_order INT DEFAULT 0 COMMENT '练习顺序',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES learning_tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
        UNIQUE KEY uk_task_exam (task_id, exam_id),
        INDEX idx_task_id (task_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='任务-客观题关联表'
    `);
    console.log('✓ task_exams 表创建成功\n');
    
    // 4. 创建 task_oj_problems 表
    console.log('4. 创建 task_oj_problems 表（任务-OJ题关联）...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS task_oj_problems (
        id INT PRIMARY KEY AUTO_INCREMENT,
        task_id INT NOT NULL COMMENT '任务ID',
        problem_id INT NOT NULL COMMENT 'OJ题目ID',
        problem_order INT DEFAULT 0 COMMENT '题目顺序',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES learning_tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (problem_id) REFERENCES oj_problems(id) ON DELETE CASCADE,
        UNIQUE KEY uk_task_problem (task_id, problem_id),
        INDEX idx_task_id (task_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='任务-OJ题关联表'
    `);
    console.log('✓ task_oj_problems 表创建成功\n');
    
    // 5. 创建 user_learning_plans 表
    console.log('5. 创建 user_learning_plans 表（用户加入的计划）...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_learning_plans (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL COMMENT '用户ID',
        plan_id INT NOT NULL COMMENT '计划ID',
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '加入时间',
        status VARCHAR(50) DEFAULT 'active' COMMENT '状态: active/completed/cancelled',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (plan_id) REFERENCES learning_plans(id) ON DELETE CASCADE,
        UNIQUE KEY uk_user_plan (user_id, plan_id),
        INDEX idx_user_id (user_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户加入的计划表'
    `);
    console.log('✓ user_learning_plans 表创建成功\n');
    
    // 6. 创建 user_task_progress 表
    console.log('6. 创建 user_task_progress 表（用户任务完成进度）...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_task_progress (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL COMMENT '用户ID',
        task_id INT NOT NULL COMMENT '任务ID',
        is_completed BOOLEAN DEFAULT FALSE COMMENT '是否完成',
        completed_at DATETIME COMMENT '完成时间',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES learning_tasks(id) ON DELETE CASCADE,
        UNIQUE KEY uk_user_task (user_id, task_id),
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户任务完成进度表'
    `);
    console.log('✓ user_task_progress 表创建成功\n');
    
    // 验证表是否创建成功
    console.log('=========================================');
    console.log('验证表创建情况...');
    console.log('=========================================\n');
    
    const tables = [
      'learning_plans',
      'learning_tasks',
      'task_exams',
      'task_oj_problems',
      'user_learning_plans',
      'user_task_progress'
    ];
    
    for (const table of tables) {
      const [rows] = await connection.query(
        `SELECT COUNT(*) as count FROM information_schema.tables 
         WHERE table_schema = 'gesp_practice_system' AND table_name = ?`,
        [table]
      );
      
      if (rows[0].count > 0) {
        console.log(`✓ ${table} 表存在`);
      } else {
        console.log(`✗ ${table} 表不存在`);
      }
    }
    
    console.log('\n=========================================');
    console.log('✅ 学习计划系统数据表初始化完成！');
    console.log('=========================================\n');
    
    console.log('创建的表：');
    console.log('1. learning_plans - 学习计划表');
    console.log('2. learning_tasks - 学习任务表');
    console.log('3. task_exams - 任务-客观题关联表');
    console.log('4. task_oj_problems - 任务-OJ题关联表');
    console.log('5. user_learning_plans - 用户加入的计划表');
    console.log('6. user_task_progress - 用户任务完成进度表');
    
  } catch (error) {
    console.error('\n❌ 初始化失败:', error.message);
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
initLearningPlanDatabase();

