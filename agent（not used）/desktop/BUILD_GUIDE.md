# GESP Agent 桌面端构建指南

## 一、环境要求

### 1. Rust环境（Tauri需要）
```bash
# 安装Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 验证安装
rustc --version
cargo --version
```

### 2. Node.js环境
```bash
# 验证Node.js
node --version  # 需要 >= 16
npm --version
```

### 3. Python环境
```bash
# 安装PyInstaller
pip install pyinstaller
```

---

## 二、构建步骤

### Step 1: 打包Python Agent
```bash
cd /root/SmartOI/gespgrowplan/agent

# 执行打包脚本
chmod +x build/build-agent.sh
./build/build-agent.sh
```

输出: `desktop/python-dist/gesp-agent/`

### Step 2: 安装前端依赖
```bash
cd /root/SmartOI/gespgrowplan/agent/desktop

npm install
```

### Step 3: 开发模式运行
```bash
# 先启动前端开发服务器
npm run dev

# 再启动Tauri（需要Rust环境）
npm run tauri:dev
```

### Step 4: 生产打包
```bash
# 打包为安装文件
npm run tauri:build
```

输出位置:
- Windows: `src-tauri/target/release/bundle/msi/`
- Mac: `src-tauri/target/release/bundle/dmg/`
- Linux: `src-tauri/target/release/bundle/deb/`

---

## 三、跨平台打包

### Windows打包
需要在Windows机器上执行:
```bash
npm run tauri:build
# 生成: GESP-Agent_1.0.0_x64.msi
```

### Mac打包
需要在Mac机器上执行:
```bash
npm run tauri:build
# 生成: GESP-Agent.app, GESP-Agent_1.0.0_x64.dmg
```

### Linux打包
需要在Linux机器上执行:
```bash
npm run tauri:build
# 生成: gesp-agent_1.0.0_amd64.deb
```

---

## 四、图标配置

需要在 `desktop/src-tauri/icons/` 目录放置以下图标:

| 文件 | 尺寸 | 说明 |
|------|------|------|
| 32x32.png | 32x32 | 小图标 |
| 128x128.png | 128x128 | 大图标 |
| 128x128@2x.png | 256x256 | 高清图标 |
| icon.icns | - | Mac图标包 |
| icon.ico | - | Windows图标 |

生成图标:
```bash
# 使用Tauri命令生成默认图标
npm run tauri icon /path/to/source-image.png
```

---

## 五、打包后的文件结构

```
GESP-Agent.app/               # Mac应用包
├── Contents/
│   ├── MacOS/
│   │   ├── GESP-Agent        # Rust可执行文件
│   │   └── gesp-agent        # Python Agent
│   ├── Resources/
│   │   ├── python-dist/      # Python环境和代码
│   │   ├── config.json       # 配置文件
│   │   └── app.dist/         # Vue前端
│   └── Info.plist

GESP-Agent.exe                # Windows可执行文件
├── python-dist/              # Python Agent
├── config.json
├── resources/                # Vue前端资源
```

---

## 六、首次使用流程

用户安装后的首次使用:

1. 启动应用
2. 配置LLM API Key（用户自己的Key）
3. 登录系统（获取MCP API Key）
4. 选择对话风格
5. 开始使用

---

## 七、注意事项

1. **Python打包大小**: 约50-100MB（包含Python运行时）
2. **整体安装包大小**: 约80-150MB
3. **首次启动**: 需要初始化Python环境，可能较慢
4. **跨平台**: 需要在目标平台上打包，无法交叉编译