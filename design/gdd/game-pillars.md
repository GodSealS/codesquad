# Game Pillars: 冒险者的工坊（暂定名）

## Document Status

- **Version**: 1.0
- **Last Updated**: 2026-07-03
- **Approved By**: 待 creative-director 审核
- **Status**: Draft

---

## What Are Game Pillars？

Pillars are the 3-5 non-negotiable principles that define this game's identity.
Every design, art, audio, narrative, and technical decision must serve at least
one pillar. If a feature doesn't serve a pillar, it doesn't belong in the game.

### What Makes a Good Pillar

- **Falsifiable**: A pillar must be testable — a real design decision could fail it.
- **Constraining**: If a pillar never forces you to say no, it's too vague.
- **Cross-departmental**: A pillar that only constrains one discipline is incomplete.
- **Memorable**: The team should be able to recite pillars from memory.

---

## Core Fantasy

> **你是一个走过无数战场的传奇冒险者。如今你退居幕后，成为一名试炼师——你用自己亲身经历过的战斗和考验，为新一代冒险者打造挑战。你不是英雄了，你是制造英雄的人。**

---

## Target MDA Aesthetics

| Rank | Aesthetic | How Our Game Delivers It |
|:----:|-----------|--------------------------|
| 1 | **Expression** | UGC 编辑器是核心玩法——每个地牢都是作者个性的延伸 |
| 2 | **Challenge** | 玩家创作的地牢天然需要技巧和策略才能通关 |
| 3 | **Discovery** | 每一次冒险都是全新内容——从布局到怪物配置都是新谜题 |
| 4 | **Fantasy** | "退隐冒险者化身试炼师"的角色弧线 |
| 5 | **Fellowship** | 异步社交——发布作品、挑战好友、评分反馈 |
| 6 | **Sensation** | 战斗手感、视觉反馈、特效 |
| 7 | **Narrative** | 故事是战斗的"佐料"不是主菜 |
| N/A | **Submission** | 本作不主打放松体验 |

---

## The Pillars

### Pillar 1：创造即游戏

**One-Sentence Definition**：UGC 不是额外模式，也不是 Mod 工具——创作系统本身就是游戏的核心玩法。设计地牢、编排怪物、引导节奏和使用这些内容探索冒险一样有趣。

**Target Aesthetics Served**：Expression（1）、Challenge（2）

**Design Test**：如果我们在争论"要不要做一个编辑器的教程"，这个支柱说——**编辑器本身就是游戏，它不应该需要独立的教程**。WYSIWYG、直觉式交互、从第一分钟就让人想动手。

#### What This Means for Each Department

| Department | This Pillar Says... |
|:-----------|:--------------------|
| **Game Design** | 编辑器必须像核心游戏一样经过打磨——它的 UX、反馈、成就感需要和战斗系统同等级别 |
| **Art** | 编辑器的 UI 风格应该和游戏世界一致——不是在"使用工具"，而是"在营地桌上布置地图" |
| **Audio** | 放置怪物/道具时有满足感的音效反馈——编辑也是一种表演 |
| **Narrative** | "创作"本身就是角色弧线的一部分——从冒险者到试炼师的转变 |
| **Engineering** | EditorPlugin 的开发优先级和战斗系统一致——编辑器不是"额外功能" |

#### Serving This Pillar
- ✅ 编辑器默认全屏、沉浸式、快捷键友好
- ✅ 放置物品时有晃动/粒子/音效反馈（像在世界里放东西，而不是在菜单里点按钮）
- ✅ 编辑器中的一切改动即时反映在关卡预览中

#### Violating This Pillar
- ❌ 编辑器作为隐藏菜单中的辅助工具
- ❌ 需要阅读说明书或看教程视频才能使用
- ❌ 编辑保存后才能在游戏中看到效果（必须是 WYSIWYG）

---

### Pillar 2：每一次冒险都不同

**One-Sentence Definition**：游戏没有固定关卡、没有预制剧情线——所有 PvE 内容都是玩家生成的。每一场冒险都是别人创造的全新体验。如果一个系统可以用固定内容替换而不损失体验，它就不符合本作定位。

**Target Aesthetics Served**：Discovery（3）、Challenge（2）

**Design Test**：如果我们在争论"要不要做一个官方的剧情战役"，这个支柱说——**不做**。所有时间都应该花在打磨编辑器、发布系统和社交反馈上，而不是制作固定内容。

#### What This Means for Each Department

| Department | This Pillar Says... |
|:-----------|:--------------------|
| **Game Design** | 不能做固定的"副本/关卡"——唯一的固定内容是"大厅"和教学关 |
| **Art** | 房间模板必须通用且可组合——不能让某个模板过度风格化而破坏内容的多样性 |
| **Audio** | 音乐/音景需要适应性地响应不同的玩家创作内容 |
| **Narrative** | 没有主线剧情，叙事靠玩家自己建立——名字、风格、设计哲学 |
| **Engineering** | 地牢加载/卸载必须高效——玩家会频繁切换不同人创作的内容 |

#### Serving This Pillar
- ✅ 大厅只显示 UGC 发布列表——没有"开始冒险"按钮直接进入固定关卡
- ✅ 新玩家进入游戏后第一个选择是"浏览最新发布的地牢"
- ✅ 同一个房间模板可以被不同作者用在完全不同的语境中

#### Violating This Pillar
- ❌ 官方制作的任何可游玩关卡（教学关除外——教学关是静态的且完成后消失）
- ❌ "推荐"或"置顶"系统偏袒特定作品（社区热度决定一切）
- ❌ 给某些作者特权性的编辑组件（所有人应有同样的创作起点）

---

### Pillar 3：有限的工具，无限的可能

**One-Sentence Definition**：我们提供有限数量的模板化组件（房间类型、怪物种类、道具、机关），但组件之间的组合方式能产生无法穷尽的多样性。不做自由沙盒——不做自由建模、脚本编程或物理沙盒。

**Target Aesthetics Served**：Expression（1）、Discovery（3）

**Design Test**：如果我们在争论"要不要给玩家自定义怪物模型的能力"，这个支柱说——**不**。自由建模是沙盒游戏做的事。模板化组件的核心思路是：在有限的组件数量下，通过组合逻辑产生指数级的可能性。

#### What This Means for Each Department

| Department | This Pillar Says... |
|:-----------|:--------------------|
| **Game Design** | 每个新增组件都要经过严格的"组合多样性"测试——它必须和已有组件产生至少 3 种有意义的交互 |
| **Art** | 每个组件需要和所有其他组件在视觉上兼容——颜色系统、比例、风格的一致性 |
| **Audio** | 怪物/机关的音效应在组件层面定义，而不是预设场景层面 |
| **Narrative** | 组件不应携带固定叙事——同一种怪物在不同地牢中可以有不同的"故事含义" |
| **Engineering** | 编辑器必须强制组件对齐/吸附规则——保持模块化是工程核心 |

#### Serving This Pillar
- ✅ 一个"火焰喷射器机关"既可以是 Boss 战的致命威胁，也可以是解谜关卡的"你必须跑过去"的挑战
- ✅ 同一个 Boss 模型可以在不同作者的关卡中出现在完全不同的房间布局和战术情境中
- ✅ 新组件发布时附上"已有的组合示例"来激发创作灵感

#### Violating This Pillar
- ❌ 允许导入自定义模型/贴图/音效
- ❌ 允许写自定义脚本/行为逻辑
- ❌ 提供"空房间+自由放置任意物体"的模式（必须是模板化房间）

---

### Pillar 4：故事在我手中

**One-Sentence Definition**：每一场地洞都在讲述一个故事——玩家既是编剧也是读者。即便没有过场动画和对话树，一个地洞的布局、怪物配置、道具放置和节奏本身就构成了一段叙事。如果一个地洞可以被拆解放置策略而无视其上下文，它的设计就不合格。

**Target Aesthetics Served**：Fantasy（4）、Discovery（3）、Narrative（7）

**Design Test**：如果我们在争论"要不要在编辑器里加一个文本对话功能"，这个支柱说——**先不加**。地洞的叙事应该通过空间设计（敌人的摆位、房间的连接顺序、资源的稀缺程度）来传达，而不是靠文字。当玩家做完一个地洞后能说"我大概能猜到作者想表达什么"，就是成功。

#### What This Means for Each Department

| Department | This Pillar Says... |
|:-----------|:--------------------|
| **Game Design** | 地洞的房间顺序、敌人密度、资源分布本身就是在"讲故事" |
| **Art** | 房间的视觉氛围（亮/暗、干净/破败）传递情感信息 |
| **Audio** | BGM 可以作为"叙事提示"——紧张的区域音乐不同 |
| **Narrative** | 不做剧情编辑器——除非未来 Pillar 升级，MVP 不做文字叙事 |
| **Engineering** | 编辑器应能记录作者对房间的"意图标签"（轻松/紧张/埋伏/Boss前） |

#### Serving This Pillar
- ✅ 一个"在 Boss 房前塞满强力恢复道具"的地牢，讲述的是"作者想让你在 Boss 战前感到希望和准备充分"
- ✅ 一个"在转角放一个埋伏型怪物"的地牢，讲述的是"作者在测试你的警觉性"
- ✅ 编辑器提供"节奏区间"标记，让作者可以标注"这里是我设计的情绪低点/高点"

#### Violating This Pillar
- ❌ 地洞只是随机生成的怪物堆砌，没有任何节奏设计
- ❌ 玩家打完一个地洞后对这个"世界"没有任何印象
- ❌ 编辑器没有给作者表达情绪的工具（只有敌人类型和数量）

---

## Anti-Pillars（What This Game Is NOT）

Anti-pillars are equally important as pillars — they prevent scope creep and
keep the vision focused. Every "no" protects the "yes."

### Anti-Pillar 1：不是叙事驱动型游戏

**为什么排除**：如果游戏试图讲一个宏大故事，就需要大量的固定内容（过场、对话、脚本事件）。这会和 Pillar 2（每一次冒险都不同）产生根本冲突——每条官方故事线都是"不再变化的固定内容"。叙事如果扩展到主导地位，UGC 就变成了"副模式"，这是本作不能承受的。

**这会牺牲**：单人沉浸式故事情节、情感叙事、可预测的剧情节奏
**这会保护**：Pillar 2（每一次冒险都不同）

### Anti-Pillar 2：不是付费赢/数值深坑

**为什么排除**：作为 UGC 驱动的游戏，核心信任在于"所有玩家拥有同等的创作起点"。如果高级编辑组件有数值优势（比如"付费怪物的攻击力是免费的两倍"），公平性就被破坏了。

**这会牺牲**：高 ARPU（平均每用户收入）、短期变现能力
**这会保护**：Pillar 3（有限的工具，无限的可能）——所有玩家共享同一套组件，创造力才是区分因素

**允许的变现方案**：
- ✅ 装饰性组件（自定义 Boss 的外观、房间墙纸、特效包）
- ✅ 编辑功能扩容（更多保存槽位、更多同时发布数）
- ✅ 怪物模板扩展包（新怪物类型——但所有怪物必须保持同价位性能基准，不卖数值）
- ❌ 付费解锁更强属性
- ❌ 付费解锁更高效编辑功能（如批量操作——必须所有人能用）

---

## Appendix：Pillar Cross-Reference Matrix

| Pillar | Core Fantasy | Expression | Challenge | Discovery | Fellowship |
|:------:|:------------:|:----------:|:---------:|:---------:|:----------:|
| **创造即游戏** | ✅ "你从冒险者变成试炼师" | ✅ 编辑器是表达工具 | ✅ 好的创作本身就是挑战 | ✅ 探索组件组合 | ❌ 间接（分享创作） |
| **每一次冒险都不同** | ✅ "每一天都有新内容" | ✅ 每个作品都是独特表达 | ✅ 面对未知挑战 | ✅ 永远有新东西 | ✅ 来自不同作者的视角 |
| **有限的工具，无限的可能** | ✅ "平凡组件创造非凡" | ✅ 在有边界的自由中表达 | ✅ 在限制中发挥创造力 | ✅ 发现意想不到的组合 | ✅ 分享组合技巧 |
| **故事在我手中** | ✅ "设计叙事" | ✅ 通过环境讲述故事 | ✅ 读懂作者的意图 | ✅ 发现隐藏的信号 | ✅ "你懂我"的共鸣 |

## Appendix：Pillar Decision Log

| Date | Decision | Pillar(s) That Decided It |
|:----:|----------|:-------------------------:|
| 2026-07-03 | MVP 不做剧情编辑器 | Pillar 4（故事在我手中） |
| 2026-07-03 | 所有玩家共享相同编辑组件 | Anti-Pillar 2（不是付费赢） |
| 2026-07-03 | 无官方固定关卡（教学关除外） | Pillar 2（每一次冒险都不同） |
| 2026-07-03 | UGC 编辑器不能被"解锁"——所有人满级可用 | Pillar 1（创造即游戏） |
