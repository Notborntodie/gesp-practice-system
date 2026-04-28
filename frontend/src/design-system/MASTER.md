# GESP Admin Backend - Design System

> 基于 UI/UX Pro Max skill 分析生成的设计规范，适用于管理后台所有页面。

---

## 核心风格

### Style: Soft UI Evolution
- **描述**: 柔和 UI 演进版，更好的对比度，现代美学，微妙深度感，无障碍优先
- **关键词**: 柔和阴影、现代感、专业、WCAG AA+ 可访问性
- **适用场景**: 现代企业应用、SaaS 平台、管理后台、教育工具
- **性能**: Excellent | **可访问性**: WCAG AA+

### 避免的反模式
- ❌ 界面拥挤杂乱
- ❌ 没有视觉层次感
- ❌ 过度装饰的边框/阴影
- ❌ 使用 emoji 作为图标
- ❌ 低对比度文字 (#999 on white)

---

## 色板

### Primary Colors
| Token | 值 | 用途 |
|-------|-----|------|
| `--color-primary` | `#2563EB` | 主按钮、链接、选中态、焦点环 |
| `--color-on-primary` | `#FFFFFF` | 主按钮上的文字 |
| `--color-secondary` | `#3B82F6` | 辅助按钮、次要操作 |

### Semantic Colors
| Token | 值 | 用途 |
|-------|-----|------|
| `--color-accent` | `#059669` | 成功状态、创建/添加按钮 |
| `--color-destructive` | `#DC2626` | 删除、危险操作、错误提示 |
| `--color-warning` | `#D97706` | 警告提示（预留） |

### Surface Colors
| Token | 值 | 用途 |
|-------|-----|------|
| `--color-background` | `#F8FAFC` | 页面背景 |
| `--color-surface` | `#FFFFFF` | 卡片、表格、对话框背景 |
| `--color-muted` | `#F1F5FD` | 禁用状态、浅色区块 |
| `--color-border` | `#E4ECFC` | 分隔线、输入框边框 |

### Text Colors
| Token | 值 | 用途 |
|-------|-----|------|
| `--color-foreground` | `#0F172A` | 主文本（标题、正文） |
| `--color-text-secondary` | `#64748B` | 次文本（描述、辅助信息） |
| `--color-text-muted` | `#94A3B8` | 弱文本（占位符、时间戳） |

---

## 排版

### Font Family
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

Google Fonts 导入:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### 字号层级
| Token | Size | Weight | 用途 |
|-------|------|--------|------|
| `text-xs` | 12px | 400 | 辅助信息、标签 |
| `text-sm` | 14px | 400 | 正文、表格内容 |
| `text-base` | 16px | 400 | 主要正文 |
| `text-lg` | 18px | 500 | 小标题 |
| `text-xl` | 20px | 600 | 页面区块标题 |
| `text-2xl` | 24px | 700 | 页面主标题 |

### 行高
- 正文: `line-height: 1.5`
- 标题: `line-height: 1.25`

---

## 间距系统

基于 8px 基准:

| Token | 值 | 用途 |
|-------|-----|------|
| `space-1` | 4px | 元素内微间距 |
| `space-2` | 8px | 紧密元素间距 |
| `space-3` | 12px | 输入框内边距 |
| `space-4` | 16px | 卡片内边距、元素间距 |
| `space-5` | 20px | 区块间距 |
| `space-6` | 24px | 页面区块间距 |
| `space-8` | 32px | 大区块分隔 |

---

## 圆角

| Token | 值 | 用途 |
|-------|-----|------|
| `radius-sm` | 4px | 按钮、输入框 |
| `radius-md` | 8px | 标签、小组件 |
| `radius-lg` | 12px | 卡片、对话框 |
| `radius-full` | 9999px | 状态徽章、标签 |

---

## 阴影

Soft UI 风格的柔和阴影:

```css
/* 卡片默认阴影 */
--shadow-card: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);

/* 卡片悬浮阴影 */
--shadow-card-hover: 0 4px 12px rgba(0, 0, 0, 0.1);

/* 对话框阴影 */
--shadow-modal: 0 8px 30px rgba(0, 0, 0, 0.12);
```

---

## 组件规范

### 按钮
| 类型 | 样式 |
|------|------|
| Primary | `bg-primary` + `text-white` + `radius-sm` + `shadow-sm` |
| Secondary | `bg-surface` + `border-border` + `text-foreground` |
| Destructive | `bg-destructive` + `text-white` |
| Ghost | `bg-transparent` + `text-primary` + hover:bg-muted |

状态:
- Hover: 亮度降低 10% 或背景色变化
- Active: scale(0.98) 微缩放
- Disabled: opacity-50, cursor-not-allowed
- Loading: 禁用 + spinner 图标

最小高度: 36px，内边距: 8px 16px

### 输入框
- 背景: `bg-surface`
- 边框: `1px solid border` (默认), `2px solid primary` (焦点)
- 圆角: `radius-sm`
- 内边距: `12px 16px`
- Placeholder 颜色: `text-muted`
- Focus ring: `0 0 0 3px rgba(37, 99, 235, 0.2)`

### 数据表格
- 表头: `bg-muted` + `text-secondary` + `text-sm` + 粘性定位
- 行高: 48px
- 行 Hover: `bg-muted`
- 边框: `border-bottom 1px solid border`
- 单选/多选列宽: 48px

### 卡片
- 背景: `bg-surface`
- 圆角: `radius-lg`
- 阴影: `shadow-card`
- 内边距: `space-4`
- Hover: `shadow-card-hover` (可选)

### 对话框
- 尺寸: 小 (400px), 中 (600px), 大 (800px)
- 背景: `bg-surface`
- 圆角: `radius-lg`
- 阴影: `shadow-modal`
- 遮罩: `rgba(0, 0, 0, 0.5)`
- Header: 标题 + 关闭按钮 (右上角)
- Footer: 按钮组右对齐

### 标签/徽章
- 圆角: `radius-full`
- 内边距: `4px 12px`
- 字号: `text-xs`
- 状态颜色映射:
  - Active/成功: `bg-accent/10` + `text-accent`
  - Pending: `bg-warning/10` + `text-warning`
  - Error: `bg-destructive/10` + `text-destructive`
  - Disabled: `bg-muted` + `text-muted`

---

## UX 规则 (高优先级)

### 加载状态 (Severity: High)
- ✅ 异步操作显示 skeleton 或 spinner
- ✅ 操作 > 300ms 必须有视觉反馈
- ✅ 按钮 loading 时禁用 + spinner
- ❌ UI 冻结无反馈
- ❌ 按钮在处理中仍可点击

### 表单提交 (Severity: High)
- ✅ 提交后显示 loading → success/error
- ✅ 所有输入框必须有 label
- ❌ 仅用 placeholder 作为标签
- ❌ 提交后无反馈

### 可访问性 (Severity: High)
- ✅ 文字对比度 ≥ 4.5:1 (正文)
- ✅ 焦点状态可见
- ✅ 键盘导航顺序与视觉顺序一致
- ✅ 图标按钮必须有 aria-label
- ❌ 仅用颜色传达信息
- ❌ 移除焦点环无替代

### 交互反馈
- ✅ 所有可点击元素有 cursor-pointer
- ✅ Hover 状态过渡 150-300ms
- ✅ 禁用状态: opacity-50 + cursor-not-allowed
- ❌ 无 hover 反馈
- ❌ 禁用元素仍可交互

---

## 图标规范

- **首选图标库**: Lucide Icons (`lucide-vue-next`)
- **禁止**: 使用 emoji 作为功能性图标
- **尺寸**: 16px (inline), 20px (按钮内), 24px (独立图标)
- ** strokeWidth**: 1.5 (默认)
- **颜色**: 继承文字颜色或使用 semantic color

---

## 页面布局模板

### 管理页面标准布局
```
┌─────────────────────────────────────────────────────────┐
│ PageHeader (标题 + 统计 + 操作按钮)                      │
├─────────────────────────────────────────────────────────┤
│ FilterBar (搜索 + 下拉筛选 + 排序)                       │
├─────────────────────────────────────────────────────────┤
│ DataTable (数据表格)                                     │
│   - 分页                                                 │
│   - 行操作按钮                                           │
├─────────────────────────────────────────────────────────┤
│ EmptyState (无数据时显示)                                │
└─────────────────────────────────────────────────────────┤
```

### 侧边栏布局
- 侧边栏宽度: 240px (固定)
- 侧边栏背景: `bg-muted` 或 `bg-surface`
- 菜单项高度: 40px
- 菜单项 Hover: `bg-primary/10`
- 菜单项 Active: `bg-primary/10` + `text-primary` + 左侧指示线

---

## 响应式断点

| 断点 | 宽度 | 用途 |
|------|------|------|
| `sm` | 640px | 大手机 |
| `md` | 768px | 平板 |
| `lg` | 1024px | 小桌面 |
| `xl` | 1280px | 标准桌面 |

表格响应式:
- < 768px: 隐藏次要列，或切换为卡片布局
- ≥ 1024px: 显示完整表格

---

## 交付前检查清单

- [ ] 无 emoji 作为功能性图标
- [ ] 所有可点击元素有 cursor-pointer
- [ ] Hover 过渡时间 150-300ms
- [ ] 文字对比度 ≥ 4.5:1
- [ ] 焦点状态可见
- [ ] 支持 prefers-reduced-motion
- [ ] 响应式测试: 375px, 768px, 1024px, 1440px
- [ ] Loading 状态正确显示
- [ ] 表单提交有反馈
- [ ] 禁用状态正确处理