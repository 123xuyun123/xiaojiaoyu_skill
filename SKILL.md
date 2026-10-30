---
name: 新教育智能平台
description: 免浏览器操作新教育智能平台（www.xinjiaoyu.com）。读取教师/学生/班级/作业/学情/考试/题库/错题本/资源数据，并可通过通用接口调用执行写操作。复用本机已保存的登录态调用 /api/v3 接口。
---

# 新教育智能平台

目标：**不打开网站也能用平台功能**。所有读操作走 `/api/v3` 接口；写操作通过通用接口调用，复杂请求体「抓一次、存起来、以后直接重放」。

默认只读。提交作业、发布考试、批改、删除、上传等写操作，执行前必须向用户说明并获得确认。

> **路径约定**：`SKILL_DIR` = 本 `SKILL.md` 所在目录的绝对路径（技能加载时会给出 base directory）。
> 所有命令都用绝对路径调用，不依赖当前工作目录。

## 目录

```
<SKILL_DIR>/
├── SKILL.md
├── README.md
├── references/
│   ├── api-catalog.md      前端 bundle 扫出的全部接口（自动生成）
│   ├── api-index.json      同上，机器可读
│   ├── endpoints.md        已验证接口：方法、参数、字段、坑
│   ├── context.md          账号上下文自动解析说明
│   ├── calls/              可回放的写操作模板
│   ├── queries/            抓好的请求体模板
│   └── workflows/          多步操作流程（组卷等）
└── scripts/
    ├── xjy.mjs             主 CLI
    └── catalog.mjs         重新生成接口目录
```

## 第一次使用：登录态

```bash
node "$SKILL_DIR/scripts/xjy.mjs" auth status
```

没登录或返回 `code: 401` / `444` 时：

1. `browser.tabs.open` 打开 `https://www.xinjiaoyu.com/auth/login`，让用户**自己**登录（扫码 / 账号 / 短信）。绝不代填密码。
2. 登录后在该页执行并取回 `user` 对象：

   ```js
   JSON.stringify(JSON.parse(localStorage.getItem("jbyweb")).user, null, 2)
   ```

3. 存成临时文件后导入：

   ```bash
   node "$SKILL_DIR/scripts/xjy.mjs" auth save "%TEMP%\xjy-auth.json"
   ```

登录态保存在 `~/.config/opencode/xinjiaoyu/auth.json`，不进仓库。
token 里带 `exp`，`auth status` 会显示过期时间。

## 账号上下文：自动解析，不写死

```bash
node "$SKILL_DIR/scripts/xjy.mjs" ctx --refresh
```

从 token 和 `/server_system/member/user/{id}` 自动解析出 userId、teacherId、schoolId、
学段、年级、学科、学年、班级列表、学科列表，缓存 6 小时。**不要在 skill 里硬编码账号 ID**；
换账号、换学校只需要重新登录 + `ctx --refresh`。

## 核心命令

```bash
X="$SKILL_DIR/scripts/xjy.mjs"

node $X classes                                  # 我教的班
node $X courses                                  # 我的学科
node $X homework --class 1班 --days 60          # 班级作业：提交/未交/均分/批阅进度
node $X students --class 1班                    # 班级学生名单
node $X report --student 张三 --class 1班     # 学生历次成绩、班排、均分
node $X exams --days 60                          # 考试列表
node $X questions --search 重力 --size 20        # 题库检索
node $X ls mistake                               # 搜接口目录
```

所有命令都支持 `--out 文件`，大结果优先落盘再处理。
班级、学生、学科都支持**名称或 ID**，例如 `--class 1班`、`--student <学生ID>`。

## 场景配方

**看某班作业完成情况**

```bash
node $X homework --class 16班 --days 30 --out hw.json
```

字段：`submitNumber`（已交）、`missingNumber`（未交）、`totalNumber`（应交）、
`avgScore`、`reviewProgress`（批阅进度）。

**看某个学生学情**

```bash
node $X report --student <姓名> --class <班级> --days 120 --out report.json
```

字段：`score`、`classRank`、`averageScore`、`gradeAverage`、`homeworkName`、`submitTime`。
需要更细的逐题数据时，用 `answerSheetId` 继续调答题卡相关接口（见 `endpoints.md`）。

**题库检索 / 组卷取材**

```bash
node $X questions --search 摩擦力 --size 20 --out q.json
```

`--template` 可换章节筛选模板，`--templates` 列出已有模板。注意：`dimensionTagList` 必填，缺了不报错但结果恒为 0；
`search` 只在该模板的筛选范围内过滤。要换教材/章节，按下面「抓请求体」抓一份新模板。

> 默认模板是物理·高中·必修一的第三章，属于**示例**。其他学科/教材需要自己抓一份。

**角色差异**

`ctx` 假设当前是教师账号（用 `teacherId` 拉班级和作业）。学生/家长角色没有教师班级，
`classes`、`homework` 这类聚合命令会为空，直接用 `api` 调对应接口即可，接口清单见 `endpoints.md`。

**考试列表 / 成绩分析**

```bash
node $X exams --days 90 --size 20 --out exams.json
```

拿到 `examId` 后，成绩分析类接口在 `endpoints.md` 的「考试」一节。

**错题本**

```bash
node $X api GET /api/v3/server_error_book/teacher/mistake/new/page \
  --query classIdList=<classId> --query courseId=<courseId> \
  --query gradeId=<gradeId> --query schoolYearName=<学年> \
  --query startDate=2026-04-30 --query endDate=2026-10-30 \
  --query current=1 --query size=20 --query isHistory=false \
  --query homeworkTemplateIds=<模板ID>
```

## 全量接口目录

前端 bundle 里扫出约 1700 个接口路径：

```bash
node $X ls                 # 全部
node $X ls homework        # 按关键词过滤
node "$SKILL_DIR/scripts/catalog.mjs"   # 站点发版后重新生成
```

调用任意接口：

```bash
node $X api GET  /api/v3/... --query k=v --out out.json
node $X api POST /api/v3/... --data "@body.json" --raw
```

- `--data` 传 `@文件` 最稳，PowerShell 会吃掉命令行里的 JSON 引号。
- `--raw` 输出完整信封 `{code,msg,data}`。
- 方法不确定时先看 `api-index.json` 里的 `method`；仍是 `?` 就先用 GET/POST 各试一次。

### 上传文件

```bash
node $X api POST <上传地址> --form file=@D:\path\a.png --form module=question/image
```

站点上传走 multipart，字段通常是 `file` + `module`。上传地址由服务端下发
（页面里的 `uploadUrl`），先用抓包确认一次；鉴权头与普通接口相同，CLI 会自动带上。

## 写操作：已固化的模板

```bash
node $X calls                       # 列出模板
node $X call question-basket-add --body "@qids.json" --dry   # 先看会发什么
node $X call question-basket-add --body "@qids.json"
node $X call question-basket-remove --body "@qids.json"
```

模板在 `references/calls/`，格式：`method`、`path`、`query`、`body`、`notes`。
`--set a.b=值` 改字段，`--set-query k=v` 加查询参数，`--set-path id=值` 替换路径占位符，
`--body @文件` 整体替换请求体（数组类 body 用这个），`--dry` 只打印不发送。

**已验证可用**

| 模板 | 作用 | 说明 |
| --- | --- | --- |
| `question-basket-add` | 题目批量加入试题篮 | `questionIds/typeIds/typeNames/questionNumbers` 四个数组必须等长对应 |
| `question-basket-remove` | 从试题篮移除 | body 是纯 ID 数组，用 `--body @文件` |
| `homework-grade-question` | 保存单题批改得分 | 用原分数重放验证过；`questionAnswerId` 来自批阅页 |

**已确认形状、尚未做成模板**（见 `endpoints.md` 的「写操作」）：

- 组卷生成：`references/workflows/paper-generate.md`（3 个请求，已实测）
- 发布考试：`PUT /exam/course/relation/{examId}/publish/{?}`（路径变量待确认，勿盲调）

这些操作涉及真实数据变更，第一次执行前按上面的抓包流程确认一次请求体，再存成
`references/calls/<名称>.json`，之后就是一条 `call` 命令。

## 抓请求体（写操作 / 复杂查询）

`browser.network.get` 常常拿不到 POST body，用页面钩子抓一次：

```js
window.__cap = [];
const oo = XMLHttpRequest.prototype.open;
const os = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open = function (m, u) { this.__u = u; return oo.apply(this, arguments); };
XMLHttpRequest.prototype.send = function (b) {
  if (typeof b === "string" && String(this.__u || "").includes("/api/v3/")) {
    window.__cap.push({ url: this.__u, body: b });
  }
  return os.apply(this, arguments);
};
```

在页面上完成一次目标操作，然后 `window.__cap.pop()` 取请求体和 URL，存到
`references/queries/<用途>.json`，之后用 `xjy.mjs api` 重放，**不再需要浏览器**。

写操作同理：抓到的 body 里把 ID、时间、分数换成参数即可复用。

## 排错

| 现象 | 处理 |
| --- | --- |
| `code: 444 异常请求` | 签名/会话失效，重抓登录态 |
| `code: 401` | token 过期，重抓登录态 |
| `code: 400 参数[...] is not present` | 缺参数，按 `endpoints.md` 或抓包补齐 |
| 结果为空但页面有数据 | 筛选条件不全（如 `dimensionTagList`），抓页面真实请求体 |
| 返回 HTML | 路径错，`ls` 搜一下 |
| 中文乱码 | PowerShell 管道编码问题，加 `--out 文件` 再读文件 |

## 安全边界

- 只访问当前账号本来就有权限的数据，不越权、不遍历他人 ID。
- 写操作先确认；批量导出、群发类动作同样先确认。
- 学生个人信息只输出用户要求的范围。
- token 不打印、不提交、不外传。
