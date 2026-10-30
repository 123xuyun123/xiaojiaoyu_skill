# 已验证接口

基础地址 `https://www.xinjiaoyu.com`，鉴权头由 `scripts/xjy.mjs` 自动生成。
响应统一 `{ code, msg, data }`，`code === 200` 为成功。

文中的 `{schoolId}`、`{teacherId}`、`{classId}`、`{courseId}`、`{gradeId}`、`{schoolYearName}`
都来自 `node xinjiaoyu/scripts/xjy.mjs ctx`，不要手写死。验证日期：2026-10-30。

## 系统 / 账号

| 方法 | 路径 | 关键参数 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/v3/server_system/member/user/{userId}` | — | 用户档案：schoolId、phaseId、gradeId、courseId、realName、会员 |
| GET | `/api/v3/server_system/user/self/{roleId}/menus` | — | 角色菜单 |
| GET | `/api/v3/server_system/system/code` | clientSessionId、t、client、encrypt | 签名种子 |
| GET | `/api/v3/server_system/user/self/{roleId}/report/menus` | — | 报表菜单 |

## 学校 / 班级 / 学生

| 方法 | 路径 | 关键参数 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/v3/server_school/school/year/grade/class` | schoolYearName、teacherId、isHistory、schoolId | 教师班级列表 |
| GET | `/api/v3/server_school/school/year/grade/course` | schoolYearName、gradeId、teacherId、schoolId、isHistory | 年级学科 |
| GET | `/api/v3/server_school/school/year/grade/teacher/list` | teacherId、schoolId、isHistory | 年级教师 |
| POST | `/api/v3/server_school/school/student/list` | body：`{queryType:2,schoolId,gradeId,classId,size,keyword}` | **班级学生分页列表** |
| GET | `/api/v3/server_school/school/class/student/list/{classId}` | — | 班级学生（按学科重复，需去重） |
| POST | `/api/v3/server_school/school/class/query/class/list` | body：`{classIdSet:[...]}` | 按 ID 批量查班级 |
| GET | `/api/v3/server_school/school/class/manage/class/list/by/teacher/{teacherId}` | schoolYearName、isHistory | 班级管理列表（含班主任） |
| GET | `/api/v3/server_school/school/student/grade/schoolYear` | studentId | 学生所属年级/学年 |

学生记录关键字段：`studentId`、`studentName`、`userId`、`administrativeClassId`、
`administrativeClassName`、`courseId`。

## 作业 / 学情

| 方法 | 路径 | 关键参数 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/v3/server_homework/homework/list` | classId、courseId、startDate、endDate、schoolYearName、isHistory、schoolId | **班级作业列表** |
| GET | `/api/v3/server_homework/homework/teachers/list` | teacherId、schoolYearName、startDate、endDate、size、homeworkTypes、classIds、courseId、homeworkStatus | 教师维度作业列表（参数多，可只传前几个） |
| GET | `/api/v3/server_homework/homework/teachers/homework/type` | 同上 + tabKey、moduleName | 作业分类统计 |
| GET | `/api/v3/server_homework/homework/class/list` | classIds、courseId、gradeId、startDate、endDate、schoolYearName、isHistory、teacherId | 班级-作业关联 |
| GET | `/api/v3/server_homework/homework/learning/analysis/student/list` | studentId、classId、courseId、startDate、endDate、isHistory、schoolYearName、schoolId | **学生历次作业成绩** |
| GET | `/api/v3/server_homework/homework/answer/sheet/report/class/student/template` | classId、templateIds（可重复）、courseId、schoolYearName、isHistory、isFollowed、schoolId | 班级学生 × 作业矩阵 |
| GET | `/api/v3/server_homework/homework/answer/sheet/rawScan` | answerSheetId、schoolId、schoolYearName | 答题卡原图 |
| GET | `/api/v3/server_homework/homework/teacher/settings` | — | 批阅设置 |

`homework/list` 字段：`homeworkId`、`homeworkName`、`submitNumber`、`missingNumber`、
`totalNumber`、`avgScore`、`reviewProgress`、`finishTime`、`templateId`。

`learning/analysis/student/list` 字段：`homeworkName`、`score`、`classRank`、
`averageScore`、`gradeAverage`、`answerSheetId`、`createTime`。

## 考试

| 方法 | 路径 | 关键参数 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/v3/server_exam_new/exam/page` | body：`{schoolId,gradeIds,current,size,orderType,isHistory,schoolYearName,examStartTime,examEndTime,keyword,examType,process}` | **考试分页列表** |
| POST | `/api/v3/server_exam_new/exam/info/list/by/teacher` | body：`{isFinished:""}` | 教师考试（简版） |
| POST | `/api/v3/server_exam_report/track/student/list` | body 待抓 | 学生追踪名单 |
| POST | `/api/v3/server_exam_new/exam/student/tracking/list` | body：`{schoolId,studentId,gradeId}` | 学生考试轨迹 |
| POST | `/api/v3/server_exam_new/exam/info/student/exam/list` | body：`{studentId,isTeacher,courseId,examIds,courseCombination}` | 学生某次考试科目 |
| POST | `/api/v3/server_exam_report/track/student/course/score/summary` | body：`{isTeacher,studentId,schoolId,courseCombination,schoolYearName,examId,assigned}` | 学生考试得分汇总 |
| GET | `/api/v3/server_exam_new/class/student/info` | classId 等 | 考试班级学生 |

`exam/page` 返回 `data.records[]`：`examId`、`examName`、`gradeName`、`courseName`、
`examStartTime`、`examStatusName`。

## 题库

| 方法 | 路径 | 关键参数 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/v3/server_questions/category/tree/list` | — | 分类树（公开） |
| GET | `/api/v3/server_questions/category/attribute/{categoryId}` | catalogType=1 | 分类属性 |
| POST | `/api/v3/server_questions/book/catalog/list` | body：`{categoryId,bookCatalogDetailList:[{categoryAttributeId,attributeValueId}...],isHide}` | 教材目录（含知识点标签来源） |
| POST | `/api/v3/server_questions/questions/bank/query/list/all/esDetail` | 见模板 | **题目列表** |
| POST | `/api/v3/server_questions/questions/bank/query/conditions` | `{baseIds:[...]}` | 筛选条件 |
| GET | `/api/v3/server_questions/questions/basket/dialog` | phaseId、courseId | 试题篮 |
| POST | `/api/v3/server_questions/questions/type/management/list` | body | 题型管理 |

### 题目查询注意

- `dimensionTagList` 必填，缺了不报错但 `total` 恒为 0。
- `textBookCatalogId` 可省略。
- `search` 在筛选范围内做关键字过滤，不是全库搜索。
- 模板：`references/queries/question-bank-chapter3.json`（第三章全部知识点）。
- 换章节/教材：抓一份新的请求体存成 `references/queries/question-bank-<名>.json`。
- 返回字段：`id`、`content`、`answer`、`answerExplanation[]`、`optionsList[]`、
  `logicTypeName`、`difficultyName`、`courseName`、`phaseName`、`sourceFeature[]`。

## 错题本

| 方法 | 路径 | 关键参数 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/v3/server_error_book/teacher/mistake/new/page` | classIdList、courseId、gradeId、schoolYearName、startDate、endDate、current、size、orderIndex、homeworkTemplateIds | 班级错题分页 |
| GET | `/api/v3/server_error_book/teacher/mistake/new/course` | 同上（不含分页） | 按学科统计 |
| GET | `/api/v3/server_error_book/teacher/mistake/class` | 同上 | 按班级统计 |
| GET | `/api/v3/server_error_book/student/mistake` | 学生错题 | 学生错题本 |

`mistake/new/page` 的 `homeworkTemplateIds` 必填，值来自 `homework/list` 的 `templateId`。

## 资源 / 备课

| 方法 | 路径 | 关键参数 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/v3/server_resource/course/network/lesson/catalog/tree` | bookCatalogId、isFineAlbum | 课程目录树 |
| GET | `/api/v3/server_resource/course/network/lesson/resource/list` | catalogId、courseResourceTypeId | 课时资源 |
| GET | `/api/v3/server_resource/course/network/lesson/video/list/{catalogId}` | — | 课时视频 |
| POST | `/api/v3/server_resource/ebookshell/book/list` | body：`{schoolId,phaseId,current,size,attrIdList,gradeId,bookName,courseId}` | 电子教材 |
| GET | `/api/v3/server_resource/resource/basket/1` | current、size | 资源篮 |

## 页面路由

| 页面 | 路由 |
| --- | --- |
| 登录 | `/auth/login` |
| 首页 | `/` |
| 备课授课 | `/teacher/prepare_courses_new` |
| 作业 | `/teacher/grading_center/homework` |
| 错题本 | `/teacher/grading_center/homework_mistakes_notebook` |
| 题库卷库 | `/teacher/question_base_paper/selectNew` |
| 学情分析 · 班级 | `/admin/class-analysis-list` |
| 学情分析 · 学生 | `/admin/student-analysis` |
| 考试 | `/teacher/examination/list` |
| 资源库 | `/teacher/prepare_courses` |
| 班级管理 | `/teacher/classMgmt` |

## 抓请求体

`browser.network.get` 常拿不到 POST body，用页面钩子（见 SKILL.md），操作一次后
`window.__cap.pop()` 取 `{url, body}`，存成 JSON 模板即可离线重放。

## 写操作

执行前必须向用户确认。已固化成模板的用 `xjy.mjs call <名称>`，其余按抓包流程补。

### 试题篮（已验证）

| 方法 | 路径 | body |
| --- | --- | --- |
| POST | `/api/v3/server_questions/questions/basket/batch` | `{userId,phaseId,phaseName,courseId,courseName,questionIds[],typeIds[],typeNames[],questionNumbers[],source:1,typeOrdered:"",questionSource:"1"}` |
| DELETE | `/api/v3/server_questions/questions/basket` | `["questionId1","questionId2"]` |
| GET | `/api/v3/server_questions/questions/basket/dialog` | 查询参数 `phaseId`、`courseId` |

关键：`questionIds / typeIds / typeNames / questionNumbers` 四个数组必须**等长且一一对应**。
`typeIds` 是题目的 `logicTypeId`（1038 实验题、1014 单选、1015 多选、1016 解答），
`typeNames` 是对应 `logicTypeName`。只传 `questionIds` 会 500。

### 批改赋分

**单学生单题打分（已验证，模板 `homework-grade-question`）**

```
PUT /api/v3/server_homework/homework/question/answer/review
{
  "questionAnswerList": [{
    "questionAnswerId": "<questionAnswerId>",
    "score": 10,
    "pointsMode": 1,
    "teacherId": "<teacherId>",
    "scoreMarks": [], "comments": [], "penLines": [], "judgeMarks": [],
    "markWay": "1",
    "schoolYear": 20263
  }]
}
```

- 已用「原分数」重放验证，不会改变成绩。
- `questionAnswerId` 是学生+题目维度的答案 ID，从批阅页数据里取。
- `questionAnswerList` 放多条即可批量提交。
- `schoolYear` 是 `20263` 这种五位格式（抓包确认自己学校的值）。

**按题批量操作**

```
PUT /api/v3/server_homework/homework/question/answer/score
{ "homeworkId": "...", "questionIdSet": ["questionId1", ...], "type": 0 }
```

- `type: 0` 在页面里的用途是「全部清空已赋分」。
- `questionIdSet` 是题目 ID 字符串数组。
- 未赋分的题、未批阅的作业不要随意调用。

**批阅页读取数据**

| 方法 | 路径 | 参数 |
| --- | --- | --- |
| GET | `/api/v3/server_homework/homework/students/identify/answer/sheets` | homeworkId |
| GET | `/api/v3/server_homework/homework/question/answer/classes/reviews` | homeworkId、classId、templateId |
| GET | `/api/v3/server_homework/homework/answer/sheet/class/review/progress` | homeworkId、classId |
| GET | `/api/v3/server_homework/homework/template/detail/{homeworkId}` | — |
| GET | `/api/v3/server_homework/homework/question/answer/ai/report` | questionAnswerId、homeworkId |

### 组卷 / 生成试卷（已验证）

完整流程和字段说明见 `workflows/paper-generate.md`。核心三步：

| 步骤 | 方法 | 路径 | 说明 |
| --- | --- | --- | --- |
| 1 | POST | `/api/v3/server_questions/constitute/paper/office` | 生成 Word，body 含 `paperName`、`questionInfo[]`、`produceFileParam` |
| 2 | PUT | `/api/v3/server_questions/constitute/paper` | 保存试卷记录，`paperInfo` / `scoreInfo` 是 **JSON 字符串** |
| 3 | POST | `/api/v3/server_questions/constitute/paper/operation` | `{createBy, operation:1, constitutePaperId}` |

配套接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/v3/server_questions/constitute/paper/detail/{paperId}` | 试卷详情 |
| POST | `/api/v3/server_questions/constitute/paper/list/page` | 我的卷库分页，**必须带 `catalogId`** |
| GET | `/api/v3/server_questions/constitute/paper/catalog/list?phaseId&courseId` | 卷库目录 |
| GET | `/api/v3/server_questions/constitute/paper/download/{paperId}` | 下载 |
| DELETE | `/api/v3/server_questions/constitute/paper/{paperId}` | 删除（已验证） |
| POST | `/api/v3/server_questions/constitute/paper/modifyHomework` | 试卷转作业 |
| POST | `/api/v3/server_exam_new/exam/paper/custom/sheet/paper/save` | 保存自定义答题卡（未抓） |

### 发布考试（静态分析，未实际执行）

```
PUT /api/v3/server_exam_new/exam/course/relation/{examId}/publish/{?}
```

- 来自前端 `releaseTest(examId, ?)`，方法 PUT，无请求体。
- 第二个路径变量含义未确认（可能是学科/关系 ID），**首次使用前必须在草稿考试上抓包确认**。
- 相关：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/v3/server_exam_new/exam/course/relation/paper/publish/state` | 发布状态 |
| GET | `/api/v3/server_exam_new/exam/issue/list/{examId}` | 发布进度 |
| POST | `/api/v3/server_exam_new/exam/info/list/for/allocation` | 分配列表 |
| POST | `/api/v3/server_exam_report/report/setting/release/save` | 成绩发布设置 |

> 发布考试会影响学生端，**不要凭猜测调用**。确认路径变量后，先在一个测试考试上验证。

