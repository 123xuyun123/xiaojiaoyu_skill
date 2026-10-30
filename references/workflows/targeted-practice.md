# 学情驱动的针对性出题

2026-10-30 实机验证。

## 一句话

选若干学生 → 找薄弱作业 → 找班级得分率低的题 → 取相似题 → 入篮/组卷。

```bash
node "$SKILL_DIR/scripts/xjy.mjs" targeted \
  --class 1班 --students 张三,李四,王五 \
  --days 120 --threshold 0.7 --homeworks 4 --limit 10 \
  --out plan.json
```

加 `--add` 会把推荐题直接加入试题篮，之后用组卷流程生成试卷。

## 数据链路（全部已验证）

| 步骤 | 接口 | 说明 |
| --- | --- | --- |
| 1 | `GET /server_school/school/student/list` | 班级学生名单 |
| 2 | `GET /server_homework/homework/learning/analysis/student/list` | 每个学生的历次作业：得分、得分率、班均、班排、`homeworkId`、`templateId` |
| 3 | `GET /server_homework/homework/question/answer/classes/reviews` | 某次作业每道题的**班级平均得分**、满分、题型 |
| 4 | `POST /server_questions/questions/similar/new/batch` | 按题目 ID 取相似题（带题型、难度、知识点） |
| 5 | `POST /server_questions/questions/basket/batch` | 推荐题入篮 |

## 算法

1. **确定学生集合**：`--students` 指定姓名或 ID；不传则全班。
2. **拉学情**：逐人取 `learning/analysis/student/list`。
3. **判定薄弱作业**：满足任一条件
   - 得分率 `scoreRatio/100 < threshold`
   - 个人得分 < 班级平均分
4. **取薄弱题**：对薄弱作业调 `classes/reviews`，筛 `avgScore / maxScore < threshold`，
   得到题目 ID、班级得分率、题型。
5. **取相似题**：`similar/new/batch` 批量换题，去重、去掉原题。
6. **输出或入篮**：默认只输出方案；`--add` 才写入试题篮。

## 输出结构

```json
{
  "class": "1班",
  "students": ["张三", "李四"],
  "weakHomeworks": [
    { "homeworkId": "...", "homeworkName": "...", "students": 3, "minRatio": 0.26, "classAvg": 49.34 }
  ],
  "weakQuestions": [
    { "questionId": "...", "questionNumber": "7", "classRate": 0.038, "type": "解答", "content": "..." }
  ],
  "recommended": [
    { "id": "...", "type": "多选", "difficulty": "基础题", "content": "...", "from": "<原题ID>" }
  ],
  "addedToBasket": 10
}
```

## 与组卷衔接

```bash
# 1. 生成方案并入篮
node "$SKILL_DIR/scripts/xjy.mjs" targeted --class 1班 --students 张三,李四 --add --out plan.json

# 2. 生成试卷（见 workflows/paper-generate.md）
#    页面上：题库卷库 → 试题篮 → 生成试卷
```

## 知识点维度的补充路径

如果已有明确的知识点目标（比如“重力、摩擦力”），可以直接按知识点选题：

1. `POST /server_base/catalogNew/list` `{textBookId:"130",includeHidden:true}`
   → 教材目录树，节点上带 `labelId`（知识点标签）、`dimensionId`（112）、`value`（名称）。
2. `POST /server_questions/questions/bank/query/list/all/esDetail`
   → 请求体里的 `dimensionTagList` 填 `[{dimensionId:"112", tagId:<labelId>}]`。
3. 返回题目自带 `tagFeatureInfo`，可反向核对知识点。

> 注意：不是所有作业题都挂了知识点标签（实测部分 `tagFeature` 为空），
> 所以自动流程优先用“相似题”，知识点路径更适合人工指定范围。

## 已验证与限制

- 已验证：多学生聚合、薄弱作业识别、薄弱题识别、相似题推荐、入篮。
- 限制：`similar/new/batch` 对每道原题返回若干相似题，题量取决于平台题库覆盖；
  推荐结果按返回顺序截取，未做难度均衡（可后续按 `difficulty` 二次排序）。
- 未做：自动生成试卷。组卷是独立的三步接口，见 `workflows/paper-generate.md`。
