const EXAM_COMPLETION_MAX_POINTS = 10;
const OJ_ACCEPTED_POINTS = 20;

const REWARD_RULES = {
  oj: OJ_ACCEPTED_POINTS
};

function toInt(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

async function getPlanIdForTask(connection, taskId) {
  const [rows] = await connection.execute(
    'SELECT plan_id FROM learning_tasks WHERE id = ?',
    [taskId]
  );
  return rows.length > 0 ? rows[0].plan_id : null;
}

function calculateExamPoints(score) {
  const n = Number(score);
  if (!Number.isFinite(n) || n < 60) return 0;
  return Math.min(EXAM_COMPLETION_MAX_POINTS, Math.max(6, Math.floor(n / 10)));
}

function calculateRewardPoints(sourceType, options) {
  if (sourceType === 'exam') {
    return calculateExamPoints(options.score);
  }
  return REWARD_RULES[sourceType] || 0;
}

async function syncUserPetPoints(connection, userId) {
  const [sumRows] = await connection.execute(
    'SELECT COALESCE(SUM(points), 0) as total_points FROM growth_pet_point_events WHERE user_id = ?',
    [userId]
  );
  const totalPoints = Number(sumRows[0]?.total_points || 0);

  await connection.execute(
    'UPDATE user_growth_pets SET total_points = ?, updated_at = NOW() WHERE user_id = ?',
    [totalPoints, userId]
  );

  return totalPoints;
}

async function awardGrowthPetPoints(connection, options) {
  const userId = toInt(options.user_id);
  const taskId = toInt(options.task_id);
  const sourceId = toInt(options.source_id);
  const sourceType = options.source_type;

  const points = calculateRewardPoints(sourceType, options);

  if (!userId || !taskId || !sourceId || points <= 0) {
    return { awarded: false, points: 0, reason: 'invalid_reward_context' };
  }

  const planId = options.plan_id ? toInt(options.plan_id) : await getPlanIdForTask(connection, taskId);
  if (!planId) {
    return { awarded: false, points: 0, reason: 'missing_plan' };
  }

  const uniqueKey = `${sourceType}:${userId}:${taskId}:${sourceId}`;

  const [insertResult] = await connection.execute(
    `INSERT IGNORE INTO growth_pet_point_events
      (user_id, source_type, source_id, task_id, plan_id, points, unique_key)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, sourceType, sourceId, taskId, planId, points, uniqueKey]
  );

  if (insertResult.affectedRows === 0) {
    return { awarded: false, points: 0, reason: 'duplicate_reward' };
  }

  const totalPoints = await syncUserPetPoints(connection, userId);

  return {
    awarded: true,
    points,
    source_type: sourceType,
    source_id: sourceId,
    task_id: taskId,
    plan_id: planId,
    total_points: totalPoints
  };
}

async function getPetStageSummary(connection, speciesId, currentStage, totalPoints) {
  const [currentRows] = await connection.execute(
    `SELECT id, species_id, stage, stage_name, required_points, image_url
     FROM growth_pet_stages
     WHERE species_id = ? AND stage = ?`,
    [speciesId, currentStage]
  );

  const [nextRows] = await connection.execute(
    `SELECT id, species_id, stage, stage_name, required_points, image_url
     FROM growth_pet_stages
     WHERE species_id = ? AND stage > ?
     ORDER BY stage ASC
     LIMIT 1`,
    [speciesId, currentStage]
  );

  const nextStage = nextRows[0] || null;

  return {
    current_stage: currentRows[0] || null,
    next_stage: nextStage,
    can_evolve: Boolean(nextStage && totalPoints >= Number(nextStage.required_points || 0))
  };
}

async function getUnfinishedReminder(connection, userId) {
  const [summaryRows] = await connection.execute(
    `SELECT
       COUNT(DISTINCT lt.id) as pending_tasks,
       MIN(lt.start_time) as next_start_time
     FROM user_learning_plans ulp
     JOIN learning_plans lp ON lp.id = ulp.plan_id AND lp.is_active = 1
     JOIN learning_tasks lt ON lt.plan_id = lp.id
     LEFT JOIN user_task_progress utp ON utp.task_id = lt.id AND utp.user_id = ulp.user_id
     WHERE ulp.user_id = ?
       AND COALESCE(utp.is_completed, 0) = 0
       AND (lt.end_time IS NULL OR lt.end_time >= NOW())`,
    [userId]
  );

  const [taskRows] = await connection.execute(
    `SELECT lt.id, lt.name, lp.name as plan_name, lp.level, lt.start_time, lt.end_time
     FROM user_learning_plans ulp
     JOIN learning_plans lp ON lp.id = ulp.plan_id AND lp.is_active = 1
     JOIN learning_tasks lt ON lt.plan_id = lp.id
     LEFT JOIN user_task_progress utp ON utp.task_id = lt.id AND utp.user_id = ulp.user_id
     WHERE ulp.user_id = ?
       AND COALESCE(utp.is_completed, 0) = 0
       AND (lt.end_time IS NULL OR lt.end_time >= NOW())
     ORDER BY
       CASE WHEN lt.start_time IS NULL THEN 1 ELSE 0 END,
       lt.start_time ASC,
       lt.task_order ASC
     LIMIT 1`,
    [userId]
  );

  const pendingTasks = Number(summaryRows[0]?.pending_tasks || 0);
  return {
    pending_tasks: pendingTasks,
    next_task: taskRows[0] || null,
    message: pendingTasks > 0
      ? `还有 ${pendingTasks} 个成长任务等你完成`
      : '今天的成长任务都完成啦'
  };
}

async function getUserGrowthPet(connection, userId) {
  const uid = toInt(userId);
  if (!uid) {
    throw new Error('缺少有效用户ID');
  }

  const [petRows] = await connection.execute(
    `SELECT
       ugp.id,
       ugp.user_id,
       ugp.species_id,
       ugp.nickname,
       ugp.current_stage,
       ugp.total_points,
       ugp.created_at,
       ugp.updated_at,
       gps.name as species_name,
       gps.description as species_description
     FROM user_growth_pets ugp
     JOIN growth_pet_species gps ON gps.id = ugp.species_id
     WHERE ugp.user_id = ?`,
    [uid]
  );

  const reminder = await getUnfinishedReminder(connection, uid);

  if (petRows.length === 0) {
    const [pointsRows] = await connection.execute(
      'SELECT COALESCE(SUM(points), 0) as total_points FROM growth_pet_point_events WHERE user_id = ?',
      [uid]
    );
    return {
      initialized: false,
      pet: null,
      total_points: Number(pointsRows[0]?.total_points || 0),
      reminder
    };
  }

  const pet = petRows[0];
  const totalPoints = await syncUserPetPoints(connection, uid);
  const stageSummary = await getPetStageSummary(connection, pet.species_id, pet.current_stage, totalPoints);

  return {
    initialized: true,
    pet: {
      ...pet,
      total_points: totalPoints,
      current_stage_info: stageSummary.current_stage,
      next_stage_info: stageSummary.next_stage,
      can_evolve: stageSummary.can_evolve
    },
    total_points: totalPoints,
    reminder
  };
}

module.exports = {
  EXAM_COMPLETION_MAX_POINTS,
  OJ_ACCEPTED_POINTS,
  awardGrowthPetPoints,
  calculateExamPoints,
  getUserGrowthPet,
  syncUserPetPoints
};
