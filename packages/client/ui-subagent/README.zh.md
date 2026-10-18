# @deepseek-ai/dsh-client-ui-subagent

[English](README.md) | 中文

Web subagent 功能 owner：向 `conversation.session.header.lineage` 贡献当前 title 谱系导航，向会话编辑器链贡献按原因区分的只读替代呈现，并保留注册到 `ctx.inputTriggers` 的既有 `@` 引用 source。

页头谱系 renderer 通过标准 `useSessions` 钩子读取 `subagentsByParent` 与会话摘要。普通会话保留当前 title，并在存在后代时，于页头操作行之前追加 `/` 和后代数量下拉菜单。每一级 subagent 面包屑都使用数量触发器的 12px 字号，并将 title 与固定显示的双向箭头组合成一个控件；当前面包屑保留主标签颜色和 500 字重，祖先面包屑则使用三级标签颜色和 400 字重。悬停组合控件 150ms 后会打开其直接 parent 目录，ArrowDown 保留为键盘入口；点击祖先面包屑会取消待打开的菜单并仅向上导航。每个目录都可切换 sibling，并会加粗选中行；目录 label 优先于会话摘要 title，尚未加载目录的每个切换器都会自动请求该目录。只有当前 subagent 会追加自己的后代数量下拉菜单。过长的面包屑 title 会截断，而双向箭头始终保留。数量触发器会统计仅含 subagent 的完整后代谱系，在普通 fork 处停止，并在任一计入统计的后代处于 `running` 时显示活动仍在进行。紧凑树仍以直接目录为权威依据：可继续和 one-shot 行会显示 mode、`running`／`inactive` 活动状态和由日志支撑的可选 title，尾随列则在上行显示提供方的持久化 token 用量总计，在下行显示活跃轮次耗时。运行中的可继续行提供树内 Stop 操作；它只中断该 child 当前轮次，保留 child 和排队中的后续消息，并刷新目录。收到目录中 inactive 状态前，按钮会显示停止中；失败时显示行内错误。token 用量总计为四个互不重叠的 `tokenUsage` 桶之和。视觉耗时在不足一天时精确到秒，达到一天后则最多使用两个相邻单位——天／小时、近似月份／天或近似年份／月份——而悬停信息与无障碍名称会保留精确的天／小时／分钟／秒数值。耗时会累加已完成的 `subagentTiming` 轮次，仅在运行中 child 存在未结束轮次时每秒递增一次，并在 child 变为 inactive 后冻结；被中断的未结束轮次以其同一切面的 `active.through` 为上界，绝不使用更新的会话元数据。没有 label 的 one-shot 行会回退到其会话 id，而损坏、不受支持或不可用的行仍保持可读但禁用。每个健康行的 `hasChildren` 提示会在交互前决定是否显示展开控件，因此已知叶子节点从不显示箭头；每层目录仅在其中至少一个健康行是分支时才预留展开列，使完全不含分支的层级能从最前面的状态标记开始。展开分支时，会立即为每个已知直接后代预留一行禁用的加载行，随后再用该 child 的权威目录懒加载结果替换这些占位行。每个可见分支都会上报给运行时，使成员帧只在树正被消费的位置触发去抖动刷新。选择任意深度的条目都会使用该行的确切地址 `{parentSessionId, childSessionId, mode}` 调用 `SessionRuntime.openSubagent()`。组件局部状态负责树的可见性、已展开分支、键盘焦点与运行中耗时时钟。ArrowRight／ArrowLeft 展开和折叠分支；ArrowUp／ArrowDown、Home、End 与 Escape 用于导航或关闭树；关闭后焦点返回触发器。样式只使用 token。

one-shot child 始终选用只读编辑器，并将 transcript（文本记录）说明为已完成的执行记录。可继续 child 仅在其确切 parent 不可用且 child 未在运行时选用只读编辑器，并以文案说明恢复路径；此类 child 仍在运行期间，selector 会让位给普通编辑器——其输入区与 Send 操作被禁用，但独立的 Stop 保持可用，停止后只读替代恢复。确切 parent 存活时，可继续 child 保留普通输入 chrome，其会话通过 `subagent.prompt` 路由提示词：child 运行期间输入和 Send 保持可用，因为每条后续消息都会进入 child 的 FIFO inbox，而独立的 Stop 经由 `subagent.interrupt` 路由。本包绝不接收宿主上下文，也不调用面向模型的工具。目录与编辑器行为由 [Web subagent 对话 Agent Note](../../../.agents/notes/implemented/feature/2026-07-27-web-subagent-conversations.zh.md) 与[当前轮次中断 Agent Note](../../../.agents/notes/implemented/feature/2026-08-06-continuable-subagent-interrupt.zh.md) 规定。

普通侧边栏会省略带 subagent origin 的会话行，因此 parent 页头目录是它们的导航入口。普通 fork 仍保留在侧边栏中。

打开的目录顶部会汇总当前子代理谱系中运行中的后代数量，以及可获取的累计 token 用量。累计用量代表会话历史用量，不是实时吞吐；未知用量显示为不可用，而不是零。

可继续子代理行会区分“正在等待部署级模型轮次槽位”和“已获得轮次槽位”；排队行使用警示状态，并仍可直接停止。容量准入会在不同 parent 会话之间轮转，同时保持同一 parent 内的 FIFO 顺序，避免单个 parent 的任务队列长期占满新释放的槽位。

紧凑目录可展开为居中的工作区视图，提供响应式多列卡片树、子代理与活动轮次计数、排队深度和可视化容量条。嵌套卡片保留 parent-child 层级与分支操作。工作区还会汇总 root 会话及连续 subagent 后代所拥有的后台任务，普通 fork 会被排除。此处后台任务行保持只读，以遵守现有“任务状态可见、取消由模型决策”边界；可继续子代理仍保留直接停止操作。

`@` source 仍然刻意保持独立且惰性。候选是从 `ctx.sessions.list` 零 RPC 得到的运行中 child；pick 会插入字面文本 `@label `，codec 投影为 `@label`。它不参与命令裁决，也不会把 label 解析成继续执行地址。

## 模型体验

### 用户提示词中的 subagent label 文本

#### 模型看到的内容

只有旧有 `@` 引用 source 会影响模型输入：pick 的候选以字面文本 `@label` 进入普通用户消息，没有专用内容块或宿主侧解析。浏览目录、导航 child 与查看持久化 transcript 都不会添加提示词 section；已接收的继续交互内容会经宿主 subagent 适配器成为普通 FIFO 用户消息。

#### Token 影响

有条件且仅追加：字面 `@label` 或用户后续消息只会向对应的新用户消息增加 token。目录与 transcript 操作增加零模型 token。

#### KV Cache 影响

仅追加。本包绝不改写更早的请求 token。

## 已知限制与暂缓事项

- **目录没有持久化结果**：活动状态与计时无法区分完成、失败或取消，且 UI 不公开 Activation 身份。
- **`@` 引用仍是显示标题文本**：重复或改名后的 label 会有歧义，因此它们刻意不获得继续执行语义。
