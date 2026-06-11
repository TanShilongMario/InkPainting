# 墨韵 · 技术架构

> 本文档描述 InkPaint 的渲染管线、核心模块与数据流。对应实现见 `app.js`。

---

## 1. 总体架构

```
┌─────────────────────────────────────────────────────────┐
│                      index.html                         │
│  ┌──────────────┐              ┌──────────────────────┐ │
│  │ view-gallery │              │     view-paint       │ │
│  │  画廊 / 品牌  │              │ toolbar + stage      │ │
│  └──────────────┘              └──────────────────────┘ │
└─────────────────────────────────────────────────────────┘
           │                              │
           ▼                              ▼
┌──────────────────┐          ┌───────────────────────────┐
│  Gallery Module  │          │     Paint Engine          │
│  localStorage    │          │  Canvas layers + Fluid    │
└──────────────────┘          └───────────────────────────┘
           │                              │
           └────────── style.css ─────────┘
```

**单页双视图**：画廊与绘制互斥显示（`.hidden` 切换），共享同一套样式与全局状态。

---

## 2. Canvas 分层模型

墨韵采用多层离屏 Canvas，最终在视图层合成：

```
paperC (纸面层)
    │
    ▼ multiply
inkC (墨层)  ◄── strokeC (单笔缓冲，抬笔时提交)
    │
    ▼ multiply
fluidC (流体层，250×348 网格放大渲染)
    │
    ▼
view (#paper) — 用户可见画布
```

| 层 | 尺寸 | 职责 |
|---|---|---|
| `paperC` | 1000×1390 | 宣纸底色、噪点肌理、纤维纹理、暗角 |
| `inkC` | 1000×1390 | 已固化墨迹（戳印、题款、印章） |
| `strokeC` | 1000×1390 | 当前一笔的临时缓冲，避免笔内自叠加变深 |
| `fluidC` | 250×348 | 湿墨渗流状态的低分辨率渲染 |
| `view` | 1000×1390 | 每帧合成输出 |

### 合成顺序（`loop()`）

1. 绘制纸面层
2. `globalCompositeOperation = 'multiply'` 叠墨层
3. 若正在运笔，以墨级透明度预览 `strokeC`
4. 放大绘制流体层（自带柔化）
5. 恢复 `source-over`

**乘法混合**使墨迹重叠处自然加深，模拟真实积墨。

---

## 3. 流体模拟系统

湿墨晕染由细胞自动机实现，是本项目的技术核心。

### 3.1 网格参数

```javascript
GRID_F = 4          // 1 格 = 4 像素
GW = 250, GH = 348  // 网格尺寸
CELLS = 87,000      // 总格数
```

### 3.2 状态数组（Float32Array）

| 数组 | 含义 |
|---|---|
| `water[]` | 每格水量 |
| `pigR/G/B[]` | 每格颜料吸光密度（减色混合用） |
| `perm[]` | 纸纤维渗透率场 |

### 3.3 渗透率场生成（`genPerm`）

1. 双尺度 Perlin 式插值噪声（36×50 粗 + 100×139 中）
2. 平方拉开对比，强化指状渗流
3. 16% 概率生成致密阻滞点（渗透率 ×0.05）

每张新画 / 打开画作时重新生成，使洇散纹理不重复。

### 3.4 落墨注入（`deposit`）

笔刷戳印时，若当前墨级 `bleed > 0`：

- 向网格注入水量与颜料密度
- 注入量受干燥度、笔型、纤维渗透率调制
- 工笔细笔注水系数仅 0.22，保持线条干净

### 3.5 渗流迭代（`fluidStep`）

每帧执行 **两次** `fluidStep`：

- 遍历网格，水向四邻格渗流
- 渗流速率 = 水位差 × 目标格渗透率
- 颜料随水迁移，但滞后系数 0.5（干后边缘留痕）
- 蒸发：每步水量 ×0.995 − 0.0002

### 3.6 渲染（`renderFluid`）

Beer-Lambert 定律将吸光密度转为像素值：

```
pixel = 255 × exp(−density)
```

输出到 `fluidC`，放大至全画布时产生柔和洇散边缘。

---

## 4. 笔触引擎

### 4.1 笔刷类型与渲染路径

```
pointerdown
    │
    ├─ placing? → placeInscription()
    ├─ washing? → washSegment()
    └─ painting → stampSegment()
                      │
                      ├─ bristle → drawBristles()（分叉笔毫）
                      ├─ fine    → 实线 + stamp()（工笔不断线）
                      └─ other   → stamp() 戳印序列
```

### 4.2 戳印（`stamp`）

每个墨点：

1. 计算干燥度 = 墨级干燥 + 速度 × 笔变异系数
2. 枯笔断墨：高干燥度时随机跳过
3. 绘制径向渐变墨体（侧锋偏移墨心）
4. 干燥时撒颗粒噪点（飞白）
5. 湿墨时调用 `deposit()` 注入流体网格

### 4.3 运笔平滑

- **二次贝塞尔**（`stampQuadratic`）：以上一中点为起点、上一采样点为控制点
- **指数平滑**：`lerp(last, current, 0.55~0.7)` 消除鼠标抖动
- **粗细惯性**：`curW` 渐变逼近目标宽度，避免突变

### 4.4 单笔提交（`commitStroke`）

抬笔时：

1. `finishStroke()` — 快速运笔时带出渐淡墨尾
2. 整笔 `strokeC` 以墨级透明度压入 `inkC`
3. 清空 `strokeC`

这样一笔内的墨色深浅由墨级统一决定，而非戳印自叠加。

---

## 5. 水洗系统

清水笔复用当前笔刷大小与墨级设定：

```
washAt(x, y)
    │
    ├─ 1. 取局部墨迹 → blur 模糊
    ├─ 2. 软边径向掩模羽化
    ├─ 3. destination-out 多点提墨（净变淡）
    ├─ 4. 低透明度回写模糊墨迹（沿运笔方向推移）
    └─ 5. rewet() — 拾取墨色入流体网格，继续渗化混合
```

**墨级影响水洗力度**：浓墨重洗近似橡皮，清墨轻抚只晕不褪。

---

## 6. 题款钤印

```
openInscribe() → 模态框输入
    │
    ▼
state.placing = { text, seal }
    │
    ▼
用户点选画面 → placeInscription()
    │
    ├─ 竖排 fillText（列间以空格分隔，右→左）
    └─ renderSeal() → 朱文方印 canvas → drawImage
```

印章预渲染在 120×120 离屏 canvas：朱底 + destination-out 镂空印文 + 边缘斑驳。

---

## 7. 撤销机制

```javascript
undoStack.push({
  img: ink.getImageData(...),   // 墨层快照
  water, pr, pg, pb             // 流体网格快照
});
// 最多 6 步
```

撤销时恢复墨层与流体状态，标记 `fluidDirty` 触发重渲染。

---

## 8. 存储与画廊

### 8.1 数据结构

```javascript
// localStorage key: 'inkpaint.works'
{
  id: 'w<timestamp><random>',
  name: '浣溪沙',
  paper: 'yuban',
  date: 1718000000000,
  thumb: 'data:image/jpeg;base64,...',  // 320px 宽合成缩略图
  ink: 'data:image/png;base64,...'      // 墨层 + 流体压平 PNG
}
```

### 8.2 保存流程（`saveCurrent`）

1. `flattenInk()` — 墨层 × 流体层乘法压平
2. 生成缩略图（320px 宽 JPEG 0.82）
3. 写入 localStorage
4. 存储满时自动降级为 0.55 倍分辨率重试

### 8.3 续画流程（`openWork`）

1. 恢复纸面设置，重生成渗透率场
2. 将保存的 `ink` PNG 绘入 `inkC`
3. 流体网格重置（已晕染状态烘焙在 PNG 中）

---

## 9. 主循环

```javascript
function loop() {
  fluidStep(); fluidStep();           // 渗流（每帧 ×2）
  if (fluidDirty) renderFluid();      // 更新流体纹理
  if (dirty) { /* 合成各层到 view */ }
  requestAnimationFrame(loop);
}
```

`dirty` 由笔触、水洗、撤销、纸面变更触发；流体有活动时也置 `dirty`。

---

## 10. 配置常量一览

| 常量组 | 数量 | 关键字段 |
|---|---|---|
| `BRUSHES` | 4 | `size`, `varia`, `type` |
| `WETNESS` | 8 | `alpha`, `dry`, `bleed`, `spread` |
| `COLORS` | 8 | `hex`, `r/g/b`, `kR/kG/kB` |
| `PAPERS` | 4 | `tint` |
| `NAMES` | 18 | 自动题名词牌名池 |

---

## 11. 扩展建议

若未来需要演进，可考虑：

| 方向 | 思路 |
|---|---|
| 触屏适配 | `pointer` 事件已就绪，需调笔压与双指手势 |
| 更大画布 | 流体网格与 ImageData 快照的内存开销需评估 |
| WebGL 流体 | 将 `fluidStep` 迁至 GPU Compute / Fragment Shader |
| 导入底图 | 在 `paperC` 或独立参考层绘制 |
| 笔刷预设 | 将 `BRUSHES[i]` 外置为 JSON 配置 |

当前架构的优势在于 **零依赖、可离线、单文件可读**；扩展时应保持这一特质。
