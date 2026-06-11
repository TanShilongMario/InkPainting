# 墨韵 · InkPaint

> 笔 墨 纸 水 · 皆有灵性

一款纯前端的网页水墨画绘制工具。无需安装、无需服务器，在浏览器中即可体验中国传统水墨的笔意与晕染。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Stack](https://img.shields.io/badge/stack-HTML%20%2B%20CSS%20%2B%20JS-orange.svg)

---

## 特性

- **四支毛笔** — 狼毫工笔、羊毫写意、散锋皴擦、斗笔泼墨，各有笔性
- **八级墨干湿** — 从焦墨到烟墨，控制浓淡、干燥与洇散
- **八种古典色** — 玄墨、花青、朱砂、藤黄……设色如山水
- **四种宣纸** — 玉版宣、仿古宣、茶笺、月白笺，带纤维肌理
- **流体晕染** — 湿墨落笔后持续渗化，指状洇散如生宣吸墨
- **清水笔** — 破墨、冲墨，墨随水走
- **题款钤印** — 竖排题词 + 朱文印章
- **本地画廊** — 作品收入册页，随时续画或导出 PNG

---

## 快速开始

### 环境要求

- 任意现代浏览器（Chrome、Firefox、Edge、Safari）
- 无需 Node.js，无需构建步骤

### 运行

```bash
# 克隆或下载后，直接用浏览器打开
start index.html        # Windows
open index.html         # macOS
xdg-open index.html     # Linux
```

或使用本地静态服务器（可选，避免部分浏览器的 file:// 限制）：

```bash
npx serve .
# 或
python -m http.server 8080
```

然后访问 `http://localhost:8080`。

### 基本操作

| 操作 | 方式 |
|---|---|
| 作画 | 鼠标左键拖拽 |
| 撤销 | `Ctrl + Z`（Mac：`Cmd + Z`） |
| 保存 | 工具栏「入藏」 |
| 导出 | 工具栏「成图」 |
| 题款 | 工具栏「题款」→ 填写内容 → 点选画面位置 |
| 返回画廊 | 工具栏「画廊」 |

---

## 项目结构

```
InkPaint/
├── index.html          # 画廊 + 绘制双视图
├── style.css           # 中国风 UI
├── app.js              # 水墨引擎（~1200 行）
├── PRD.md              # 产品需求文档
├── Architecture.md     # 技术架构说明
└── README.md           # 本文件
```

---

## 技术栈

| 层级 | 技术 |
|---|---|
| 标记 | HTML5 |
| 样式 | CSS3（CSS 变量、竖排书写、Grid） |
| 逻辑 | 原生 JavaScript（ES6+，strict mode） |
| 渲染 | Canvas 2D API |
| 存储 | localStorage |
| 字体 | Google Fonts（Ma Shan Zheng、Noto Serif SC） |

---

## 文档

- [PRD.md](./PRD.md) — 产品定位、功能清单、设计约束
- [Architecture.md](./Architecture.md) — 渲染管线、流体模拟、数据流

---

## 设计原则

本项目刻意保持克制：

- 单文件引擎，零构建依赖
- 简单撤销（6 步），无图层系统
- 本地存储，无云端与账户
- 以鼠标指针为主，非触屏优先

---

## 许可证

MIT License
