"""
OJ 代码验证 MCP Tools

包装 Backend OJ API，包括代码验证功能。
"""

import logging
from typing import Dict, Any, List

from server.mcp.tools import register_tool
from server.backend_client.client import BackendClient

logger = logging.getLogger("oj_tools")

backend = BackendClient()


# ============================================================
# 验证 OJ 代码
# ============================================================
async def verify_oj_code(params: Dict, user_info: Dict) -> Dict:
    """验证 OJ 代码"""

    code = params.get("code")
    language = params.get("language", "python")
    test_cases = params.get("test_cases", [])
    time_limit = params.get("time_limit", 1000)
    memory_limit = params.get("memory_limit", 256)

    if not code:
        return {"error": "缺少代码"}

    if not test_cases:
        return {"error": "缺少测试数据"}

    results = []
    passed_count = 0
    total_time = 0

    for test_case in test_cases:
        input_data = test_case.get("input", "")
        expected_output = test_case.get("expected", "")

        # 调用 Backend test-run API
        response = await backend.post("/api/oj/test-run", data={
            "code": code,
            "language": language,
            "input": input_data,
            "expected_output": expected_output,
            "time_limit": time_limit,
            "memory_limit": memory_limit
        })

        verdict = response.get("verdict", "CE")
        execution_time = response.get("execution_time_ms", 0)

        results.append({
            "input": input_data[:100] if len(input_data) > 100 else input_data,
            "verdict": verdict,
            "execution_time_ms": execution_time
        })

        if verdict == "AC":
            passed_count += 1

        total_time += execution_time

    # 总体判定
    if passed_count == len(test_cases):
        overall_verdict = "AC"
    elif passed_count > 0:
        overall_verdict = "PA"  # Partial Accept
    else:
        # 取第一个失败结果
        overall_verdict = results[0]["verdict"] if results else "CE"

    return {
        "verdict": overall_verdict,
        "passed_cases": passed_count,
        "total_cases": len(test_cases),
        "total_time_ms": total_time,
        "results": results
    }


register_tool(
    "verify_oj_code",
    verify_oj_code,
    description="验证 OJ 代码执行结果",
    params_schema={
        "code": {"type": "string", "required": True, "description": "代码"},
        "language": {"type": "string", "default": "python", "options": ["python", "cpp", "c"]},
        "test_cases": {"type": "array", "required": True, "description": "测试数据"},
        "time_limit": {"type": "int", "default": 1000, "description": "时间限制(ms)"},
        "memory_limit": {"type": "int", "default": 256, "description": "内存限制(MB)"}
    }
)


# ============================================================
# 完整 OJ 验证（三阶段）
# ============================================================
async def full_verify_oj_question(params: Dict, user_info: Dict) -> Dict:
    """完整 OJ 验证（参考代码 + 边界 + 反向）"""

    code = params.get("code")
    language = params.get("language", "python")
    test_cases = params.get("test_cases", [])
    difficulty = params.get("difficulty", "medium")

    # Phase 1: 参考代码通过所有测试点
    phase1_result = await verify_oj_code({
        "code": code,
        "language": language,
        "test_cases": test_cases
    }, user_info)

    if phase1_result["verdict"] != "AC":
        return {
            "success": False,
            "phase": 1,
            "error": "参考代码未通过所有测试点",
            "result": phase1_result
        }

    # Phase 2: 边界测试
    boundary_tests = generate_boundary_tests(difficulty)

    phase2_results = []
    for test in boundary_tests:
        result = await verify_oj_code({
            "code": code,
            "language": language,
            "test_cases": [test]
        }, user_info)
        phase2_results.append({
            "desc": test.get("desc", ""),
            "verdict": result["verdict"]
        })

    # Phase 3: 反向测试（错误代码应得正确判定）
    wrong_codes = [
        {"code": "print('wrong_output')", "expect": "WA"},
        {"code": "while True: pass", "expect": "TLE"},
        {"code": "undefined_var", "expect": "CE"}
    ]

    phase3_results = []
    for wrong in wrong_codes:
        result = await verify_oj_code({
            "code": wrong["code"],
            "language": language,
            "test_cases": test_cases[:1] if test_cases else []
        }, user_info)

        phase3_results.append({
            "expect": wrong["expect"],
            "actual": result["verdict"],
            "correct": result["verdict"] == wrong["expect"]
        })

    # 检查反向测试是否都正确
    phase3_correct = all(r["correct"] for r in phase3_results)

    return {
        "success": True,
        "phase1": {"verdict": phase1_result["verdict"]},
        "phase2": phase2_results,
        "phase3": phase3_results,
        "all_passed": phase3_correct
    }


register_tool(
    "full_verify_oj_question",
    full_verify_oj_question,
    description="完整 OJ 验证（三阶段）",
    params_schema={
        "code": {"type": "string", "required": True},
        "language": {"type": "string", "default": "python"},
        "test_cases": {"type": "array", "required": True},
        "difficulty": {"type": "string", "default": "medium"}
    }
)


# ============================================================
# 辅助函数
# ============================================================
def generate_boundary_tests(difficulty: str) -> List[Dict]:
    """生成边界测试数据"""
    tests = []

    # 空输入
    tests.append({
        "input": "",
        "expected": "\n",
        "desc": "空输入"
    })

    # 最大输入
    max_n = {"easy": 100, "medium": 1000, "hard": 10000}.get(difficulty, 1000)
    tests.append({
        "input": f"{max_n}\n" + " ".join([str(i) for i in range(max_n)]),
        "expected": "valid",
        "desc": f"最大输入 n={max_n}"
    })

    # 特殊值
    tests.append({
        "input": "0\n",
        "expected": "\n",
        "desc": "零输入"
    })

    tests.append({
        "input": "1\n42\n",
        "expected": "42\n",
        "desc": "单元素"
    })

    return tests


def register_oj_tools():
    """注册 OJ 相关 Tools"""
    pass