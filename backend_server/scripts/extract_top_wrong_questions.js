// 首先加载环境变量
require('dotenv').config();

const { pool } = require('../config/database');
const fs = require('fs');
const path = require('path');

/**
 * 提取每个级别答错频率最高的50道题目
 * 
 * 功能：
 * 1. 统计每个级别（level 1-8）中答错次数最多的50道题目
 * 2. 导出为JSON和CSV格式
 * 3. 提供统计信息
 */

// 输出目录
const OUTPUT_DIR = path.join(__dirname, '../database/wrong_questions_export');
const MAX_QUESTIONS_PER_LEVEL = 50;

/**
 * 确保输出目录存在
 */
function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`✓ 创建输出目录: ${OUTPUT_DIR}`);
  }
}

/**
 * 将数据导出为JSON格式
 */
function exportToJSON(data, filename) {
  const filepath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`✓ JSON文件已保存: ${filepath}`);
  return filepath;
}

/**
 * 将数据导出为CSV格式
 */
function exportToCSV(data, filename) {
  const filepath = path.join(OUTPUT_DIR, filename);
  
  if (data.length === 0) {
    fs.writeFileSync(filepath, '', 'utf8');
    console.log(`✓ CSV文件已保存（空）: ${filepath}`);
    return filepath;
  }
  
  // 获取表头
  const headers = Object.keys(data[0]);
  
  // 构建CSV内容
  let csvContent = headers.join(',') + '\n';
  
  data.forEach(row => {
    const values = headers.map(header => {
      let value = row[header];
      // 处理包含逗号、引号或换行符的值
      if (value === null || value === undefined) {
        value = '';
      } else {
        value = String(value);
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          value = `"${value.replace(/"/g, '""')}"`;
        }
      }
      return value;
    });
    csvContent += values.join(',') + '\n';
  });
  
  // 写入BOM以支持Excel正确显示中文
  const BOM = '\uFEFF';
  fs.writeFileSync(filepath, BOM + csvContent, 'utf8');
  console.log(`✓ CSV文件已保存: ${filepath}`);
  return filepath;
}

/**
 * 获取题目的选项统计信息（每个选项被选错的次数）
 */
async function getOptionStatistics(connection, questionIds) {
  if (questionIds.length === 0) {
    return {};
  }
  
  const placeholders = questionIds.map(() => '?').join(',');
  
  // 查询每个选项被选错的次数
  const [optionStats] = await connection.execute(`
    SELECT 
      sa.question_id,
      sa.user_answer AS option_value,
      COUNT(*) AS wrong_count,
      o.option_label,
      o.option_text
    FROM submission_answers sa
    LEFT JOIN options o ON sa.question_id = o.question_id AND sa.user_answer = o.option_value
    WHERE sa.question_id IN (${placeholders})
      AND sa.is_correct = 0
    GROUP BY sa.question_id, sa.user_answer, o.option_label, o.option_text
    ORDER BY sa.question_id, wrong_count DESC
  `, questionIds);
  
  // 按题目ID组织数据
  const statsByQuestion = {};
  optionStats.forEach(stat => {
    const qid = stat.question_id;
    if (!statsByQuestion[qid]) {
      statsByQuestion[qid] = [];
    }
    statsByQuestion[qid].push({
      option_value: stat.option_value,
      option_label: stat.option_label || stat.option_value,
      option_text: stat.option_text || '',
      wrong_count: stat.wrong_count
    });
  });
  
  // 找出每道题最容易错的选项
  Object.keys(statsByQuestion).forEach(qid => {
    const options = statsByQuestion[qid];
    if (options.length > 0) {
      // 按答错次数降序排列，第一个就是最容易错的
      options.sort((a, b) => b.wrong_count - a.wrong_count);
      statsByQuestion[qid].most_wrong_option = options[0];
    }
  });
  
  return statsByQuestion;
}

/**
 * 获取题目的完整信息（包括所有选项和解析）
 */
async function getQuestionDetails(connection, questionIds) {
  if (questionIds.length === 0) {
    return {};
  }
  
  const placeholders = questionIds.map(() => '?').join(',');
  
  // 获取题目完整信息（包括question_code和explanation）
  const [questions] = await connection.execute(`
    SELECT 
      id,
      question_text,
      question_code,
      explanation,
      correct_answer
    FROM questions
    WHERE id IN (${placeholders})
  `, questionIds);
  
  // 获取所有选项
  const [options] = await connection.execute(`
    SELECT 
      question_id,
      option_label,
      option_value,
      option_text
    FROM options
    WHERE question_id IN (${placeholders})
    ORDER BY question_id, option_label
  `, questionIds);
  
  // 组织数据
  const questionDetails = {};
  questions.forEach(q => {
    questionDetails[q.id] = {
      question_text: q.question_text,
      question_code: q.question_code || '',
      explanation: q.explanation || '',
      correct_answer: q.correct_answer,
      options: []
    };
  });
  
  options.forEach(opt => {
    if (questionDetails[opt.question_id]) {
      questionDetails[opt.question_id].options.push({
        label: opt.option_label,
        value: opt.option_value,
        text: opt.option_text
      });
    }
  });
  
  return questionDetails;
}

/**
 * 查询单个级别答错频率最高的题目（包含选项统计）
 */
async function extractTopWrongQuestionsByLevel(connection, level, useWindowFunction) {
  let query;
  
  if (useWindowFunction) {
    // MySQL 8.0+ 使用窗口函数
    query = `
      SELECT 
        level,
        question_id,
        question_text,
        question_type,
        difficulty,
        correct_answer,
        wrong_count,
        total_attempts,
        correct_count,
        ROUND(wrong_count * 100.0 / total_attempts, 2) AS wrong_rate,
        ROUND(correct_count * 100.0 / total_attempts, 2) AS correct_rate,
        rank_in_level
      FROM (
        SELECT 
          q.level,
          q.id AS question_id,
          q.question_text,
          q.question_type,
          q.difficulty,
          q.correct_answer,
          COUNT(CASE WHEN sa.is_correct = 0 THEN 1 END) AS wrong_count,
          COUNT(*) AS total_attempts,
          COUNT(CASE WHEN sa.is_correct = 1 THEN 1 END) AS correct_count,
          ROW_NUMBER() OVER (PARTITION BY q.level ORDER BY COUNT(CASE WHEN sa.is_correct = 0 THEN 1 END) DESC) AS rank_in_level
        FROM questions q
        INNER JOIN submission_answers sa ON q.id = sa.question_id
        WHERE q.level = ?
        GROUP BY q.level, q.id, q.question_text, q.question_type, q.difficulty, q.correct_answer
        HAVING wrong_count > 0
      ) AS ranked_questions
      WHERE rank_in_level <= ?
      ORDER BY wrong_count DESC, total_attempts DESC
    `;
  } else {
    // MySQL 5.7及以下使用变量方式
    query = `
      SELECT 
        level,
        question_id,
        question_text,
        question_type,
        difficulty,
        correct_answer,
        wrong_count,
        total_attempts,
        correct_count,
        ROUND(wrong_count * 100.0 / total_attempts, 2) AS wrong_rate,
        ROUND(correct_count * 100.0 / total_attempts, 2) AS correct_rate,
        rank_in_level
      FROM (
        SELECT 
          level,
          question_id,
          question_text,
          question_type,
          difficulty,
          correct_answer,
          wrong_count,
          total_attempts,
          correct_count,
          @rank := IF(@prev_level = level, @rank + 1, 1) AS rank_in_level,
          @prev_level := level
        FROM (
          SELECT 
            q.level,
            q.id AS question_id,
            q.question_text,
            q.question_type,
            q.difficulty,
            q.correct_answer,
            COUNT(CASE WHEN sa.is_correct = 0 THEN 1 END) AS wrong_count,
            COUNT(*) AS total_attempts,
            COUNT(CASE WHEN sa.is_correct = 1 THEN 1 END) AS correct_count
          FROM questions q
          INNER JOIN submission_answers sa ON q.id = sa.question_id
          WHERE q.level = ?
          GROUP BY q.level, q.id, q.question_text, q.question_type, q.difficulty, q.correct_answer
          HAVING wrong_count > 0
          ORDER BY wrong_count DESC, total_attempts DESC
        ) AS stats
        CROSS JOIN (SELECT @prev_level := 0, @rank := 0) AS vars
      ) AS ranked_questions
      WHERE rank_in_level <= ?
      ORDER BY wrong_count DESC, total_attempts DESC
    `;
  }
  
  const [results] = await connection.execute(query, [level, MAX_QUESTIONS_PER_LEVEL]);
  
  // 获取这些题目的完整信息（包括所有选项和解析）
  const questionIds = results.map(r => r.question_id);
  const questionDetails = await getQuestionDetails(connection, questionIds);
  
  // 获取这些题目的选项统计
  const optionStats = await getOptionStatistics(connection, questionIds);
  
  // 合并所有信息到题目数据中
  results.forEach(question => {
    const qid = question.question_id;
    
    // 添加完整题目信息
    if (questionDetails[qid]) {
      question.question_code = questionDetails[qid].question_code;
      question.explanation = questionDetails[qid].explanation;
      question.all_options = questionDetails[qid].options;
    } else {
      question.question_code = '';
      question.explanation = '';
      question.all_options = [];
    }
    
    // 添加选项统计
    if (optionStats[qid]) {
      question.options_statistics = optionStats[qid];
      question.most_wrong_option = optionStats[qid].most_wrong_option || null;
    } else {
      question.options_statistics = [];
      question.most_wrong_option = null;
    }
  });
  
  return results;
}

/**
 * 查询每个级别答错频率最高的题目（按级别逐个处理）
 * @param {number[]|null} targetLevels - 要查询的级别数组，如果为null则查询所有级别
 */
async function extractTopWrongQuestions(targetLevels = null) {
  const connection = await pool.getConnection();
  
  try {
    console.log('='.repeat(80));
    if (targetLevels && targetLevels.length > 0) {
      console.log(`开始提取级别 ${targetLevels.join(', ')} 答错频率最高的50道题目（包含选项统计）`);
    } else {
      console.log('开始提取每个级别答错频率最高的50道题目（包含选项统计）');
    }
    console.log('='.repeat(80));
    console.log();
    
    // 检查MySQL版本，决定使用哪种查询方式
    const [versionRows] = await connection.execute('SELECT VERSION() as version');
    const mysqlVersion = versionRows[0].version;
    const majorVersion = parseInt(mysqlVersion.split('.')[0]);
    const minorVersion = parseInt(mysqlVersion.split('.')[1]);
    const useWindowFunction = majorVersion > 8 || (majorVersion === 8 && minorVersion >= 0);
    
    console.log(`MySQL版本: ${mysqlVersion}`);
    console.log(`使用窗口函数: ${useWindowFunction ? '是' : '否'}`);
    console.log();
    
    // 获取要查询的级别
    let levels;
    if (targetLevels && targetLevels.length > 0) {
      const placeholders = targetLevels.map(() => '?').join(',');
      [levels] = await connection.execute(`
        SELECT DISTINCT level 
        FROM questions 
        WHERE level IN (${placeholders})
        ORDER BY level ASC
      `, targetLevels);
    } else {
      [levels] = await connection.execute(`
        SELECT DISTINCT level 
        FROM questions 
        WHERE level BETWEEN 1 AND 6
        ORDER BY level ASC
      `);
    }
    
    const allResults = [];
    const groupedByLevel = {};
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    
    // 确保输出目录存在
    ensureOutputDir();
    
    // 按级别逐个处理
    for (const levelRow of levels) {
      const level = levelRow.level;
      console.log(`正在处理级别 ${level}...`);
      
      const questions = await extractTopWrongQuestionsByLevel(connection, level, useWindowFunction);
      
      if (questions.length > 0) {
        groupedByLevel[level] = questions;
        allResults.push(...questions);
        
        // 显示该级别的统计信息
        const totalWrong = questions.reduce((sum, q) => sum + q.wrong_count, 0);
        const totalAttempts = questions.reduce((sum, q) => sum + q.total_attempts, 0);
        const avgWrongRate = totalAttempts > 0 ? (totalWrong * 100.0 / totalAttempts).toFixed(2) : 0;
        
        console.log(`  ✓ 级别 ${level}: 找到 ${questions.length} 道题目 | 总答错次数: ${totalWrong} | 总答题次数: ${totalAttempts} | 平均错误率: ${avgWrongRate}%`);
        
        // 立即导出该级别的数据
        const levelDataJSON = {
          level: level,
          export_time: new Date().toISOString(),
          question_count: questions.length,
          statistics: {
            total_wrong_count: totalWrong,
            total_attempts: totalAttempts,
            average_wrong_rate: avgWrongRate
          },
          questions: questions
        };
        exportToJSON(levelDataJSON, `top_wrong_questions_level_${level}_${timestamp}.json`);
        
        // 导出CSV（扁平化处理，包含完整题目、所有选项和解析）
        const csvData = questions.map(q => {
          // 整理所有选项为字符串格式（A: 选项内容; B: 选项内容; ...）
          const optionsText = q.all_options
            .map(opt => `${opt.label}: ${opt.text}`)
            .join('; ');
          
          // 找出每个选项的错误统计
          const optionStatsMap = {};
          if (q.options_statistics && Array.isArray(q.options_statistics)) {
            q.options_statistics.forEach(stat => {
              if (stat.option_value) {
                optionStatsMap[stat.option_value] = stat.wrong_count;
              }
            });
          }
          
          // 为每个选项添加错误次数
          const optionsWithStats = q.all_options.map(opt => {
            const wrongCount = optionStatsMap[opt.value] || 0;
            return `${opt.label}: ${opt.text} (错误${wrongCount}次)`;
          }).join('; ');
          
          return {
            level: q.level,
            question_id: q.question_id,
            question_text: q.question_text,
            question_code: q.question_code || '',
            question_type: q.question_type,
            difficulty: q.difficulty,
            correct_answer: q.correct_answer,
            explanation: q.explanation || '',
            // 所有选项（带错误统计）
            all_options: optionsWithStats,
            // 所有选项（纯文本，便于查看）
            all_options_text: optionsText,
            // 选项A
            option_a_label: q.all_options.find(o => o.label === 'A')?.label || '',
            option_a_text: q.all_options.find(o => o.label === 'A')?.text || '',
            option_a_wrong_count: optionStatsMap['A'] || 0,
            // 选项B
            option_b_label: q.all_options.find(o => o.label === 'B')?.label || '',
            option_b_text: q.all_options.find(o => o.label === 'B')?.text || '',
            option_b_wrong_count: optionStatsMap['B'] || 0,
            // 选项C
            option_c_label: q.all_options.find(o => o.label === 'C')?.label || '',
            option_c_text: q.all_options.find(o => o.label === 'C')?.text || '',
            option_c_wrong_count: optionStatsMap['C'] || 0,
            // 选项D
            option_d_label: q.all_options.find(o => o.label === 'D')?.label || '',
            option_d_text: q.all_options.find(o => o.label === 'D')?.text || '',
            option_d_wrong_count: optionStatsMap['D'] || 0,
            // 统计信息
            wrong_count: q.wrong_count,
            total_attempts: q.total_attempts,
            correct_count: q.correct_count,
            wrong_rate: q.wrong_rate,
            correct_rate: q.correct_rate,
            rank_in_level: q.rank_in_level,
            // 最容易错的选项
            most_wrong_option_value: q.most_wrong_option ? q.most_wrong_option.option_value : '',
            most_wrong_option_label: q.most_wrong_option ? q.most_wrong_option.option_label : '',
            most_wrong_option_text: q.most_wrong_option ? q.most_wrong_option.option_text : '',
            most_wrong_option_count: q.most_wrong_option ? q.most_wrong_option.wrong_count : 0
          };
        });
        exportToCSV(csvData, `top_wrong_questions_level_${level}_${timestamp}.csv`);
        
        console.log(`  ✓ 级别 ${level} 数据已导出\n`);
      } else {
        console.log(`  ⚠ 级别 ${level}: 没有找到符合条件的题目\n`);
      }
    }
    
    // 显示总体统计信息
    console.log('='.repeat(80));
    console.log('总体统计信息：');
    console.log('-'.repeat(80));
    Object.keys(groupedByLevel).sort().forEach(level => {
      const questions = groupedByLevel[level];
      const totalWrong = questions.reduce((sum, q) => sum + q.wrong_count, 0);
      const totalAttempts = questions.reduce((sum, q) => sum + q.total_attempts, 0);
      const avgWrongRate = totalAttempts > 0 ? (totalWrong * 100.0 / totalAttempts).toFixed(2) : 0;
      
      console.log(`级别 ${level}: ${questions.length} 道题目 | 总答错次数: ${totalWrong} | 总答题次数: ${totalAttempts} | 平均错误率: ${avgWrongRate}%`);
    });
    console.log('-'.repeat(80));
    console.log();
    
    // 导出所有级别的完整数据
    if (allResults.length > 0) {
      const allDataJSON = {
        export_time: new Date().toISOString(),
        total_questions: allResults.length,
        max_questions_per_level: MAX_QUESTIONS_PER_LEVEL,
        statistics: Object.keys(groupedByLevel).sort().map(level => {
          const questions = groupedByLevel[level];
          const totalWrong = questions.reduce((sum, q) => sum + q.wrong_count, 0);
          const totalAttempts = questions.reduce((sum, q) => sum + q.total_attempts, 0);
          return {
            level: parseInt(level),
            question_count: questions.length,
            total_wrong_count: totalWrong,
            total_attempts: totalAttempts,
            average_wrong_rate: totalAttempts > 0 ? (totalWrong * 100.0 / totalAttempts).toFixed(2) : 0
          };
        }),
        questions: allResults
      };
      exportToJSON(allDataJSON, `top_wrong_questions_all_${timestamp}.json`);
      
      // 导出完整CSV（包含完整题目、所有选项和解析）
      const allCsvData = allResults.map(q => {
        // 整理所有选项
        const optionsText = q.all_options
          .map(opt => `${opt.label}: ${opt.text}`)
          .join('; ');
        
        const optionStatsMap = {};
        if (q.options_statistics && Array.isArray(q.options_statistics)) {
          q.options_statistics.forEach(stat => {
            if (stat.option_value) {
              optionStatsMap[stat.option_value] = stat.wrong_count;
            }
          });
        }
        
        const optionsWithStats = q.all_options.map(opt => {
          const wrongCount = optionStatsMap[opt.value] || 0;
          return `${opt.label}: ${opt.text} (错误${wrongCount}次)`;
        }).join('; ');
        
        return {
          level: q.level,
          question_id: q.question_id,
          question_text: q.question_text,
          question_code: q.question_code || '',
          question_type: q.question_type,
          difficulty: q.difficulty,
          correct_answer: q.correct_answer,
          explanation: q.explanation || '',
          all_options: optionsWithStats,
          all_options_text: optionsText,
          option_a_label: q.all_options.find(o => o.label === 'A')?.label || '',
          option_a_text: q.all_options.find(o => o.label === 'A')?.text || '',
          option_a_wrong_count: optionStatsMap['A'] || 0,
          option_b_label: q.all_options.find(o => o.label === 'B')?.label || '',
          option_b_text: q.all_options.find(o => o.label === 'B')?.text || '',
          option_b_wrong_count: optionStatsMap['B'] || 0,
          option_c_label: q.all_options.find(o => o.label === 'C')?.label || '',
          option_c_text: q.all_options.find(o => o.label === 'C')?.text || '',
          option_c_wrong_count: optionStatsMap['C'] || 0,
          option_d_label: q.all_options.find(o => o.label === 'D')?.label || '',
          option_d_text: q.all_options.find(o => o.label === 'D')?.text || '',
          option_d_wrong_count: optionStatsMap['D'] || 0,
          wrong_count: q.wrong_count,
          total_attempts: q.total_attempts,
          correct_count: q.correct_count,
          wrong_rate: q.wrong_rate,
          correct_rate: q.correct_rate,
          rank_in_level: q.rank_in_level,
          most_wrong_option_value: q.most_wrong_option ? q.most_wrong_option.option_value : '',
          most_wrong_option_label: q.most_wrong_option ? q.most_wrong_option.option_label : '',
          most_wrong_option_text: q.most_wrong_option ? q.most_wrong_option.option_text : '',
          most_wrong_option_count: q.most_wrong_option ? q.most_wrong_option.wrong_count : 0
        };
      });
      exportToCSV(allCsvData, `top_wrong_questions_all_${timestamp}.csv`);
    }
    
    console.log('='.repeat(80));
    console.log('导出完成！');
    console.log('='.repeat(80));
    console.log(`输出目录: ${OUTPUT_DIR}`);
    console.log();
    
    // 显示文件列表
    const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.includes(timestamp));
    console.log('生成的文件：');
    files.forEach(file => {
      const filepath = path.join(OUTPUT_DIR, file);
      const stats = fs.statSync(filepath);
      const sizeKB = (stats.size / 1024).toFixed(2);
      console.log(`  - ${file} (${sizeKB} KB)`);
    });
    
  } catch (error) {
    console.error('❌ 查询失败:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 获取统计信息
 */
async function getStatistics() {
  const connection = await pool.getConnection();
  
  try {
    console.log('='.repeat(80));
    console.log('获取统计信息');
    console.log('='.repeat(80));
    console.log();
    
    const [stats] = await connection.execute(`
      SELECT 
        level,
        COUNT(DISTINCT question_id) AS total_questions_with_answers,
        SUM(wrong_count) AS total_wrong_answers,
        SUM(total_attempts) AS total_attempts,
        ROUND(SUM(wrong_count) * 100.0 / SUM(total_attempts), 2) AS overall_wrong_rate
      FROM (
        SELECT 
          q.level,
          q.id AS question_id,
          COUNT(CASE WHEN sa.is_correct = 0 THEN 1 END) AS wrong_count,
          COUNT(*) AS total_attempts
        FROM questions q
        INNER JOIN submission_answers sa ON q.id = sa.question_id
        GROUP BY q.level, q.id
      ) AS level_stats
      GROUP BY level
      ORDER BY level ASC
    `);
    
    console.log('每个级别的统计信息：');
    console.log('-'.repeat(80));
    console.log('级别 | 有答题记录的题目数 | 总答错次数 | 总答题次数 | 整体错误率');
    console.log('-'.repeat(80));
    stats.forEach(row => {
      console.log(
        `  ${row.level}  |        ${row.total_questions_with_answers.toString().padStart(6)}      |  ${row.total_wrong_answers.toString().padStart(8)}  |  ${row.total_attempts.toString().padStart(8)}  |    ${row.overall_wrong_rate}%`
      );
    });
    console.log('-'.repeat(80));
    console.log();
    
  } catch (error) {
    console.error('❌ 获取统计信息失败:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    // 解析命令行参数
    const args = process.argv.slice(2);
    let targetLevels = null;
    
    if (args.length > 0) {
      // 支持 --level 或 -l 参数，或者直接传级别数字
      const levelArg = args.find(arg => arg.startsWith('--level=') || arg.startsWith('-l='));
      if (levelArg) {
        const levelValue = levelArg.split('=')[1];
        targetLevels = levelValue.split(',').map(l => parseInt(l.trim())).filter(l => l >= 1 && l <= 8);
      } else if (/^\d+$/.test(args[0])) {
        // 直接传级别数字
        const level = parseInt(args[0]);
        if (level >= 1 && level <= 8) {
          targetLevels = [level];
        }
      }
      
      if (targetLevels && targetLevels.length > 0) {
        console.log(`指定查询级别: ${targetLevels.join(', ')}\n`);
      } else {
        console.log('⚠ 无效的级别参数，将查询所有级别（1-8）\n');
      }
    }
    
    // 检查数据库连接
    console.log('检查数据库连接...');
    await pool.getConnection().then(conn => {
      conn.release();
      console.log('✓ 数据库连接正常\n');
    });
    
    // 获取统计信息
    await getStatistics();
    
    // 提取数据
    await extractTopWrongQuestions(targetLevels);
    
    console.log('\n✅ 所有操作完成！');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 程序执行失败:', error);
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main();
}

module.exports = {
  extractTopWrongQuestions,
  getStatistics
};

