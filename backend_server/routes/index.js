const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// 导入各个功能模块路由
const authRoutes = require('./auth');
const userRoutes = require('./users');
const teacherRoutes = require('./teachers');
const questionRoutes = require('./questions');
const examRoutes = require('./exams');
const submissionRoutes = require('./submissions');
const knowledgeRoutes = require('./knowledge');
const ojRoutes = require('./oj');
const learningPlanRoutes = require('./learningPlans');
const testRoutes = require('./tests');
const questionTypesRoutes = require('./questionTypes');
const growthPetRoutes = require('./growthPets');

// 健康检查接口
router.get('/api/health', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// 注册路由
router.use('/api', authRoutes);
router.use('/api', userRoutes);
router.use('/api', teacherRoutes);
router.use('/api', questionRoutes);
router.use('/api', examRoutes);
router.use('/api', submissionRoutes);
router.use('/api', knowledgeRoutes);
router.use('/api', ojRoutes);
router.use('/api', learningPlanRoutes);
router.use('/api', testRoutes);
router.use('/api', questionTypesRoutes);
router.use('/api', growthPetRoutes);

module.exports = router;
