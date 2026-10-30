# 账号上下文（自动解析）

不再手写账号 ID。运行：

```bash
node xinjiaoyu/scripts/xjy.mjs ctx --refresh
```

会从登录 token（JWT payload 里的 `sub`）和 `/api/v3/server_system/member/user/{id}`
解析出下面这些字段，缓存到 `~/.config/opencode/xinjiaoyu/context.json`（6 小时有效）：

| 字段 | 来源 |
| --- | --- |
| userId、roleId、roleTypeId、roleName、realName | token payload |
| teacherId、schoolId、schoolName、phaseId | token payload 的 `school` + 用户档案 |
| gradeId、gradeName、courseId、courseName | 用户档案 |
| schoolYearName | 按当前日期推算（9 月起算新学年），可用 `XJY_SCHOOL_YEAR` 覆盖 |
| classes[]（classId、className） | `/server_school/school/year/grade/class` |
| courses[]（courseId、courseName） | `/server_school/school/year/grade/course` |

换账号、换学校、换学年后重新执行一次 `ctx --refresh` 即可，其他命令会自动读取缓存。

需要临时换学年：

```powershell
$env:XJY_SCHOOL_YEAR="2025-2026"
node xinjiaoyu/scripts/xjy.mjs ctx --refresh
```

`classes` / `courses` / `homework` / `report` 等命令都支持**名称或 ID**，
例如 `--class 1班`、`--student 张三`，会自动在当前上下文里匹配。
