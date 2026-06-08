"""
Skill Prompts

各种 Skill 的提示模板。
"""

import logging
from typing import Dict

logger = logging.getLogger("skill_prompts")


def get_skill_prompts() -> Dict[str, str]:
    """获取所有 Skill 提示"""
    return {
        "create_question": get_create_question_prompt(),
        "create_exam": get_create_exam_prompt(),
        "query_student": get_query_student_prompt(),
        "analyze_progress": get_analyze_progress_prompt()
    }


def get_create_question_prompt() -> str:
    """创建题目提示"""
    return """
## 创建题目工作流

你正在帮助教师创建一道 OJ 题目。

### 步骤
1. 确定题目主题和难度
2. 生成题目描述（适合中小学生）
3. 设计测试数据
4. 编写参考代码
5. 三阶段验证
6. 上传题库

### 描述生成要求
- 语言清晰易懂
- 适合目标年级学生
- 包含输入输出格式说明
- 提供示例

### 测试数据要求
- 至少 3 组测试数据
- 包含边界情况
- 数据量适中

### 验证流程
- 参考代码验证
- 边界数据验证
- 反向测试验证
"""


def get_create_exam_prompt() -> str:
    """创建考试提示"""
    return """
## 创建考试工作流

你正在帮助教师创建一场考试。

### 步骤
1. 确定考试范围和难度
2. 选择或生成题目
3. 设置考试参数（时长、总分等）
4. 创建考试
5. 确认发布

### 题目选择原则
- 难度分布合理
- 覆盖知识点
- 时间分配合理

### 考试参数
- 时长建议：简单题 60 分钟，中等题 90 分钟
- 分值分配：按难度比例
"""


def get_query_student_prompt() -> str:
    """查询学生提示"""
    return """
## 查询学生工作流

你正在帮助教师查询学生信息。

### 可查询内容
- 基本信息（姓名、班级、年级）
- 学习进度（已完成课程、练习数量）
- 成绩记录（考试分数、提交详情）
- 学习习惯（活跃时间、偏好题目类型）

### 输出格式
- 使用清晰的表格或列表
- 突出关键数据
- 提供简要分析
"""


def get_analyze_progress_prompt() -> str:
    """分析进度提示"""
    return """
## 学习进度分析工作流

你正在分析学生的学习进度。

### 分析维度
- 知识点掌握程度
- 练习完成情况
- 成绩趋势
- 学习习惯

### 输出要求
- 图表描述（进度条、趋势线）
- 问题识别（薄弱知识点）
- 建议改进方案
"""


def get_question_generation_prompt(topic: str, difficulty: str, story_mode: bool) -> str:
    """题目生成提示"""
    base = f"""
请创建一道 {difficulty} 难度的 {topic} 编程题目。

要求：
"""

    if story_mode:
        base += """
- 使用故事化描述
- 适合中小学生理解
- 情景生动有趣

格式示例：
小明同学喜欢收集邮票...（故事背景）
现在他想统计...（具体问题）
"""
    else:
        base += """
- 描述清晰准确
- 输入输出格式明确
- 包含示例

格式：
题目描述：
输入格式：
输出格式：
示例：
"""

    return base


def get_test_case_generation_prompt(difficulty: str) -> str:
    """测试数据生成提示"""
    return f"""
请为题目生成测试数据。

难度：{difficulty}

要求：
- 3-5 组测试数据
- 包含简单、中等、困难情况
- 边界数据（最小值、最大值、特殊值）

格式：
输入：xxx
输出：xxx
说明：xxx
"""


def get_reference_code_prompt(language: str, description: str) -> str:
    """参考代码生成提示"""
    return f"""
请为以下题目编写 {language} 参考代码。

题目描述：
{description}

要求：
- 代码简洁清晰
- 变量命名规范
- 添加必要注释
- 考虑边界情况

格式：
```{language}
# 参考代码
def solution():
    # 实现
    pass
```
"""


def get_verification_prompt(verdict: str, error: str = None) -> str:
    """验证结果分析提示"""
    if verdict == "AC":
        return """
验证通过！代码正确。
可以上传到题库。
"""
    elif verdict == "WA":
        return f"""
答案错误。
问题可能：
- 逻辑错误
- 边界处理不当
- 特殊情况未考虑

错误详情：{error}

建议修改代码后重新验证。
"""
    elif verdict == "TLE":
        return f"""
运行超时。
问题可能：
- 算法效率不够
- 循环次数过多
- 数据结构选择不当

错误详情：{error}

建议优化算法。
"""
    else:
        return f"""
验证失败：{verdict}
错误：{error}
"""


def get_approval_prompt(action: str, resource_type: str) -> str:
    """审批提示"""
    return f"""
此操作需要管理员审批。

操作：{action}
资源类型：{resource_type}

审批流程：
1. 提交审批申请
2. 等待管理员审核
3. 管理员同意后需要您二次确认
4. 确认后执行操作

已为您提交审批申请，请等待通知。
"""