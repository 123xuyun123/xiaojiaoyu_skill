# 组卷（生成试卷）完整流程

2026-10-30 实机抓取并验证，测试数据已清理。

## 流程概览

```
选题 → 加入试题篮 → 生成试卷（3 个请求）→ 保存/移动 → （可选）转作业
                                          ↓
                                    删除测试卷
```

## 1. 题目入篮

```bash
node "$SKILL_DIR/scripts/xjy.mjs" call question-basket-add --body "@qids.json"
```

`references/calls/question-basket-add.json` 是模板，`${userId}` 等占位符由 CLI 自动替换。
`questionIds / typeIds / typeNames / questionNumbers` 四个数组必须等长对应。

## 2. 生成试卷

页面点「生成试卷 → 生 成」时，依次发出 3 个请求（已实测）：

### 2.1 生成 Word 文件

```
POST /api/v3/server_questions/constitute/paper/office
```

请求体关键字段：

| 字段 | 说明 |
| --- | --- |
| `userId` / `userName` / `userAccount` | 当前账号（`ctx` 可提供 userId，其余从登录态取） |
| `phaseId` / `phaseName` / `courseId` / `courseName` / `schoolId` | 学段、学科、学校 |
| `paperName` | 试卷名称 |
| `catalogId` | 我的卷库目录 ID（页面加载时由 `GET /constitute/paper/catalog/list` 返回） |
| `questionInfo[]` | `{ questionId, maxScore, questionTypeName }` |
| `produceFileParam` | 版式配置：`fileName`、`phaseId`、`courseId`、`fileConfigList[]`、`elementList[]` |

`fileConfigList` 是页眉/页脚/注意事项等富文本块（绝密☆启用前、姓名班级考号、总分表等），
`elementList` 是按题型分组的题目元素。**这两块内容很长，且和题目强绑定**，
实际复用时直接沿用一次真实请求的 body，替换 `paperName` 与 `questionInfo` 即可。

### 2.2 保存试卷记录

```
PUT /api/v3/server_questions/constitute/paper
```

| 字段 | 说明 |
| --- | --- |
| `paperName` | 试卷名称 |
| `catalogId` | 目录 ID |
| `paperInfo` | **JSON 字符串**：`{ sealLine, mainTitle, bigQuestions:[{ name, questionIds[], scores[] }] }` |
| `scoreInfo` | **JSON 字符串**：完整的题目快照（题干、答案、解析、选项） |
| `courseId` / `phaseId` | 学段学科 |

注意：`paperInfo` 和 `scoreInfo` 是字符串化的 JSON，不是对象，容易被转义坑到。

### 2.3 标记生成完成

```
POST /api/v3/server_questions/constitute/paper/operation
{ "createBy": "<userId>", "operation": 1, "constitutePaperId": "<paperId>" }
```

返回的 `constitutePaperId` 就是试卷 ID（实测 `2122475`）。

### 2.4 自动移出试题篮

页面上「生成后移出」默认勾选，前端会额外发：

```
DELETE /api/v3/server_questions/questions/basket
["questionId1", ...]
```

## 3. 生成后的常用操作

| 操作 | 接口 |
| --- | --- |
| 试卷详情 | `GET /api/v3/server_questions/constitute/paper/detail/{paperId}` |
| 我的卷库分页 | `POST /api/v3/server_questions/constitute/paper/list/page`（**必须带 `catalogId`**） |
| 下载 | `GET /api/v3/server_questions/constitute/paper/download/{paperId}` |
| 删除 | `DELETE /api/v3/server_questions/constitute/paper/{paperId}` |
| 转作业 | `POST /api/v3/server_questions/constitute/paper/modifyHomework` |

## 下载（已实测）

生成后的试卷会打开编辑器 `/officeWord?type=paper&paperId=...&fileId=...`，
点「下载」弹出选项，再点确定触发两个请求：

1. `POST /api/v3/server_node_sheet_new/office/download`
   提交整份文档模型（`templateInfo`：fileInfo、elementList、样式、页眉页脚）和下载选项。
2. `POST /api/v3/server_questions/constitute/paper/downloadFile`
   取生成结果。刚提交时可能返回 `423` 或 `code:500`（还在生成），稍等重试。

下载选项：

| 选项 | 取值 |
| --- | --- |
| 文档格式 | `pdf` / `word` |
| 纸张大小 | `A4` / `A3(双栏)` / `B5` |
| 版本 | 学生版1（无答案）、学生版2（答案在卷尾）、教师版（答案跟随）、答案版1（答案+解析）、答案版2（仅答案）、答题卡 |
| 显示设置 | 题目来源、题目分数 |

另外：

- `PATCH /api/v3/server_questions/constitute/paper/download/{paperId}` 是**下载计数**，不是取文件。
- 试卷详情的 `paperUrl` / `officeFileInfoVO` 在文件生成后才有值，可以直接当下载地址用。

## 暂存

编辑器界面（`/officeWord`、`/HomeworkPaperSheet`）里**没有独立的「暂存」按钮**：
试卷记录在生成时就已入库（`PUT /constitute/paper`，`paperStatus = 0`），
编辑内容通过下载/保存动作落库。

如果你指的是别的位置（例如答题卡编辑器的保存、或卷库里的草稿状态），
需要在该页面抓一次请求才能确认。

## 验证与清理记录

- 测试卷名称：`skill-test-20261030`，paperId `2122475`
- 生成后通过 `DELETE /constitute/paper/2122475` 删除，`detail` 返回「试卷已无效」
- 试题篮自动清空为 0，无残留

## 附：制作作业答题卡（同一套接口）

页面上的「制作作业答题卡」走的是**同一组三个接口**，区别只在版式参数：

```
POST /api/v3/server_questions/constitute/paper/office   # produceFileParam.elementList 换成答题卡版式
PUT  /api/v3/server_questions/constitute/paper          # 同样保存为 constitute/paper 记录
POST /api/v3/server_questions/constitute/paper/operation
```

- 生成的答题卡也是 `constitute/paper` 记录，可以用
  `GET /constitute/paper/detail/{id}` 查询、`DELETE /constitute/paper/{id}` 删除。
- 创建完成后前端会新开一个标签页：
  `/teacher/HomeworkPaperSheet/{paperId}?fileId=...&courseId=...&phaseId=...`
  这是答题卡编辑器，不是独立的创建接口。
- 实测创建了两份（`2122507`、`2122511`），均已删除并确认失效。

> 结论：组卷和答题卡共用一套「生成文件 → 保存记录 → 提交」管线，
> 差别只在 `produceFileParam` / `paperInfo` 的版式配置。复用真实请求体、替换
> `paperName` 和题目数组即可。
