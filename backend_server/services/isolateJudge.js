/**
 * 使用 isolate 沙箱进行轻量级判题
 * isolate 是 IOI (国际信息学奥林匹克竞赛) 官方使用的沙箱
 * 
 * 优势：
 * - 启动速度快（10-50ms，比Docker快10-20倍）
 * - 内存占用小（~10MB，比Docker少20倍）
 * - 安全性高（Linux namespace + cgroup）
 * - 资源限制精确（时间、内存、进程数等）
 */

const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { logger } = require('../config/logger');

const execFileAsync = promisify(execFile);

/**
 * 标准化输出（符合 OJ 判题规则）
 * - 去除每行末尾的空格
 * - 去除文件末尾的空行
 */
function normalizeOutput(str) {
  return str
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .trim();
}

// isolate 沙箱池（复用box ID）
class IsolatePool {
  constructor(maxBoxes = 10) {
    this.maxBoxes = maxBoxes;
    this.availableBoxes = [];
    this.busyBoxes = new Set();
    
    // 初始化可用box ID列表
    for (let i = 0; i < maxBoxes; i++) {
      this.availableBoxes.push(i);
    }
    
    logger.info('Isolate 沙箱池初始化', { maxBoxes });
  }
  
  // 获取一个box
  async acquire() {
    if (this.availableBoxes.length === 0) {
      // 等待有空闲box
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.acquire();
    }
    
    const boxId = this.availableBoxes.shift();
    this.busyBoxes.add(boxId);
    
    // 初始化box
    try {
      await execFileAsync('isolate', ['--box-id=' + boxId.toString(), '--init'], {
        timeout: 5000
      });
    } catch (error) {
      logger.error('初始化 isolate box 失败', { boxId, error: error.message });
      throw error;
    }
    
    return boxId;
  }
  
  // 释放box
  async release(boxId) {
    if (boxId === null || boxId === undefined) return;
    
    try {
      // 清理box
      await execFileAsync('isolate', ['--box-id=' + boxId.toString(), '--cleanup'], {
        timeout: 5000
      });
    } catch (error) {
      logger.warn('清理 isolate box 失败', { boxId, error: error.message });
    }
    
    this.busyBoxes.delete(boxId);
    this.availableBoxes.push(boxId);
  }
  
  // 获取box的工作目录
  getBoxPath(boxId) {
    return `/var/local/lib/isolate/${boxId}/box`;
  }
}

// 创建全局沙箱池（4核8GB服务器最优配置）
const isolatePool = new IsolatePool(30);

// 预编译头文件路径（全局缓存）
const PCH_DIR = '/tmp/cpp_pch_cache';
const PCH_HEADER = path.join(PCH_DIR, 'stdc++.h');
const PCH_FILE = path.join(PCH_DIR, 'stdc++.h.gch');

// 初始化预编译头文件（如果不存在）
let pchInitialized = false;
async function ensurePCH() {
  if (pchInitialized) return;
  
  try {
    // 检查 PCH 文件是否存在
    try {
      await fs.access(PCH_FILE);
      pchInitialized = true;
      logger.info('预编译头文件已存在', { pchFile: PCH_FILE });
      return;
    } catch (e) {
      // PCH 文件不存在，需要创建
    }
    
    // 创建 PCH 目录
    await fs.mkdir(PCH_DIR, { recursive: true });
    
    // 创建 stdc++.h 文件用于预编译（包含 bits/stdc++.h）
    await fs.writeFile(PCH_HEADER, '#include <bits/stdc++.h>\n');
    
    logger.info('开始创建预编译头文件', { pchFile: PCH_FILE });
    
    // 预编译头文件（使用 -x c++-header 表示这是头文件）
    await execFileAsync('g++', [
      '-std=c++17',
      '-O2',
      '-x', 'c++-header',
      PCH_HEADER,
      '-o', PCH_FILE
    ], {
      timeout: 30000, // 预编译可能需要更长时间
      maxBuffer: 1024 * 1024
    });
    
    pchInitialized = true;
    logger.info('预编译头文件创建成功', { pchFile: PCH_FILE });
    
  } catch (error) {
    logger.warn('创建预编译头文件失败，将使用普通编译', { 
      error: error.message,
      pchFile: PCH_FILE 
    });
    // 如果预编译失败，继续使用普通编译方式
    pchInitialized = false;
  }
}

/**
 * 检查代码是否使用了 bits/stdc++.h
 */
function usesBitsStdCpp(code) {
  // 检查是否包含 bits/stdc++.h（忽略大小写和空格）
  return /#include\s*[<"]bits\/stdc\+\+\.h[>"]/i.test(code);
}

/**
 * 编译 C++ 代码
 */
async function compileCode(code, tempDir) {
  try {
    await fs.mkdir(tempDir, { recursive: true });
    
    const sourceFile = path.join(tempDir, 'main.cpp');
    const binaryFile = path.join(tempDir, 'main');
    
    // 检查是否使用 bits/stdc++.h
    const useBitsStdCpp = usesBitsStdCpp(code);
    let finalCode = code;
    
    // 如果使用 bits/stdc++.h，尝试使用预编译头文件优化
    if (useBitsStdCpp) {
      await ensurePCH();
      
      // 如果预编译头文件存在，修改代码以使用预编译头文件
      // g++ 的预编译头文件要求源文件第一行必须是 #include "header.h"
      if (pchInitialized) {
        try {
          await fs.access(PCH_FILE);
          // 将第一行的 #include <bits/stdc++.h> 替换为 #include "stdc++.h"
          // 只替换第一个匹配的，并且必须是文件的第一行（前面只有空白或注释）
          const lines = finalCode.split('\n');
          let replaced = false;
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // 跳过空行和注释
            if (line.trim() === '' || line.trim().startsWith('//') || line.trim().startsWith('/*')) {
              continue;
            }
            // 检查是否是 #include <bits/stdc++.h> 或 #include<bits/stdc++.h>
            if (/^\s*#include\s*[<"]bits\/stdc\+\+\.h[>"]/i.test(line)) {
              // 替换为 #include "stdc++.h"
              lines[i] = line.replace(
                /#include\s*[<"]bits\/stdc\+\+\.h[>"]/i,
                '#include "stdc++.h"'
              );
              replaced = true;
              break;
            }
            // 如果遇到其他非空非注释行，说明第一行不是 bits/stdc++.h，停止查找
            if (line.trim() && !line.trim().startsWith('#')) {
              break;
            }
          }
          if (replaced) {
            finalCode = lines.join('\n');
            logger.info('使用预编译头文件优化编译');
          } else {
            logger.debug('bits/stdc++.h 不在第一行，无法使用预编译头文件');
          }
        } catch (e) {
          // PCH 文件不存在，使用原始代码
          logger.debug('预编译头文件不存在，使用普通编译');
        }
      }
    }
    
    await fs.writeFile(sourceFile, finalCode);
    
    logger.info('开始编译 C++ 代码', { 
      codeLength: code.length,
      useBitsStdCpp,
      usePCH: useBitsStdCpp && pchInitialized
    });
    
    // 构建编译参数
    const compileArgs = [
      '-std=c++17',
      '-O2',
      '-o', binaryFile,
      sourceFile
    ];
    
    // 如果使用预编译头文件，添加包含路径
    if (useBitsStdCpp && pchInitialized) {
      try {
        await fs.access(PCH_FILE);
        // 添加 PCH 目录到包含路径，这样 #include "stdc++.h" 可以找到预编译头文件
        compileArgs.push('-I', PCH_DIR);
      } catch (e) {
        // PCH 文件不存在，忽略
      }
    }
    
    // 使用 g++ 编译（不需要隔离）
    try {
      const { stderr } = await execFileAsync('g++', compileArgs, {
        timeout: 10000,
        maxBuffer: 1024 * 1024
      });
      
      if (stderr && stderr.trim()) {
        logger.warn('编译警告', { stderr });
      }
      
      logger.info('编译成功');
      return binaryFile;
      
    } catch (error) {
      const errorMsg = error.stderr || error.message || '编译失败';
      logger.error('编译错误', { error: errorMsg });
      throw new Error(`编译错误:\n${errorMsg}`);
    }
    
  } catch (error) {
    throw error;
  }
}

/**
 * 使用 isolate 运行程序
 */
async function runWithIsolate(binaryPath, input, options = {}) {
  let boxId = null;
  let metaFile = null;
  
  try {
    // 从池中获取box
    boxId = await isolatePool.acquire();
    const boxPath = isolatePool.getBoxPath(boxId);
    
    // 复制二进制文件到box
    const boxBinary = path.join(boxPath, 'main');
    await fs.copyFile(binaryPath, boxBinary);
    await fs.chmod(boxBinary, 0o755);
    
    // 写入输入文件
    const inputFile = path.join(boxPath, 'input.txt');
    await fs.writeFile(inputFile, input || '');
    
    // 配置资源限制
    const timeLimit = options.timeLimit || 5;      // 秒
    const memoryLimit = options.memoryLimit || 256000; // KB (256MB)
    const processLimit = options.processLimit || 1;
    
    // meta 文件路径（用于获取运行状态）
    // 注意：isolate 的 --meta 参数是相对于执行命令时的工作目录，不是 box 内部
    metaFile = path.join('/tmp', `isolate_meta_${boxId}_${Date.now()}.txt`);
    
    // 执行命令
    const args = [
      '--box-id=' + boxId.toString(),
      '--time=' + timeLimit.toString(),           // CPU时间限制
      '--wall-time=' + (timeLimit + 2).toString(), // 实际时间限制
      '--mem=' + memoryLimit.toString(),          // 内存限制（KB）
      '--processes=' + processLimit.toString(),   // 进程数限制
      '--stdin=input.txt',                        // 标准输入
      '--stdout=output.txt',                      // 标准输出
      '--stderr=error.txt',                       // 标准错误
      '--meta=' + metaFile,                       // 输出运行状态（绝对路径）
      '--run',
      '--',
      './main'
    ];
    
    // 运行程序
    const startTime = Date.now();
    let isolateExitCode = 0;
    try {
      await execFileAsync('isolate', args, {
        timeout: (timeLimit + 3) * 1000,
        maxBuffer: 10 * 1024 * 1024
      });
    } catch (error) {
      // isolate 运行失败（可能超时、内存超限等）
      // 不一定是错误，需要检查meta文件
      isolateExitCode = error.code || 1;
    }
    const duration = Date.now() - startTime;
    
    // 读取 meta 文件以获取准确的运行状态
    let metaInfo = {};
    try {
      const metaContent = await fs.readFile(metaFile, 'utf-8');
      metaContent.split('\n').forEach(line => {
        const [key, value] = line.split(':');
        if (key && value) {
          metaInfo[key.trim()] = value.trim();
        }
      });
      logger.debug('读取 meta 文件成功', metaInfo);
    } catch (e) {
      logger.warn('读取 meta 文件失败', { error: e.message });
    }
    
    // 检查运行状态
    if (metaInfo.status === 'TO') {
      const err = new Error('Time Limit Exceeded (运行超时)');
      err.duration = duration;
      throw err;
    }
    if (metaInfo.status === 'RE') {
      const err = new Error('Runtime Error (运行时错误)');
      err.duration = duration;
      throw err;
    }
    if (metaInfo.status === 'SG') {
      const err = new Error('Runtime Error (程序崩溃)');
      err.duration = duration;
      throw err;
    }
    if (metaInfo.status === 'XX') {
      const err = new Error('Internal Error (内部错误)');
      err.duration = duration;
      throw err;
    }
    
    // 检查内存超限
    if (metaInfo['cg-mem']) {
      const usedMemory = parseInt(metaInfo['cg-mem']);
      if (usedMemory > memoryLimit) {
        const err = new Error('Memory Limit Exceeded (内存超限)');
        err.duration = duration;
        throw err;
      }
    }
    
    // 读取输出和错误
    const outputFile = path.join(boxPath, 'output.txt');
    const errorFile = path.join(boxPath, 'error.txt');
    
    let output = '';
    let stderr = '';
    
    try {
      output = await fs.readFile(outputFile, 'utf-8');
      logger.debug('读取输出文件成功', { outputLength: output.length });
    } catch (e) {
      logger.warn('读取输出文件失败', { outputFile, error: e.message });
      // 输出文件不存在
    }
    
    try {
      stderr = await fs.readFile(errorFile, 'utf-8');
    } catch (e) {
      // 错误文件不存在 - 正常情况
    }
    
    // 检查是否有运行时错误
    if (stderr && stderr.trim()) {
      logger.warn('程序有 stderr 输出', { stderr: stderr.substring(0, 200) });
    }
    
    return {
      output: output.trim(),
      stderr: stderr.trim(),
      duration,
      metaInfo
    };
    
  } catch (error) {
    const errorMsg = error.message || '运行失败';
    logger.error('运行错误', { error: errorMsg });
    
    // 直接抛出错误（已经在上面通过 meta 文件检查了状态）
    throw error;
    
  } finally {
    // 释放box
    if (boxId !== null) {
      await isolatePool.release(boxId);
    }
    
    // 清理 meta 文件
    if (metaFile) {
      try {
        await fs.unlink(metaFile);
      } catch (e) {
        // 忽略清理错误
      }
    }
  }
}

/**
 * 判题主函数
 * @param {string} code - 源代码
 * @param {Array} samples - 测试样例
 * @param {Object} options - 选项
 * @param {number} options.timeLimit - 时间限制（毫秒）
 * @param {number} options.memoryLimit - 内存限制（MB）
 */
async function judgeCode(code, samples, options = {}) {
  const tempId = crypto.randomBytes(8).toString('hex');
  const tempDir = path.join('/tmp', `judge_${tempId}`);
  
  // 从选项中获取限制（转换单位）
  const timeLimit = options.timeLimit ? options.timeLimit / 1000 : 5; // 毫秒转秒
  const memoryLimit = options.memoryLimit ? options.memoryLimit * 1024 : 256000; // MB转KB
  
  try {
    // 1. 编译代码
    const binaryPath = await compileCode(code, tempDir);
    
    logger.info('开始运行测试', { 
      totalTests: samples.length,
      timeLimit: `${timeLimit}s`,
      memoryLimit: `${memoryLimit}KB`
    });
    
    // 2. 并发运行所有测试
    const testPromises = samples.map(async (sample, index) => {
      try {
        const result = await runWithIsolate(binaryPath, sample.input, {
          timeLimit,
          memoryLimit
        });
        
        const actualTrimmed = normalizeOutput(result.output);
        const expectedTrimmed = normalizeOutput(sample.output || '');
        const passed = actualTrimmed === expectedTrimmed;
        
        return {
          sample: index + 1,
          passed,
          input: sample.is_hidden ? '(隐藏)' : sample.input,
          expected: sample.is_hidden ? '(隐藏)' : sample.output,
          actual: sample.is_hidden && !passed ? '(隐藏)' : result.output,
          error: null,
          duration: result.duration,
          is_hidden: sample.is_hidden
        };
        
      } catch (error) {
        return {
          sample: index + 1,
          passed: false,
          input: sample.is_hidden ? '(隐藏)' : sample.input,
          expected: sample.is_hidden ? '(隐藏)' : sample.output,
          actual: '',
          error: error.message,
          // 让前端能显示单个测试点的真实耗时（例如 TLE）
          duration: error.duration ?? 0,
          is_hidden: sample.is_hidden
        };
      }
    });
    
    // 等待所有测试完成
    const results = await Promise.all(testPromises);
    
    // 统计结果
    const passedCount = results.filter(r => r.passed).length;
    
    // 判断verdict
    let verdict = 'Accepted';
    if (passedCount === 0) {
      // 全部错误
      verdict = 'Wrong Answer';
    } else if (passedCount < samples.length) {
      // 部分通过
      const hasError = results.some(r => r.error !== null);
      if (hasError) {
        // 有运行时错误（TLE/MLE/RE等），优先显示错误类型
        const firstError = results.find(r => r.error !== null).error;
        if (firstError.includes('编译错误') || firstError.includes('Compilation Error')) {
          verdict = 'Compilation Error';
        } else if (firstError.includes('Time Limit Exceeded') || firstError.includes('运行超时')) {
          verdict = 'Time Limit Exceeded';
        } else if (firstError.includes('Memory Limit Exceeded') || firstError.includes('内存超限')) {
          verdict = 'Memory Limit Exceeded';
        } else if (firstError.includes('Runtime Error') || firstError.includes('运行时错误')) {
          verdict = 'Runtime Error';
        } else {
          verdict = 'Partially Accepted';  // 部分正确
        }
      } else {
        // 没有运行时错误，只是答案错误
        verdict = 'Partially Accepted';  // 部分正确
      }
    }
    
    return {
      results,
      verdict,
      totalTests: samples.length,
      passedTests: passedCount
    };
    
  } catch (error) {
    // 编译错误
    if (error.message.includes('编译错误')) {
      return {
        results: [{
          sample: 0,
          passed: false,
          input: '',
          expected: '',
          actual: '',
          error: error.message,
          is_hidden: false
        }],
        verdict: 'Compilation Error',
        totalTests: samples.length,
        passedTests: 0
      };
    }
    throw error;
    
  } finally {
    // 清理临时文件
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      logger.error('清理临时文件失败', { error: e.message });
    }
  }
}

module.exports = {
  isolatePool,
  compileCode,
  runWithIsolate,
  judgeCode
};

