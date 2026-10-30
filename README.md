# 新教育智能平台 Skill

给 AI 编程助手（OpenCode / Claude Code 等支持 `SKILL.md` 的 agent）使用的技能包：
**不打开网站，直接读写新教育智能平台（www.xinjiaoyu.com）的数据与功能。**

通过复用本机已保存的登录态调用站点 `/api/v3` 接口，覆盖班级、学生、作业、学情、考试、题库、错题本、资源等模块。

> 仅供账号本人使用自己有权访问的数据。请遵守平台服务条款。

## 特性

- **免浏览器**：登录一次，之后全部走接口
- **账号无关**：不硬编码任何 ID，运行时从登录 token 自动解析学校、教师、班级、学科
- **全量接口目录**：从线上前端 bundle 扫描出约 1700 个接口路径，可随时重新生成
- **写操作可回放**：抓一次请求体，存成模板，之后一条命令重放
- **零依赖**：只需要 Node.js 18+，不需要安装任何 npm 包

## 安装

把本仓库放到技能目录，**目录名就是技能 ID**。

全局安装（所有项目可用）：

```bash
git clone https://github.com/123xuyun123/xiaojiaoyu_skill.git \
  ~/.config/opencode/skills/xiaojiaoyu_skill
```

项目内安装：

```bash
git clone https://github.com/123xuyun123/xiaojiaoyu_skill.git \
  .opencode/skills/xiaojiaoyu_skill
```

Windows 下也可以用目录联接：

```powershell
New-Item -ItemType Junction -Path ".opencode\skills\xiaojiaoyu_skill" -Target "<仓库绝对路径>"
```

## 首次配置：登录态

平台需要登录。技能不会代填账号密码，流程是「你自己登录 → 抓一次 token」。

1. 打开 `https://www.xinjiaoyu.com/auth/login`，自行完成登录
2. 登录后在该页控制台执行：

   ```js
   JSON.stringify(JSON.parse(localStorage.getItem("jbyweb")).user, null, 2)
   ```

3. 把输出存成临时文件，导入：

   ```bash
   node "<SKILL_DIR>/scripts/xjy.mjs" auth save ./auth.json
   ```

登录态保存在 `~/.config/opencode/xinjiaoyu/auth.json`，**不会**写进仓库。
token 里带过期时间，`auth status` 会显示。

> 让 AI 来做时，只需说：`@xiaojiaoyu_skill 帮我配置登录态`，它会引导你完成。

## 快速开始

```bash
S="<SKILL_DIR>/scripts/xjy.mjs"

node "$S" ctx                    # 解析账号上下文（学校/教师/班级/学科/学年）
node "$S" classes                # 我教的班
node "$S" homework --class 1班 --days 60
node "$S" students --class 1班
node "$S" report --student 张三 --class 1班
node "$S" exams --days 60
node "$S" questions --search 重力 --size 20
```

所有命令都支持 `--out 文件`；班级、学生、学科支持名称或 ID。

## 接口目录

```bash
node "$S" ls                 # 全部接口
node "$S" ls homework        # 关键词过滤
node "<SKILL_DIR>/scripts/catalog.mjs"   # 站点发版后重新生成
```

目录是**机器扫描**结果，不代表都验证过。已验证、带参数说明的接口见
`references/endpoints.md`。

调用任意接口：

```bash
node "$S" api GET  /api/v3/... --query k=v --out out.json
node "$S" api POST /api/v3/... --data "@body.json" --raw
node "$S" api POST /api/v3/... --form file=@a.png --form module=question/image
```

## 写操作模板

```bash
node "$S" calls                       # 列出模板
node "$S" call question-basket-add --dry
node "$S" call homework-grade-question --set questionAnswerList.0.questionAnswerId=xxx
```

模板在 `references/calls/`，字段：`method`、`path`、`query`、`body`、`notes`。
支持 `${userId}`、`${teacherId}`、`${schoolId}` 等占位符，由 CLI 从账号上下文自动替换。

已验证：

| 模板 | 作用 |
| --- | --- |
| `question-basket-add` | 题目加入试题篮 |
| `question-basket-remove` | 从试题篮移除 |
| `homework-grade-question` | 保存单题批改得分 |

新增模板：在页面上操作一次，用 SKILL.md 里的 XHR 钩子抓 `method + path + body`，
存成 JSON 即可离线重放。

## 安全

- 登录态只存本机 `~/.config/opencode/xinjiaoyu/`，仓库里没有任何凭据
- 默认只读；写操作执行前会要求确认
- 只访问当前账号本来就有权限的数据
- 学生个人信息按需输出，不做额外汇总

## 目录结构

```
.
├── SKILL.md
├── README.md
├── LICENSE
├── references/
│   ├── api-catalog.md
│   ├── api-index.json
│   ├── endpoints.md
│   ├── context.md
│   ├── calls/
│   ├── queries/
│   └── workflows/
└── scripts/
    ├── xjy.mjs
    └── catalog.mjs
```

## License

MIT
