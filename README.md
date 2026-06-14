# 墨韵 · InkPainting

> 笔 墨 纸 水 · 皆有灵性

一款纯前端的网页水墨画绘制工具。无需安装、无需服务器，在浏览器中即可体验中国传统水墨的笔意与晕染。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
![Version](https://img.shields.io/badge/version-v1.2-green.svg)
![Stack](https://img.shields.io/badge/stack-HTML%20%2B%20CSS%20%2B%20JS-orange.svg)

**仓库**：[github.com/TanShilongMario/InkPainting](https://github.com/TanShilongMario/InkPainting)

克隆仓库后用浏览器打开 `index.html`，或参见下方「快速开始」。

---

## 特性

- **四支毛笔** — 狼毫工笔、羊毫写意、散锋皴擦、斗笔泼墨，各有笔性；每笔可调「毫」级粗细
- **四种皴法** — 散锋笔下披麻 / 斧劈 / 雨点 / 卷云，写山石肌理
- **八级墨干湿** — 从焦墨到烟墨，控制浓淡、干燥与洇散
- **八种古典色** — 玄墨、花青、朱砂、藤黄……设色如山水
- **四种宣纸** — 玉版宣、仿古宣、茶笺、月白笺，带纤维肌理
- **流体晕染** — 湿墨落笔后持续渗化，指状洇散如生宣吸墨；干透的墨固着于纸，更难被水洗打散
- **清水笔** — 破墨、冲墨，墨随水走；共用笔刷大小与墨级设定
- **题款钤印** — 竖排题词 / 阴刻·阳刻印章；多字体、三档字号；简体输入自动转繁
- **高清成图** — 内部超采样渲染，导出 PNG 更清晰而相对笔触/字号不变
- **过程留影** — 后台记录绘制步骤，一键「成列」导出过程 GIF（≤5MB）或「成影」导出 ≥1K 高清短片（MP4 优先）
- **本地画廊** — 作品以 IndexedDB 收入册页，容量充足，随时续画
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
| 选笔 / 毫 / 墨 / 色 | 画布左侧工具栏 | 点「笔墨」抽屉 |
| 选纸 / 水 / 题款 / 钤印 | 画布右侧工具栏 | 点「纸印」抽屉 |
| 入藏 / 成图 / 成列 / 成影 / 画廊 | 左侧功能栏 | 点「功能」底栏 |
| 题款 | 「题款」→ 填写 → 点选位置 | 同上 |
| 钤印 | 「钤印」→ 选印式字体 → 点选位置 | 同上 |

---

## 项目结构

```
InkPainting/
├── index.html          # 画廊 + 绘制双视图
├── style.css           # 中国风 UI（含移动端断点）
├── app.js              # 水墨引擎（~2600 行）
├── s2t.js              # 简繁转换字表（OpenCC 单字映射）
├── scripts/gen-s2t.js  # 字表生成脚本
├── vendor/gifenc.js    # GIF 编码器（单文件，MIT）
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
| 渲染 | Canvas 2D API（超采样高清成图） |
| 模拟 | 细胞自动机流体渗流 + 减色混合 + 颜料固着 |
| 导出 | PNG · GIF（gifenc）· MP4/WebM（MediaRecorder，视频 ≥1K） |
| 存储 | IndexedDB（旧 localStorage 数据自动迁移） |
| 字体 | Google Fonts 中国镜像（Ma Shan Zheng、Noto Serif SC/TC 等） |

---

## 文档

- [PRD.md](./PRD.md) — 产品定位、功能清单、设计约束
- [Architecture.md](./Architecture.md) — 渲染管线、流体模拟、数据流
- [Mobile.md](./Mobile.md) — 移动端布局与手感适配规划

---

## 版本日志

### v1.2 · 2026-06-14

**绘制过程导出**

- 「成列」导出过程 GIF：后台自适应抽帧（封顶并隔帧抽稀），全局调色板，逐级降级保证 ≤ 5MB
- 「成影」导出过程短片：浏览器原生 MediaRecorder，MP4 优先（不支持时回退 WebM），输出 ≥1K 高清

**高清与皴法**

- 内部超采样渲染：成图更清晰，而笔触大小、字号等相对设定保持不变
- 散锋四种皴法（披麻 / 斧劈 / 雨点 / 卷云）；停笔顺线曲线采样加密

**存储与字体**

- 画廊存储改用 IndexedDB，容量充足，入藏直存全分辨率；旧 localStorage 数据自动迁移
- 字体改走 Google 官方中国镜像（`fonts.googleapis.cn`），国内加载稳定；失败回退系统字体
- 题款 / 钤印补 Noto Serif TC，繁体字形更地道；印章边缘破损与做旧改为轻微

---

### v1.1 · 2026-06-11

**水墨引擎**

- 重写流体渗流：不规则指状洇散、减色混合、纤维渗透率场
- 墨级扩展至 8 级；单笔缓冲合成，浅色不再越叠越黑
- 侧锋、贝塞尔圆化、收笔出锋（克制版）、散锋簇状肌理
- 颜料固着 + 墨龄追踪：干透的墨更难被清水笔打散
- 清水笔重制：净减淡、更大范围晕染，随墨龄衰减
- 流体静止时跳过扫描，桌面与移动端均更省电

**界面与布局**

- 绘制页三区布局：左功能栏 + 两侧文房栏 + 中央画布
- 每笔独立「毫」级粗细档位
- 题款 / 钤印拆分为独立弹窗；多字体、小中大字号
- 简体输入自动转繁（OpenCC 单字表）
- 钤印油印叠底：略透朱砂，纸纹可现

**移动端（Phase A）**

- 两侧文房抽屉（笔墨 / 纸印）+ 底部功能栏，三把手随时收展
- 触屏绘制加固：`setPointerCapture`、`pointercancel`、画布 `touch-action: none`
- 触屏撤销上限降为 5 步；墨/色选中 Toast 提示
- 弹窗改为底部 Sheet；画廊窄屏适配

**开源**

- 添加 MIT License，README 与 GitHub 仓库上线

---

### v1.0 · 2026-06-11

- 首版发布：四支毛笔、墨干湿、古典色、宣纸、流体晕染、清水笔
- 题款钤印、本地画廊、PNG 导出
- 纯前端单页，零构建依赖

---

## 设计原则

本项目刻意保持克制：

- 单文件引擎，零构建依赖（仅内置一个单文件 GIF 编码器）
- 简单撤销（桌面 10 步 / 触屏 3 步），无图层系统
- 本地存储（IndexedDB），无云端与账户
- 东方审美 UI：留白、竖排、朱砂点缀

---

## 许可证

本项目采用 [MIT License](./LICENSE) 开源。
