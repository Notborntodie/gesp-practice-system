"""
Prompts 模块入口
"""

from local.prompts.system_prompt import build_system_prompt, get_default_prompt
from local.prompts.skill_prompts import get_skill_prompts

__all__ = ["build_system_prompt", "get_default_prompt", "get_skill_prompts"]