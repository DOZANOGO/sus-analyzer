# SUS 谱面分析器

一个纯前端的 **PJSK 风格 SUS 谱面分析工具**：解析 Ched 格式的 SUS 谱面文件，精确计算官方 note 数/FC combo，并可视化密度、难点段、双押与滑键结构。

双击 `index.html` 即可使用，无需安装任何依赖，无需服务器。

## 功能特性

- **官方 note 数精确计算**：完整复刻 PJSK 官方 note 数/FC combo 口径（谱面交叉验证 100% 命中）
- **密度曲线**：5 秒滑窗密度可视化，支持缩放与拖动
- **难点段识别**：基于均值+标准差自动标注高密度区间
- **双押统计**：双押次数、最大同时按键数、最密双押段
- **滑键链统计**：按时间就近匹配的滑键链成链（跨轨道正确），最长链/持续时间
- **7 类 note 分类**：Tap / Critical Tap / Flick / Slide Start / Slide Tick / Slide End / Trace
- **官方数字校准**：手动输入官方数字时自动计算偏移，按谱面内容 hash 缓存（localStorage）
- **支持难度全覆盖**：EXPERT / MASTER / APPEND（含 trace note 体系与 type7/8 端点移除设计）

## 快速开始

```bash
# 方式一：直接打开
双击 index.html

# 方式二：本地服务器（可选）
python -m http.server 8000
# 访问 http://localhost:8000
```

上传 `.sus` 文件（或粘贴文本），点击「分析」即可。拖拽上传同样支持。

## 官方 note 数算法

PJSK 游戏内只显示 FC combo（= 官方 note 数），不显示 note 总数。本工具从开源引擎 [sekai-mmw-preview-web](https://github.com/watagashi-uni/sekai-mmw-preview-web)（MikuMikuWorld 引擎 Web 移植）的 combo 事件生成逻辑中提炼出完整规则：

1. **Tap**（channel 1）：排除 type 7/8、lane∉[2,13]、被滑键占用（同 tick+lane）的 note，其余每个 +1
2. **Slide**（channel 3，按 header[5] 分组合并后按 type 2 切分）：起点/终点/tick 每个 +1，type 5（Hidden 中继）不计
3. **Guide**（channel 9）：全部不计（引导线无判定）
4. **HalfBeat**：每条非 guide 滑键从（起点 tick+240 向下对齐 240）到（终点 tick 向上对齐 240），每 240 tick +1
5. **type 7/8（slideStartEndRemove）**：被标记的 slide 端点视为 Hidden，不计入（APPEND 多指谱大量使用）

### 验证结果

| 谱面 | 难度 | 解析结果 | 官方 |
|------|------|---------|------|
| Override | EXPERT | 1004 | 1004 ✓ |
| 失敗作少女 | EXPERT | 805 | 805 ✓ |
| 劣等上等 | EXPERT | 825 | 825 ✓ |
| APPEND 多指谱 | APPEND | 939 | 939 ✓ |

## 技术架构

纯前端、零依赖，按 `utils → hooks → components` 分层：

```
index.html
js/
├── utils/       # 纯函数与数据（SUS 解析、统计）
├── hooks/       # 状态管理与业务编排
├── components/  # UI 组件（图表、统计卡片、校准界面）
└── main.js      # 入口装配
```

SUS 解析采用两阶段架构（对齐官方引擎 analyze.ts + convert.ts）：

- **阶段 1 analyze**：原始 SUS → tick 制 Score（channel 分流 + 分段累积 tick + BPM 变化收集）
- **阶段 2 convert**：Score → 统一 note 列表（毫秒制 + 7 类分类 + 判定标记）

支持变拍子（`#mmm02`）、BPM change（`#mmm08`）、速度变化（`#TIL`）。

## 支持的谱面格式

- Ched（Chunithm Editor）导出的标准 SUS 格式（hex 小节号 + channel + lane，数据每 2 字符一个 note 槽）
- 仅支持真实 SUS（不支持早期简化变体格式）

## License

[MIT](LICENSE)
