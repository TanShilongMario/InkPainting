# 墨韵 · InkPainting

> 笔 墨 纸 水 · 皆有灵性

一款纯前端的网页水墨画绘制工具。无需安装、无需服务器，在浏览器中即可体验中国传统水墨的笔意与晕染。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
![Stack](https://img.shields.io/badge/stack-HTML%20%2B%20CSS%20%2B%20JS-orange.svg)

**在线体验**：克隆仓库后用浏览器打开 `index.html`，或参见下方「快速开始」。

---

## 特性

- **四支毛笔** — 狼毫工笔、羊毫写意、散锋皴擦、斗笔泼墨，各有笔性
- **八级墨干湿** — 从焦墨到烟墨，控制浓淡、干燥与洇散
- **八种古典色** — 玄墨、花青、朱砂、藤黄……设色如山水
- **四种宣纸** — 玉版宣、仿古宣、茶笺、月白笺，带纤维肌理
- **流体晕染** — 湿墨落笔后持续渗化，指状洇散如生宣吸墨
- **清水笔** — 破墨、冲墨，墨随水走；干透的墨更难打散
- **题款钤印** — 竖排题词 + 阴刻/阳刻印章，多种字体
- **本地画廊** — 作品收入册页，随时续画或导出 PNG
- **移动端** — 两侧文房抽屉 + 底部功能栏，触屏可画（Phase A）

---

## 快速开始

### 环境要求

- 任意现代浏览器（Chrome、Firefox、Edge、Safari）
- 无需 Node.js，无需构建步骤

### 运行

```bash
git clone https://github.com/TanShilongMario/InkPainting.git
cd InkPainting

# 直接用浏览器打开
open index.html         # macOS
start index.html        # Windows
xdg-open index.html     # Linux
```

或使用本地静态服务器（推荐，避免 `file://` 限制，也方便手机同网测试）：

```bash
python3 -m http.server 8080 --bind 0.0.0.0
# 本机访问 http://localhost:8080
# 手机同 Wi-Fi 访问 http://<电脑局域网IP>:8080
```

### 基本操作

| 操作 | 桌面 | 移动端 |
|---|---|---|
| 作画 | 鼠标左键拖拽 | 单指拖拽画布 |
| 撤销 | `Ctrl/Cmd + Z` | 底部「撤笔」 |
| 选笔 / 墨 / 色 | 画布两侧工具栏 | 点「笔墨」抽屉 |
| 选纸 / 水 / 题款 | 画布右侧工具栏 | 点「纸印」抽屉 |
| 保存 / 导出 / 画廊 | 左侧功能栏 | 点「功能」底栏 |
| 题款 | 「题款」→ 填写 → 点选位置 | 同上 |
| 钤印 | 「钤印」→ 选印式字体 → 点选位置 | 同上 |

---

## 项目结构

```
InkPainting/
├── index.html          # 画廊 + 绘制双视图
├── style.css           # 中国风 UI（含移动端断点）
├── app.js              # 水墨引擎（~1600 行）
├── PRD.md              # 产品需求文档
├── Architecture.md     # 技术架构说明
├── Mobile.md           # 移动端适配规划与进度
├── LICENSE             # MIT 许可证
└── README.md           # 本文件
```

---

## 技术栈

| 层级 | 技术 |
|---|---|
| 标记 | HTML5 |
| 样式 | CSS3（CSS 变量、竖排书写、Grid、媒体查询） |
| 逻辑 | 原生 JavaScript（ES6+，strict mode） |
| 渲染 | Canvas 2D API |
| 模拟 | 细胞自动机流体渗流 + 减色混合 |
| 存储 | localStorage |
| 字体 | Google Fonts（Ma Shan Zheng、Noto Serif SC） |

---

## 文档

- [PRD.md](./PRD.md) — 产品定位、功能清单、设计约束
- [Architecture.md](./Architecture.md) — 渲染管线、流体模拟、数据流
- [Mobile.md](./Mobile.md) — 移动端布局与手感适配规划

---

## 设计原则

本项目刻意保持克制：

- 单文件引擎，零构建依赖
- 简单撤销（桌面 24 步 / 触屏 5 步），无图层系统
- 本地存储，无云端与账户
- 东方审美 UI：留白、竖排、朱砂点缀

---

## 许可证

本项目采用 [MIT License](./LICENSE) 开源。
