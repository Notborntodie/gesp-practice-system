# GESP Agent 高可用部署设计

## 一、MCP Server 高可用架构

### 1.1 多实例部署

```
                     ┌─────────────────┐
                     │   Nginx LB      │
                     │  (负载均衡)      │
                     └─────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
            ↓                 ↓                 ↓
     ┌──────────┐      ┌──────────┐      ┌──────────┐
     │ MCP #1   │      │ MCP #2   │      │ MCP #3   │
     │ Port 8001│      │ Port 8002│      │ Port 8003│
     └──────────┘      └──────────┘      └──────────┘
            │                 │                 │
            └─────────────────┼─────────────────┘
                              │
                              ↓
                     ┌─────────────────┐
                     │   MySQL         │
                     │  (主从复制)      │
                     └─────────────────┘
                              │
                              ↓
                     ┌─────────────────┐
                     │   Redis         │
                     │  (缓存/队列)     │
                     └─────────────────┘
```

### 1.2 Nginx 配置

```nginx
# /etc/nginx/conf.d/mcp-upstream.conf

upstream mcp_servers {
    # 三台 MCP Server
    server 127.0.0.1:8001 weight=1 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:8002 weight=1 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:8003 weight=1 max_fails=3 fail_timeout=30s;

    # 健康检查（需要 nginx-plus 或第三方模块）
    # check interval=3000 rise=2 fall=3 timeout=1000;

    # 保持会话（可选，基于 API Key）
    hash $http_x_api_key consistent;
}

server {
    listen 443 ssl http2;
    server_name mcp.gespgrowplan.com;

    # SSL 配置
    ssl_certificate /etc/ssl/mcp.gespgrowplan.com.crt;
    ssl_certificate_key /etc/ssl/mcp.gespgrowplan.com.key;
    ssl_protocols TLSv1.3 TLSv1.2;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location /mcp/ {
        proxy_pass http://mcp_servers;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 超时配置
        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;

        # 健康检查端点
        proxy_next_upstream error timeout http_502 http_503 http_504;
    }

    location /health {
        # 直接返回健康状态
        return 200 'OK';
        add_header Content-Type text/plain;
    }
}
```

### 1.3 MCP Server 实例管理

```bash
# 使用 systemd 管理多实例

# /etc/systemd/system/mcp-server@.template
[Unit]
Description=GESP MCP Server Instance %i
After=network.target mysql.service redis.service

[Service]
Type=simple
User=gesp
WorkingDirectory=/opt/gespgrowplan/agent/server
Environment="PORT=800%i"
Environment="INSTANCE_ID=%i"
ExecStart=/opt/gespgrowplan/agent/server/venv/bin/python main.py
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog

[Install]
WantedBy=multi-user.target

# 启动三实例
systemctl enable mcp-server@1
systemctl enable mcp-server@2
systemctl enable mcp-server@3

systemctl start mcp-server@1
systemctl start mcp-server@2
systemctl start mcp-server@3
```

### 1.4 健康检查与自动重启

```python
# server/health_check.py

import asyncio
import httpx
import logging

class HealthChecker:
    """健康检查器"""

    INSTANCES = [
        {"id": 1, "port": 8001},
        {"id": 2, "port": 8002},
        {"id": 3, "port": 8003}
    ]

    CHECK_INTERVAL = 30  # 每30秒检查
    MAX_FAILURES = 3     # 连续失败3次重启

    def __init__(self):
        self.failure_counts = {i["id"]: 0 for i in self.INSTANCES}

    async def check_all(self):
        """检查所有实例"""
        for instance in self.INSTANCES:
            healthy = await self.check_instance(instance)

            if not healthy:
                self.failure_counts[instance["id"]] += 1

                if self.failure_counts[instance["id"]] >= self.MAX_FAILURES:
                    await self.restart_instance(instance)
                    self.failure_counts[instance["id"]] = 0
            else:
                self.failure_counts[instance["id"]] = 0

    async def check_instance(self, instance) -> bool:
        """检查单个实例"""
        try:
            client = httpx.AsyncClient()
            response = await client.get(
                f"http://localhost:{instance['port']}/health",
                timeout=5
            )
            return response.status_code == 200
        except Exception as e:
            logging.warning(f"实例 {instance['id']} 健康检查失败: {e}")
            return False

    async def restart_instance(self, instance):
        """重启实例"""
        import subprocess

        logging.error(f"重启实例 {instance['id']}")

        subprocess.run([
            "systemctl", "restart", f"mcp-server@{instance['id']}"
        ])

    async def run_forever(self):
        """持续检查"""
        while True:
            await self.check_all()
            await asyncio.sleep(self.CHECK_INTERVAL)
```

---

## 二、数据库高可用

### 2.1 MySQL 主从复制

```
┌─────────────────┐
│   MySQL Master  │
│   (写入)        │
└─────────────────┘
        │
        │ Binary Log 复制
        ↓
┌─────────────────┐
│   MySQL Slave   │
│   (读取)        │
└─────────────────┘
```

**主库配置**：
```ini
# /etc/mysql/mysql.conf.d/master.cnf

[mysqld]
server-id = 1
log-bin = mysql-bin
binlog-format = ROW
sync-binlog = 1
```

**从库配置**：
```ini
# /etc/mysql/mysql.conf.d/slave.cnf

[mysqld]
server-id = 2
relay-log = relay-log
read-only = 1
```

**应用层读写分离**：
```python
# server/database/router.py

class DatabaseRouter:
    """读写分离路由"""

    MASTER = "master"
    SLAVE = "slave"

    async def execute_write(self, sql, params):
        """写操作用主库"""
        return await self.master_pool.execute(sql, params)

    async def execute_read(self, sql, params):
        """读操作用从库"""
        return await self.slave_pool.execute(sql, params)

    async def get_connection(self, is_write=False):
        """获取连接"""
        if is_write:
            return self.MASTER
        return self.SLAVE
```

### 2.2 Redis 缓存层

```python
# server/cache/redis_cache.py

import aioredis

class MCPCache:
    """MCP 缓存"""

    def __init__(self):
        self.redis = await aioredis.create_redis_pool(
            "redis://localhost",
            minsize=5,
            maxsize=20
        )

    async def cache_user_memory(self, teacher_id, memory):
        """缓存用户记忆"""
        key = f"memory:{teacher_id}"
        await self.redis.set(key, json.dumps(memory), expire=3600)

    async def get_cached_memory(self, teacher_id):
        """获取缓存记忆"""
        key = f"memory:{teacher_id}"
        cached = await self.redis.get(key)
        if cached:
            return json.loads(cached)
        return None

    async def cache_skill_list(self, skills):
        """缓存 Skill 列表"""
        await self.redis.set("skills:public", json.dumps(skills), expire=600)

    async def invalidate_user_cache(self, teacher_id):
        """清除用户缓存"""
        await self.redis.delete(f"memory:{teacher_id}")
```

---

## 三、故障恢复

### 3.1 故障检测

```python
class FaultDetector:
    """故障检测器"""

    async def detect_database_failure(self):
        """检测数据库故障"""
        try:
            await db.ping()
            return False
        except:
            return True

    async def detect_redis_failure(self):
        """检测 Redis 故障"""
        try:
            await redis.ping()
            return False
        except:
            return True

    async def detect_all(self):
        """检测所有组件"""
        faults = {
            "database": await self.detect_database_failure(),
            "redis": await self.detect_redis_failure()
        }

        if any(faults.values()):
            await self.send_alert(faults)

        return faults

    async def send_alert(self, faults):
        """发送告警"""
        message = f"MCP Server 故障: {faults}"

        # 推送企业微信
        await wechat_bot.send_to_admin(
            admin_id=1,
            message=message
        )

        # 记录日志
        logging.critical(message)
```

### 3.2 降级策略

```python
class DegradationStrategy:
    """降级策略"""

    async def handle_database_failure(self):
        """数据库故障降级"""
        # 1. 使用缓存响应
        # 2. 只允许查询操作（读缓存）
        # 3. 写操作返回"服务降级"提示

        return {
            "status": "degraded",
            "message": "数据库维护中，仅支持查询操作",
            "features": ["query_only"]
        }

    async def handle_redis_failure(self):
        """Redis 故障降级"""
        # 1. 直接查询数据库
        # 2. 不使用缓存，性能下降
        # 3. 记录警告日志

        logging.warning("Redis 不可用，降级为直接查询")
        return {"status": "degraded", "cache_disabled": True}
```

---

## 四、监控与告警

### 4.1 Prometheus 监控

```python
# server/monitoring/metrics.py

from prometheus_client import Counter, Histogram, Gauge

# 定义指标
REQUEST_COUNT = Counter(
    'mcp_requests_total',
    'Total MCP requests',
    ['tool', 'user_id']
)

REQUEST_LATENCY = Histogram(
    'mcp_request_latency_seconds',
    'Request latency',
    ['tool']
)

ACTIVE_USERS = Gauge(
    'mcp_active_users',
    'Number of active users'
)

ERROR_RATE = Counter(
    'mcp_errors_total',
    'Total errors',
    ['tool', 'error_type']
)

async def track_request(tool, user_id, latency, success):
    """记录请求指标"""
    REQUEST_COUNT.labels(tool=tool, user_id=user_id).inc()
    REQUEST_LATENCY.labels(tool=tool).observe(latency)

    if not success:
        ERROR_RATE.labels(tool=tool, error_type="failed").inc()
```

### 4.2 Grafana Dashboard

```yaml
# grafana-dashboard.yaml

dashboard:
  title: GESP MCP Server Monitor

  panels:
    - title: Request Rate
      type: graph
      datasource: prometheus
      targets:
        - expr: rate(mcp_requests_total[5m])

    - title: Latency Distribution
      type: histogram
      targets:
        - expr: mcp_request_latency_seconds

    - title: Error Rate
      type: graph
      targets:
        - expr: rate(mcp_errors_total[5m])

    - title: Active Users
      type: gauge
      targets:
        - expr: mcp_active_users
```

### 4.3 告警规则

```yaml
# prometheus-alerts.yaml

groups:
  - name: mcp_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(mcp_errors_total[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "MCP 错误率过高"

      - alert: HighLatency
        expr: histogram_quantile(0.9, mcp_request_latency_seconds) > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "MCP 响应延迟过高"

      - alert: InstanceDown
        expr: up{job="mcp"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "MCP 实例宕机"
```

---

## 五、部署脚本

```bash
# scripts/deploy_mcp.sh

#!/bin/bash

# MCP Server 部署脚本

echo "部署 MCP Server..."

# 1. 检查依赖
echo "检查依赖..."
systemctl is-active mysql || echo "MySQL 未运行"
systemctl is-active redis || echo "Redis 未运行"

# 2. 拉取代码
echo "更新代码..."
cd /opt/gespgrowplan/agent/server
git pull origin main

# 3. 更新依赖
echo "更新依赖..."
source venv/bin/activate
pip install -r requirements.txt

# 4. 数据库迁移
echo "执行迁移..."
mysql -u root -p gesp_practice_system < ../database/migrate_agent_tables.sql

# 5. 重启服务
echo "重启 MCP Server..."
systemctl restart mcp-server@1
systemctl restart mcp-server@2
systemctl restart mcp-server@3

# 6. 健康检查
echo "健康检查..."
sleep 5

curl -f http://localhost:8001/health || echo "实例1健康检查失败"
curl -f http://localhost:8002/health || echo "实例2健康检查失败"
curl -f http://localhost:8003/health || echo "实例3健康检查失败"

# 7. 重载 Nginx
echo "重载 Nginx..."
nginx -s reload

echo "部署完成！"
```