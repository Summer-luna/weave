# Weave

一个大纲式的双向链接笔记应用：每条笔记都是一个块，块可以无限嵌套；用 `[[页面]]`、`#标签` 链接页面，用 `((块 id))` 引用其他块，每个页面底部自动汇总反向链接。

## 技术栈

- 后端：NestJS 11 + Drizzle ORM + PostgreSQL，REST API，`@nestjs/swagger` 生成 OpenAPI
- 前端：React 19 + Vite + Tailwind v4 + TanStack Query / Router，编辑器用 CodeMirror 6
- 工程：npm workspaces（`apps/server`、`apps/web`），测试用 Vitest

## 快速开始

```bash
npm install
npm run dev
```

打开 http://localhost:5180 。API 在 http://localhost:3100/api ，文档在 http://localhost:3100/api/docs 。

### 在局域网里访问（手机、平板、其他电脑）

- **开发时**：`npm run dev` 启动后，同一网络里的设备打开 `http://本机IP:5180` 或 `http://机器名.local:5180`（终端里 Vite 会打印 Network 地址）。
- **日常使用**：`npm run serve` 会先构建，再由后端在 3100 端口同时提供网页和 API，访问 `http://本机IP:3100` 或 `http://机器名.local:3100`。
- 应用没有登录功能，同一网络里的任何人都能打开，只在信任的网络里用。
- 打不开时，先检查 Windows 防火墙是否允许 Node.js 的入站连接；IP 会随 DHCP 变化，想要固定地址可以在路由器里给这台电脑做 IP 绑定。

### 数据库

项目自带一个独立的 PostgreSQL 实例，数据放在项目根目录的 `.pgdata/`（已加入 .gitignore），不占用也不改动本机已有的 postgres 服务：

- 端口 `5436`，用户 / 密码 `weave` / `weave`，只监听 localhost。
- `npm run dev` 前会自动执行 `npm run db:start`：第一次运行会用本机 PostgreSQL 的 `initdb` 初始化，之后直接启动。
- 后端连接串在 `apps/server/.env`；数据库 `weave` 不存在时启动会自动创建，并执行 `apps/server/drizzle` 里的迁移。
- `npm run db:stop` 停止，`npm run db:status` 查看状态。端口可用环境变量 `WEAVE_PG_PORT` 改，找不到 PostgreSQL 时用 `PG_BIN` 指向它的 bin 目录。
- 不设置 `DATABASE_URL` 时会退回到内嵌的 PGlite（WASM 版 PostgreSQL），数据存在 `apps/server/data/pglite`。

## AI 助手

顶部栏的 ✨ 按钮（或 Ctrl+J）打开 AI 面板，页面标题旁的「AI 整理」会直接让 AI 给这一页加标签和双链。

- 在左侧栏「设置 → Agent」里配置模型服务，保存后立即生效，AI 面板里可以在已配置的服务之间切换：
  - **Claude**：API Key、模型（默认 `claude-opus-5-5`），走第三方中转时填 Base URL。
  - **Codex (OpenAI)**：API Key、模型（默认 `gpt-6-astra`），走 Responses API。
  - **OpenAI 兼容接口**（星诺这类中转、各家兼容接口）：Base URL（例如 `https://xxx.com/v1`）、API Key、模型都要填，走 Chat Completions。
  - 每张卡片都有「测试连接」。Key 保存在本地数据库里，页面上只显示打码后的前后几位。
  - 设置页留空的项会退回到 `apps/server/.env` 里的环境变量（见 `.env.example`），方便部署时用环境变量注入。
- 面板底部可以切换回答范围：「当前页」或「全库」。全库模式下 AI 会先用多个关键词（含同义词、中英文）检索整个笔记库，再根据检索到的笔记回答，并用 ((块引用)) 标出处。
- AI 能做界面里能做的事（共 25 个工具）：搜索页面和块、读页面（含反向链接）、查看块被哪些地方 ((引用))、按月查看日记（日历）、列出收藏；新建页面、插入 / 修改 / 移动 / 折叠块、切换待办、重命名、收藏、加标签、把未链接提及变成双链；列出和插入模板；查看回收站、从回收站恢复。每一步都会显示在面板里，改动实时出现在页面上。
- 「设置 → Agent → 权限」可以选只读、可编辑（默认，不能删除）或完全。超出权限的工具 AI 根本拿不到。
- AI 不能上传附件（可以移动、引用已有的附件块），也不能改模型和 API Key 设置。
- 删除块和页面会进回收站，执行前会在面板里请你确认；永久删除回收站里的条目或清空回收站同样要确认，而且无法撤销。
- API Key 只保存在服务端，不会发到浏览器。

## 编辑快捷键

| 按键 | 作用 |
| --- | --- |
| Enter | 在光标处拆分出新块 |
| Shift+Enter | 块内换行 |
| Tab / Shift+Tab | 缩进 / 取消缩进 |
| Backspace（行首） | 和上一个块合并 |
| ↑ / ↓（首行 / 末行） | 跳到上一个 / 下一个块 |
| Alt+Shift+↑ / ↓ | 上移 / 下移块 |
| Ctrl+Enter | 切换待办 `[ ]` → `[x]` → 普通 |
| Esc | 退出编辑 |
| Ctrl+K | 搜索 / 新建页面 |
| Ctrl+Z / Ctrl+Shift+Z | 撤销 / 重做（跨块：输入、拆分、合并、缩进、移动、删除、粘贴、模板） |
| Shift+↑ / ↓（首行 / 末行）或 Shift+点击 | 选中多个块；选中后 Tab / Shift+Tab 缩进、Alt+Shift+↑/↓ 移动、Backspace 删除、Ctrl+C / Ctrl+X 复制剪切为大纲 |
| `/` | 命令菜单：待办、今天/明天/昨天、时间、链接、块引用、标签、格式、上传文件、模板（支持拼音首字母，如 `/jt`） |
| Ctrl+\ / Ctrl+Shift+\ | 收起 / 展开左侧栏、右侧栏 |

输入 `[[`、`((`、`#` 会弹出页面或块的自动补全。

## 界面

- **日历**：左侧栏「日历」按月查看日记，有内容的日子会高亮。
- **附件**：在块里直接粘贴或拖入图片、文件，或用 `/上传`、手机工具栏的图片按钮；文件存在 `apps/server/data/uploads`，单个最大 25MB。
- **粘贴大纲**：粘贴 `- 项目` 形式的多行列表会还原成多层块。
- **模板**：标题以 `模板/` 开头的页面会出现在 `/` 菜单里，插入时复制它的全部块。
- **回收站**：删除的页面和有内容的块进入左侧栏「回收站」，可以恢复或永久删除（保留最近 500 条）。
- **AI 改动撤销**：AI 修改过笔记后，回复下方有「撤销这次改动」，会把它碰过的页面整体恢复原样，包括它从回收站恢复出来的页面（24 小时内有效，后端重启后失效；回收站里被永久删除的内容不在其中）。

- **日记流**：首页从今天往前连续显示有内容的日记，滚动到底自动加载更早的。
- **块聚焦**：点块前面的圆点，只看这个块和它的子块，顶部面包屑可以逐级返回；拖动圆点可以移动块。
- **引用跳转**：点击块引用、底部引用里的圆点或上级路径，会聚焦到对应的块；块右侧的黄色数字是被引用次数，点击后进入该块，下方列出所有引用了它的块。
- **右侧栏**：Shift+点击页面链接、标签、块引用或圆点，在右侧栏打开，可以叠多个、单独关闭，里面同样可以编辑。
- **收藏**：页面标题右边的星标，收藏的页面固定在左侧栏。

## 内容语法

`[[页面]]`、`#标签`、`#[[多词 标签]]`、`((块id))`、`**粗体**`、`__斜体__`、`^^高亮^^`、`` `代码` ``，块开头写 `[ ] ` / `[x] ` 表示待办。

## 常用脚本

| 命令 | 作用 |
| --- | --- |
| `npm run test` | 运行前后端测试 |
| `npm run typecheck` | 类型检查 |
| `npm run build` | 构建 |
| `npm run db:generate -w apps/server` | 改了 `schema.ts` 后生成迁移 |
| `npm run openapi -w apps/server && npm run api:types -w apps/web` | 改了接口后重新生成前端类型 |

## 代码结构

分层为 UI → controller → service → repository：

- `apps/server/src/*/…controller.ts` → `…service.ts` → `storage/…repository.ts`（只有 repository 读写数据库）
- `apps/web/src/components`（UI）→ `controllers`（hooks）→ `services`（大纲操作、内容解析、保存队列）→ `repositories`（API 调用）
