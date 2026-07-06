# 开发日志 — Tetris (抖音小游戏)

> 项目基于 Cocos Creator 3.8.8，使用 TypeScript 实现经典俄罗斯方块，目标平台为抖音小游戏。

---

## 2026-07-06 开发记录

### [08:20] 初始需求：创建俄罗斯方块游戏

**操作：** 确认 Cocos Creator 3.8.8 项目已创建，MCP 服务器运行于 localhost:3333，提供 157 个工具。

**结果：** 项目就绪，MCP 服务连通。

---

### [08:25] 编写核心游戏脚本

**开发功能：**
- 编写 `assets/NewComponent.ts`，实现完整 Tetris 逻辑：
  - 7 种标准方块（I/O/T/L/J/S/Z）定义与随机生成
  - 碰撞检测（边界 + 已锁定格）
  - 方块旋转（矩阵转置 + 反转）及 Wall Kick
  - 自动下落，每帧计时累加
  - 满行消除及计分（1行100 / 2行300 / 3行500 / 4行800）
  - 等级系统（每10行升1级，下落间隔递减：0.5 → 0.1）
  - 硬降（Space）、暂停（P）、重开（R）
  - 下一块预览
  - 游戏结束判定与提示

**结果：** 脚本包含完整游戏逻辑，共约 370 行。

---

### [08:40] 场景搭建 —— 使用 MCP 创建节点树

**操作：**
- 使用 `node_create_node` 创建 Canvas → Camera / TetrisGame 层级
- 使用 `component_attach_script` 将 NewComponent 挂载到 TetrisGame
- 使用 `scene_save_scene` 保存场景

**出现的问题：** `node_create_node` 重复调用导致 Canvas 下出现 5 个 TetrisGame 节点，且 "loading-page" 卡死。

**解决：** 删除重复节点，重新创建干净的 TetrisScene.scene，保留唯一 TetrisGame + Camera 层级。

**结果：** 场景结构正确：`Scene → Canvas → [Camera, TetrisGame]`。

---

### [08:55] Bug 修复 —— 预览黑屏

**现象：** 点击预览后页面全黑，无任何元素显示。

**排查过程：**
1. 使用 `scene_get_scene_hierarchy` 确认节点树存在
2. 发现 Canvas 自动生成的 Camera 属性为默认值：
   - position: (0, 0, 0) → 应改为 (640, 360, 1000)
   - orthoHeight: 10 → 应改为 360（设计分辨率 720 的一半）
   - clearFlags: 6 → 应改为 7
   - visibility: 41943040 → 缺少 UI 层 bit 30 (1073741824)
3. Canvas 的 `_cameraComponent` 为 null → 未关联 Camera
4. MCP 的 `component_set_component_property` 不支持 Camera 组件（报错 "Unsupported property type: undefined"）
5. `scene_save_scene` 会覆盖手动编辑的 scene 文件

**解决方案：**
- 使用 `scene_close_scene` 关闭场景
- 直接编辑 `TetrisScene.scene` JSON 文件：
  - Camera 节点 position → `{"x":640, "y":360, "z":1000}`
  - Camera 组件 orthoHeight=360, near=1, far=2000, clearFlags=7, visibility=1610612736
  - Canvas 的 `_cameraComponent` → `{"__id__": 5}`

**结果：** 预览恢复正常，UI 元素可见。

---

### [09:05] Bug 修复 —— 方块不显示 && 键盘无响应

**现象：** 游戏界面显示分数/等级/行数，黑色游戏面板可见，但内部无方块，且键盘操作无效。

**排查过程：**
1. 追踪 `spawnPiece()` 执行逻辑
2. 发现 `currentY = boardHeight - 1 = 19`，但多行方块（如 T-piece 占 2 行）的 boardY = 19+1 = 20，超出 boardHeight 边界
3. `canPlace()` 返回 false → `isGameOver = true` → 游戏直接结束，方块不绘制
4. 键盘 `input.on()` 未触发 — onLoad 抛异常或被吞

**修复：**
1. 修正生成位置：`currentY = boardHeight - 1` → `currentY = boardHeight - currentPiece.length`
2. 添加 onLoad try-catch 兜底，异常显示为红色 Label

**结果：** 方块可以正常生成并自动下落。但键盘仍无响应。

---

### [09:15] Bug 修复 —— 键盘仍无响应 && 无操控提示

**现象：** 方块自动下落正常，但按键盘无任何反应，且界面无操作提示。

**排查过程：**
1. 确认 `input.on()` 已注册
2. 尝试改为 `window.document.addEventListener('keydown')` 替代 Cocos 输入系统
3. 编译产物 (`temp/programming/...chunks/44/44bfb2ac076632a9a5bc31b501641b01eaf232d1.js`) 已验证包含最新 handler
4. 发现预览中 Canvas 元素默认无键盘焦点

**修复：**
1. 恢复使用 Cocos 标准 `input.on(Input.EventType.KEY_DOWN, callback, this)` API
2. 在 onLoad 中添加 `canvas.setAttribute('tabindex', '0')` 和 `canvas.focus()` 获取焦点
3. 新增 KeyHints Label，显示所有快捷键

**结果：** 键盘操作恢复，操控提示可见。

---

### [09:25] Bug 修复 —— 预览未加载最新代码

**现象：** 用户反馈 "bug 没修改" — 之前的修复未生效。

**排查过程：**
1. 检查 `temp/programming/packer-driver/targets/preview/chunks/44/44bfb2ac076632a9a5bc31b501641b01eaf232d1.js`
2. 确认文件内容包含 `_onDomKey`、`window.document.addEventListener`、`hintNode` 等最新代码
3. 确认 `main-record.json` 中 NewComponent 的 `mTimestamp` 已更新
4. 预览服务器缓存了旧 chunk，未加载最新编译产物

**修复：**
1. 使用 `project_refresh_assets` 触发 TypeScript 重新编译
2. 关闭场景后重新打开，确保从文件加载
3. 告知用户：浏览器 Ctrl+Shift+R 硬刷新，或在编辑器中重新点击预览

**结果：** 最新代码加载成功。

---

### [09:35] Bug 修复 —— 满行消除逻辑错误

**现象：** 方块铺满一行并消失后，底部行上移、顶部行不动，不符合标准 Tetris 行为。

**排查过程：**
1. 审查 `clearLines()` 方法
2. 消除行后使用 `splice(row, 1)` + `unshift(empty)` 处理
3. `unshift` 将新空行插入数组头部（即底部 index=0），导致所有已有行整体上移
4. 正确行为：消除行后上方行下落，空行补在顶部

**修复：** `this.board.unshift(empty)` → `this.board.push(empty)`

**结果：** 消除行后上方行正确下落，底部行位置不变，符合标准 Tetris 规则。

---

### [09:55] 发布准备 —— 打开构建面板

**操作：** 使用 `project_open_build_panel` 打开 Cocos Creator 构建面板。

**指导：** 在构建面板中选择平台 **抖音小游戏 (Douyin Mini Game)**，配置 App ID 等参数后点击 Build。

**结果：** 构建面板已打开，等待用户配置平台参数并执行构建。

---

### [10:10] 文档输出

**操作：** 根据本次开发过程编写 `CHANGELOG.md` 开发日志，按交互时间线记录每步操作、功能开发、Bug 修复及结果。

**结果：** 本文档。

---

## 项目配置总览

| 项目 | 配置 |
|---|---|
| 引擎版本 | Cocos Creator 3.8.8 |
| 设计分辨率 | 1280 × 720 |
| 适配模式 | fitWidth |
| 渲染管线 | Builtin Pipeline |
| MCP 端口 | 3333 |
| 脚本路径 | `assets/NewComponent.ts` (395 行) |
| 场景路径 | `assets/TetrisScene.scene` |

### 场景层级

```
TetrisScene (cc.Scene)
 └─ Canvas (cc.Canvas) ── _cameraComponent → Camera
     ├─ Camera (cc.Camera)         # position=(640,360,1000), orthoHeight=360
     └─ TetrisGame (cc.Node)       # 挂载 NewComponent 脚本
         ├─ Board (Graphics)       # 10×20 游戏面板
         ├─ NextPiece (Graphics)   # 下一块预览
         ├─ ScoreLabel (Label)     # 分数/行数/等级
         ├─ GameOver (Label)       # 游戏结束提示
         └─ KeyHints (Label)       # 操控提示
```

### 操控说明

| 按键 | 操作 |
|---|---|
| ← → | 左右移动 |
| ↑ | 旋转 |
| ↓ | 软降 |
| Space | 硬降 |
| P | 暂停 / 继续 |
| R | 重新开始 |

---

*文档版本: v1.0 | 最后更新: 2026-07-06*
