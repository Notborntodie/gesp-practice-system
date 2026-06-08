const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { logger } = require('../config/logger');
const { getUserGrowthPet, syncUserPetPoints } = require('../services/growthPetService');

function parseUserId(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeNickname(value, fallback) {
  const text = typeof value === 'string' ? value.trim() : '';
  return (text || fallback || '成长精灵').slice(0, 20);
}

router.get('/growth-pets/species', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const [speciesRows] = await connection.execute(
      `SELECT id, code, name, description, sort_order
       FROM growth_pet_species
       WHERE is_active = 1
       ORDER BY sort_order ASC, id ASC`
    );

    const [stageRows] = await connection.execute(
      `SELECT gps.code as species_code, gpts.species_id, gpts.stage, gpts.stage_name, gpts.required_points, gpts.image_url
       FROM growth_pet_stages gpts
       JOIN growth_pet_species gps ON gps.id = gpts.species_id
       WHERE gps.is_active = 1
       ORDER BY gps.sort_order ASC, gpts.stage ASC`
    );

    const stagesBySpecies = stageRows.reduce((acc, stage) => {
      if (!acc[stage.species_id]) acc[stage.species_id] = [];
      acc[stage.species_id].push(stage);
      return acc;
    }, {});

    res.json({
      success: true,
      data: speciesRows.map(species => ({
        ...species,
        stages: stagesBySpecies[species.id] || []
      }))
    });
  } catch (error) {
    logger.error('获取成长精灵种类失败:', error);
    res.status(500).json({ success: false, error: '获取成长精灵种类失败', message: error.message });
  } finally {
    connection.release();
  }
});

router.get('/growth-pets/me', async (req, res) => {
  const userId = parseUserId(req.query.user_id);
  if (!userId) {
    return res.status(400).json({ success: false, error: '缺少必需参数: user_id' });
  }

  const connection = await pool.getConnection();
  try {
    const data = await getUserGrowthPet(connection, userId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('获取我的成长精灵失败:', error);
    res.status(500).json({ success: false, error: '获取我的成长精灵失败', message: error.message });
  } finally {
    connection.release();
  }
});

router.post('/growth-pets/choose', async (req, res) => {
  const userId = parseUserId(req.body.user_id);
  const speciesId = parseUserId(req.body.species_id);

  if (!userId || !speciesId) {
    return res.status(400).json({ success: false, error: '缺少必需参数: user_id, species_id' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [userRows] = await connection.execute('SELECT id, username, real_name FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    const [speciesRows] = await connection.execute(
      'SELECT id, name FROM growth_pet_species WHERE id = ? AND is_active = 1',
      [speciesId]
    );
    if (speciesRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: '成长精灵不存在或不可用' });
    }

    const nickname = normalizeNickname(req.body.nickname, speciesRows[0].name);
    const [pointRows] = await connection.execute(
      'SELECT COALESCE(SUM(points), 0) as total_points FROM growth_pet_point_events WHERE user_id = ?',
      [userId]
    );
    const totalPoints = Number(pointRows[0]?.total_points || 0);

    await connection.execute(
      `INSERT INTO user_growth_pets (user_id, species_id, nickname, current_stage, total_points)
       VALUES (?, ?, ?, 1, ?)
       ON DUPLICATE KEY UPDATE updated_at = NOW()`,
      [userId, speciesId, nickname, totalPoints]
    );

    await syncUserPetPoints(connection, userId);
    const data = await getUserGrowthPet(connection, userId);

    await connection.commit();
    res.json({ success: true, message: '成长精灵选择成功', data });
  } catch (error) {
    await connection.rollback();
    logger.error('选择成长精灵失败:', error);
    res.status(500).json({ success: false, error: '选择成长精灵失败', message: error.message });
  } finally {
    connection.release();
  }
});

router.post('/growth-pets/evolve', async (req, res) => {
  const userId = parseUserId(req.body.user_id);
  if (!userId) {
    return res.status(400).json({ success: false, error: '缺少必需参数: user_id' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [petRows] = await connection.execute(
      `SELECT user_id, species_id, current_stage, total_points
       FROM user_growth_pets
       WHERE user_id = ?
       FOR UPDATE`,
      [userId]
    );

    if (petRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, error: '请先选择成长精灵' });
    }

    const pet = petRows[0];
    const totalPoints = await syncUserPetPoints(connection, userId);
    const [nextRows] = await connection.execute(
      `SELECT stage, required_points
       FROM growth_pet_stages
       WHERE species_id = ? AND stage > ?
       ORDER BY stage ASC
       LIMIT 1`,
      [pet.species_id, pet.current_stage]
    );

    if (nextRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, error: '成长精灵已经进化到最高阶段' });
    }

    const nextStage = nextRows[0];
    if (totalPoints < Number(nextStage.required_points || 0)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        error: `积分不足，还需要 ${Number(nextStage.required_points) - totalPoints} 分`
      });
    }

    await connection.execute(
      'UPDATE user_growth_pets SET current_stage = ?, total_points = ?, updated_at = NOW() WHERE user_id = ?',
      [nextStage.stage, totalPoints, userId]
    );

    const data = await getUserGrowthPet(connection, userId);
    await connection.commit();

    res.json({ success: true, message: '成长精灵进化成功', data });
  } catch (error) {
    await connection.rollback();
    logger.error('成长精灵进化失败:', error);
    res.status(500).json({ success: false, error: '成长精灵进化失败', message: error.message });
  } finally {
    connection.release();
  }
});

router.get('/growth-pets/leaderboard', async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
  const connection = await pool.getConnection();

  try {
    const [rows] = await connection.execute(
      `SELECT
         ugp.user_id,
         COALESCE(u.real_name, u.username) as display_name,
         ugp.nickname,
         ugp.current_stage,
         ugp.total_points,
         gps.name as species_name,
         gpts.stage_name,
         gpts.image_url,
         latest.latest_event_at
       FROM user_growth_pets ugp
       JOIN users u ON u.id = ugp.user_id
       JOIN growth_pet_species gps ON gps.id = ugp.species_id
       LEFT JOIN growth_pet_stages gpts ON gpts.species_id = ugp.species_id AND gpts.stage = ugp.current_stage
       LEFT JOIN (
         SELECT user_id, MAX(created_at) as latest_event_at
         FROM growth_pet_point_events
         GROUP BY user_id
       ) latest ON latest.user_id = ugp.user_id
       ORDER BY ugp.total_points DESC, latest.latest_event_at DESC, ugp.updated_at DESC
       LIMIT ${limit}`
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error('获取成长精灵榜失败:', error);
    res.status(500).json({ success: false, error: '获取成长精灵榜失败', message: error.message });
  } finally {
    connection.release();
  }
});

module.exports = router;
