# /test-ai — AI服务流式提取测试

运行AI服务（Al_server）的流式提取测试，验证PDF题目提取功能是否正常。

## 执行步骤

### 1. 确认AI服务运行状态
先检查服务是否在运行：
```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/
```
如果返回非200/404/405，或者连接失败，则先启动服务：
```bash
cd /root/SmartOI/gespgrowplan/Al_server && bash start.sh
```

### 2. 运行测试脚本
```bash
cd /root/SmartOI/gespgrowplan/Al_server && python3 tests/test_stream_extract.py --expected 25
```

### 3. 分析结果
- 如果全部通过，报告测试结果
- 如果有失败项，查看 `server.log` 日志排查问题：
  ```bash
  tail -50 /root/SmartOI/gespgrowplan/Al_server/server.log
  ```
- 根据错误类型给出修复建议

### 4. 可选：测试其他PDF
用户可以指定其他PDF和预期题目数：
```bash
cd /root/SmartOI/gespgrowplan/Al_server && python3 tests/test_stream_extract.py --pdf /path/to/other.pdf --expected 15
```

## 测试覆盖项
1. 服务可用性
2. 流式提取请求
3. SSE事件类型完整性
4. 题目数量
5. 题目结构校验（必填字段）
6. 题目类型分布
7. 流式增量验证（index连续递增）
8. process_complete事件一致性
