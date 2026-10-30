#!/usr/bin/env node
/**
 * 新教育智能平台 API 客户端（免开浏览器）
 *
 *   node xjy.mjs auth status | auth save [file] | auth clear
 *   node xjy.mjs ctx [--refresh]
 *   node xjy.mjs me | classes | courses
 *   node xjy.mjs homework [--class 1班] [--days 180] [--all]
 *   node xjy.mjs students --class 1班
 *   node xjy.mjs report --student 张三 [--class 1班] [--days 120]
 *   node xjy.mjs exams [--days 60] [--size 10] [--keyword 质检]
 *   node xjy.mjs questions [--search 重力] [--page 1] [--size 20] [--template 文件]
 *   node xjy.mjs ls [关键词]
 *   node xjy.mjs api <METHOD> <path> [--query k=v] [--data '@文件'|json] [--raw] [--out f]
 *   node xjy.mjs get|post|put|delete <path> [同上]
 *
 * 环境变量：
 *   XJY_AUTH_FILE    登录态文件（默认 ~/.config/opencode/xinjiaoyu/auth.json）
 *   XJY_BASE_URL     站点地址（默认 https://www.xinjiaoyu.com）
 *   XJY_SCHOOL_YEAR  学年，默认按当前日期推算（9 月起算新学年）
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_DIR = join(homedir(), ".config", "opencode", "xinjiaoyu");
const BASE = (process.env.XJY_BASE_URL || "https://www.xinjiaoyu.com").replace(/\/+$/, "");
const AUTH_FILE = process.env.XJY_AUTH_FILE || join(CONFIG_DIR, "auth.json");
const CONTEXT_FILE = join(CONFIG_DIR, "context.json");
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36";

const md5 = (s) => createHash("md5").update(s).digest("hex");
const readText = (file) => readFileSync(file, "utf8").replace(/^\uFEFF/, "");
const readJson = (file) => (existsSync(file) ? JSON.parse(readText(file)) : null);
const writeJson = (file, obj) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(obj, null, 2));
};

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function loadAuth() {
  const auth = readJson(AUTH_FILE);
  return auth && auth.token ? auth : null;
}

function requireAuth() {
  const auth = loadAuth();
  if (!auth) {
    die(`未找到登录态：${AUTH_FILE}\n按 SKILL.md「抓取并保存登录态」操作一次。`, 2);
  }
  return auth;
}

function decodeToken(token) {
  try {
    const part = token.split(".")[1];
    const pad = part + "=".repeat((4 - (part.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(pad, "base64url").toString("utf8"));
    const sub = typeof payload.sub === "string" ? JSON.parse(payload.sub) : payload.sub || {};
    return { ...payload, ...sub };
  } catch {
    return {};
  }
}

function authHeaders(auth) {
  const t = Date.now();
  const clientSession = auth.clientSessionId || `${t}${Math.random().toString(36).slice(2, 10)}`;
  const headers = {
    platformType: "1",
    client: "front",
    clientSession,
    t: String(t),
    encrypt: md5((auth.safeCode || "") + t + clientSession + "front"),
    deviceType: "Chrome",
    device: "pc",
    accept: "application/json",
    "user-agent": USER_AGENT,
    Authorization: `JBY ${auth.token}`,
    accessToken: auth.accessToken || "",
  };
  return headers;
}

async function api(method, path, { query, data, form, auth } = {}) {
  const a = auth || requireAuth();
  let url;
  try {
    url = new URL(path.startsWith("http") ? path : `${BASE}${path.startsWith("/") ? "" : "/"}${path}`);
  } catch {
    die(`路径不合法：${path}`);
  }
  for (const [k, v] of Object.entries(query || {})) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, x));
    else url.searchParams.append(k, String(v));
  }

  let body;
  if (form && form.length) {
    const fd = new FormData();
    for (const item of form) {
      const i = item.indexOf("=");
      if (i < 0) die(`--form 需要 k=v 或 k=@文件：${item}`);
      const key = item.slice(0, i);
      const val = item.slice(i + 1);
      if (val.startsWith("@")) {
        const file = val.slice(1);
        const buf = readFileSync(file);
        fd.append(key, new Blob([buf]), file.split(/[\\/]/).pop());
      } else {
        fd.append(key, val);
      }
    }
    body = fd;
  } else if (method !== "GET" && method !== "HEAD") {
    if (data === undefined) body = "{}";
    else if (typeof data === "string") body = data;
    else body = JSON.stringify(data);
  }

  const headers = authHeaders(a);
  if (body && !(body instanceof FormData)) headers["content-type"] = "application/json;charset=utf-8";

  let res;
  try {
    res = await fetch(url, { method, headers, body });
  } catch (e) {
    die(`网络错误：${e.message}`, 3);
  }

  const text = await res.text();
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("json")) {
    die(`返回的不是 JSON（HTTP ${res.status}）\n${text.slice(0, 400)}\n路径可能写错，用 node xjy.mjs ls 查目录。`, 4);
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    die(`响应解析失败：${text.slice(0, 300)}`, 4);
  }

  if (typeof json.code === "number" && json.code !== 200) {
    const hint =
      json.code === 401 ? "登录态过期，重新抓取。" : json.code === 444 ? "签名/会话校验失败，重新抓取登录态。" : "";
    const msg = `接口失败 code=${json.code} msg=${json.msg ?? ""} ${hint}`.trim();
    const err = new Error(msg);
    err.code = json.code;
    err.payload = json;
    throw err;
  }

  return json;
}

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

function guessSchoolYear() {
  const d = new Date();
  const y = d.getFullYear();
  return d.getMonth() + 1 >= 9 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

async function getContext(refresh) {
  const auth = requireAuth();
  const claims = decodeToken(auth.token);
  const userId = String(auth.userId || claims.id || "");
  if (!userId) die("无法从登录态解析 userId，请重新抓取登录态。");

  const cached = readJson(CONTEXT_FILE);
  if (!refresh && cached && String(cached.userId) === userId && Date.now() - cached.ts < 6 * 3600 * 1000) {
    return cached;
  }

  const me = (await api("GET", `/api/v3/server_system/member/user/${userId}`, { auth })).data || {};
  const school = claims.school || {};
  const schoolId = String(me.schoolId || school.schoolId || "");
  const teacherId = String(school.teacherId || "");
  const schoolYearName = process.env.XJY_SCHOOL_YEAR || guessSchoolYear();
  const phaseId = String(me.phaseId || school.phaseId || "");
  const gradeId = String(me.gradeId || "");

  let classes = [];
  let courses = [];
  if (teacherId && schoolId) {
    try {
      const r = await api("GET", "/api/v3/server_school/school/year/grade/class", {
        auth,
        query: { schoolYearName, teacherId, isHistory: "false", schoolId },
      });
      classes = Array.isArray(r.data) ? r.data : [];
    } catch (e) {
      console.error(`班级列表获取失败：${e.message}`);
    }
    try {
      const r = await api("GET", "/api/v3/server_school/school/year/grade/course", {
        auth,
        query: { schoolYearName, gradeId, teacherId, schoolId, isHistory: "false" },
      });
      courses = Array.isArray(r.data) ? r.data : [];
    } catch (e) {
      console.error(`学科列表获取失败：${e.message}`);
    }
  }

  const ctx = {
    userId,
    roleId: String(claims.roleId || ""),
    roleTypeId: String(claims.roleTypeId || ""),
    roleName: claims.roleName || "",
    realName: me.realName || claims.realName || "",
    teacherId,
    schoolId,
    schoolName: me.schoolName || school.schoolName || "",
    phaseId,
    phaseName: me.phaseName || school.phaseName || "",
    gradeId,
    gradeName: me.gradeName || "",
    courseId: String(me.courseId || ""),
    courseName: me.courseName || "",
    schoolYearName,
    classes: classes.map((c) => ({ classId: String(c.classId), className: c.className })),
    courses: courses.map((c) => ({
      courseId: String(c.courseId ?? c.id),
      courseName: c.courseName ?? c.name,
    })),
    ts: Date.now(),
  };
  writeJson(CONTEXT_FILE, ctx);
  return ctx;
}

function pickClass(ctx, ref) {
  if (!ref) {
    if (ctx.classes.length === 1) return ctx.classes[0];
    die(`有 ${ctx.classes.length} 个班级，请用 --class 指定：${ctx.classes.map((c) => c.className).join("、")}`);
  }
  const list = ctx.classes;
  const exact = list.find((c) => String(c.classId) === String(ref) || c.className === ref);
  if (exact) return exact;
  const fuzzy = list.filter((c) => c.className.includes(ref));
  if (fuzzy.length === 1) return fuzzy[0];
  if (!fuzzy.length) die(`找不到班级「${ref}」，可选：${list.map((c) => c.className).join("、")}`);
  die(`「${ref}」匹配到多个班级：${fuzzy.map((c) => c.className).join("、")}`);
}

function pickCourse(ctx, ref) {
  if (!ref) return { courseId: ctx.courseId, courseName: ctx.courseName };
  const list = ctx.courses.length ? ctx.courses : [{ courseId: ctx.courseId, courseName: ctx.courseName }];
  const exact = list.find((c) => String(c.courseId) === String(ref) || c.courseName === ref);
  if (exact) return exact;
  const fuzzy = list.filter((c) => (c.courseName || "").includes(ref));
  if (fuzzy.length === 1) return fuzzy[0];
  die(`找不到学科「${ref}」，可选：${list.map((c) => c.courseName).join("、")}`);
}

async function listStudents(ctx, cls) {
  const r = await api("POST", "/api/v3/server_school/school/student/list", {
    data: {
      queryType: 2,
      schoolId: ctx.schoolId,
      gradeId: ctx.gradeId,
      classId: cls.classId,
      size: 500,
      keyword: "",
    },
  });
  const rows = r?.data?.records || r?.records || [];
  const seen = new Map();
  for (const s of rows) {
    const id = String(s.studentId || s.id || s.userId || "");
    if (!id || seen.has(id)) continue;
    seen.set(id, {
      studentId: id,
      userId: String(s.userId || ""),
      studentName: s.studentName || s.realName || s.name || "",
      className: s.administrativeClassName || cls.className,
      classId: String(s.administrativeClassId || cls.classId),
    });
  }
  return [...seen.values()].sort((a, b) => a.studentName.localeCompare(b.studentName, "zh"));
}

function pickStudent(students, ref) {
  const exact = students.find((s) => String(s.studentId) === String(ref) || s.studentName === ref);
  if (exact) return exact;
  const fuzzy = students.filter((s) => s.studentName.includes(ref));
  if (fuzzy.length === 1) return fuzzy[0];
  if (!fuzzy.length) die(`班里找不到学生「${ref}」。`);
  die(`「${ref}」匹配到多人：${fuzzy.map((s) => s.studentName).join("、")}`);
}

function print(value, flags) {
  const serialized = JSON.stringify(value, null, 2);
  if (flags.out) {
    writeFileSync(flags.out, serialized);
    console.error(`已写入 ${flags.out}`);
  } else {
    console.log(serialized);
  }
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  const multi = new Set(["query", "form", "set", "set-query", "set-path"]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1];
      if (val === undefined || (val.startsWith("--") && key !== "data")) {
        flags[key] = true;
        continue;
      }
      i++;
      if (multi.has(key)) (flags[key] ||= []).push(val);
      else flags[key] = val;
    } else if (a === "-o") {
      flags.out = argv[++i];
    } else if (a === "-q") {
      (flags.query ||= []).push(argv[++i]);
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

function queryFromFlags(flags) {
  const query = {};
  for (const q of flags.query || []) {
    const i = q.indexOf("=");
    if (i < 0) die(`--query 需要 k=v：${q}`);
    query[q.slice(0, i)] = q.slice(i + 1);
  }
  return query;
}

function argsToQuery(flags, keys) {
  const q = {};
  for (const k of keys) if (flags[k] !== undefined && flags[k] !== true) q[k] = flags[k];
  return q;
}

// ---------- commands ----------

async function cmdAuth(rest) {
  const sub = rest[0];
  if (sub === "status") {
    const auth = loadAuth();
    if (!auth) die(`未保存登录态（${AUTH_FILE}）`, 1);
    const claims = decodeToken(auth.token);
    const exp = claims.exp ? new Date(claims.exp * 1000) : null;
    console.log(`文件：${AUTH_FILE}`);
    console.log(`用户：${claims.realName || "?"}（${claims.id || auth.userId || "?"}）`);
    console.log(`角色：${claims.roleName || "?"}`);
    console.log(`token：${auth.token.slice(0, 6)}…（${auth.token.length} 字符）`);
    console.log(`过期时间：${exp ? exp.toISOString() : "未知"}`);
    console.log(`保存时间：${auth.savedAt || "未知"}`);
    return;
  }
  if (sub === "clear") {
    if (existsSync(AUTH_FILE)) writeFileSync(AUTH_FILE, "{}");
    console.error("已清除登录态");
    return;
  }
  if (sub === "save") {
    const file = rest[1];
    const raw = file ? readText(file) : readFileSync(0, "utf8");
    const obj = JSON.parse(raw.replace(/^\uFEFF/, ""));
    const u = obj?.user?.token ? obj.user : obj;
    if (!u?.token) die("缺少 token：传入浏览器 localStorage.jbyweb 里的 user 对象。", 2);
    const data = {
      token: u.token,
      accessToken: u.accessToken || "",
      safeCode: u.safeCode || "",
      clientSessionId: u.clientSessionId || "",
      roleId: u.roleId || "",
      userId: u.userId || u.id || "",
      savedAt: new Date().toISOString(),
    };
    writeJson(AUTH_FILE, data);
    console.error(`登录态已保存：${AUTH_FILE}`);
    return;
  }
  die("用法：auth status | auth save [file] | auth clear");
}

async function cmdCtx(flags) {
  const ctx = await getContext(!!flags.refresh);
  const { ts, ...rest } = ctx;
  print({ ...rest, cachedAt: new Date(ts).toISOString() }, flags);
}

async function cmdHomework(flags) {
  const ctx = await getContext(false);
  const cls = pickClass(ctx, flags.class);
  const course = pickCourse(ctx, flags.course);
  const start = flags.start || daysAgo(Number(flags.days || 180));
  const end = flags.end || today();
  const r = await api("GET", "/api/v3/server_homework/homework/list", {
    query: {
      classId: cls.classId,
      courseId: course.courseId,
      startDate: start,
      endDate: end,
      schoolYearName: ctx.schoolYearName,
      isHistory: "false",
      schoolId: ctx.schoolId,
    },
  });
  const list = (Array.isArray(r.data) ? r.data : r.data?.records || []).map((h) => ({
    homeworkId: String(h.homeworkId ?? h.id ?? ""),
    homeworkName: h.homeworkName ?? h.name ?? "",
    className: h.className,
    submitNumber: h.submitNumber,
    missingNumber: h.missingNumber,
    totalNumber: h.totalNumber,
    avgScore: h.avgScore,
    reviewProgress: h.reviewProgress,
    finishTime: h.finishTime,
  }));
  print({ class: cls.className, course: course.courseName, range: [start, end], count: list.length, list }, flags);
}

async function cmdStudents(flags) {
  const ctx = await getContext(false);
  const cls = pickClass(ctx, flags.class);
  const list = await listStudents(ctx, cls);
  print({ class: cls.className, count: list.length, students: list }, flags);
}

async function cmdReport(flags) {
  const ctx = await getContext(false);
  if (!flags.student) die("缺少 --student（学生姓名或 ID）");
  const cls = pickClass(ctx, flags.class);
  const students = await listStudents(ctx, cls);
  const student = pickStudent(students, flags.student);
  const start = flags.start || daysAgo(Number(flags.days || 120));
  const end = flags.end || today();
  const r = await api("GET", "/api/v3/server_homework/homework/learning/analysis/student/list", {
    query: {
      studentId: student.studentId,
      classId: cls.classId,
      courseId: flags.course ? pickCourse(ctx, flags.course).courseId : ctx.courseId,
      startDate: start,
      endDate: end,
      isHistory: "false",
      schoolYearName: ctx.schoolYearName,
      schoolId: ctx.schoolId,
    },
  });
  const rows = Array.isArray(r.data) ? r.data : [];
  const records = rows.map((x) => ({
    homeworkName: x.homeworkName,
    score: x.score ?? x.totalScore,
    classRank: x.classRank,
    averageScore: x.averageScore,
    gradeAverage: x.gradeAverage,
    classSize: x.classNumber ?? x.totalNumber,
    submitTime: x.createTime,
  }));
  print({ student: student.studentName, class: cls.className, range: [start, end], count: records.length, records }, flags);
}

async function cmdExams(flags) {
  const ctx = await getContext(false);
  const size = Number(flags.size || 10);
  const body = {
    schoolId: ctx.schoolId,
    gradeIds: ctx.gradeId ? [ctx.gradeId] : [],
    process: null,
    keyword: flags.keyword || "",
    current: Number(flags.page || 1),
    size,
    orderType: "1",
    isHistory: false,
    examType: "",
    schoolYearName: ctx.schoolYearName,
    examStartTime: flags.start || daysAgo(Number(flags.days || 120)),
    examEndTime: flags.end || today(),
  };
  const r = await api("POST", "/api/v3/server_exam_new/exam/page", { data: body });
  const data = r.data || {};
  const list = (data.records || []).map((e) => ({
    examId: String(e.examId ?? e.id ?? ""),
    examName: e.examName ?? e.name,
    gradeName: e.gradeName,
    courseName: e.courseName,
    examTime: e.examStartTime || e.startTime,
    status: e.examStatusName ?? e.statusName ?? e.process,
  }));
  print({ total: data.total, current: data.current, size: data.size, count: list.length, list }, flags);
}

async function cmdTargeted(flags) {
  const ctx = await getContext(false);
  const cls = pickClass(ctx, flags.class);
  const allStudents = await listStudents(ctx, cls);
  let selected = allStudents;
  if (flags.students) {
    const refs = String(flags.students).split(",").map((s) => s.trim()).filter(Boolean);
    const seen = new Set();
    selected = [];
    for (const r of refs) {
      const s = pickStudent(allStudents, r);
      if (!seen.has(s.studentId)) {
        seen.add(s.studentId);
        selected.push(s);
      }
    }
  }

  const threshold = Number(flags.threshold || 0.6);
  const start = flags.start || daysAgo(Number(flags.days || 120));
  const end = flags.end || today();
  const course = pickCourse(ctx, flags.course);

  const perStudent = [];
  for (const st of selected) {
    const r = await api("GET", "/api/v3/server_homework/homework/learning/analysis/student/list", {
      query: {
        studentId: st.studentId,
        classId: cls.classId,
        courseId: course.courseId,
        startDate: start,
        endDate: end,
        isHistory: "false",
        schoolYearName: ctx.schoolYearName,
        schoolId: ctx.schoolId,
      },
    });
    perStudent.push({ student: st, rows: Array.isArray(r.data) ? r.data : [] });
  }

  const weakMap = new Map();
  for (const p of perStudent) {
    for (const row of p.rows) {
      const ratio = Number(row.scoreRatio ?? 0) / 100;
      if (!row.templateId || !isFinite(ratio)) continue;
      const belowAvg = Number(row.totalScore) < Number(row.averageScore);
      if (ratio >= threshold && !belowAvg) continue;
      const key = String(row.homeworkId);
      if (!weakMap.has(key)) {
        weakMap.set(key, {
          homeworkId: key,
          templateId: String(row.templateId),
          homeworkName: row.homeworkName,
          students: [],
          minRatio: ratio,
          classAvg: Number(row.averageScore),
        });
      }
      const e = weakMap.get(key);
      if (!e.students.includes(p.student.studentName)) e.students.push(p.student.studentName);
      e.minRatio = Math.min(e.minRatio, ratio);
    }
  }

  const weakHomeworks = [...weakMap.values()]
    .sort((a, b) => a.minRatio - b.minRatio)
    .slice(0, Number(flags.homeworks || 5));

  const weakQuestions = [];
  for (const hw of weakHomeworks) {
    const r = await api("GET", "/api/v3/server_homework/homework/question/answer/classes/reviews", {
      query: { homeworkId: hw.homeworkId, classId: cls.classId, templateId: hw.templateId },
    });
    const list = Array.isArray(r.data) ? r.data : [];
    for (const q of list) {
      const max = Number(q.maxScore || 0);
      const avg = Number(q.avgScore || 0);
      if (!max || !avg) continue;
      const rate = avg / max;
      if (rate >= threshold) continue;
      weakQuestions.push({
        homeworkId: hw.homeworkId,
        homeworkName: hw.homeworkName,
        questionId: String(q.questionId),
        questionNumber: q.questionNumber,
        classRate: Number(rate.toFixed(3)),
        maxScore: max,
        type: q.logicTypeName || q.questionTypeName || "",
        difficulty: q.difficulty,
        content: String(q.content || q.title || "").replace(/<[^>]+>/g, "").slice(0, 80),
      });
    }
  }

  let recommended = [];
  if (weakQuestions.length) {
    const ids = [...new Set(weakQuestions.map((q) => q.questionId))];
    const r = await api("POST", "/api/v3/server_questions/questions/similar/new/batch", {
      data: { questionIds: ids },
    });
    const groups = Array.isArray(r.data) ? r.data : [];
    const seen = new Set(ids);
    for (const g of groups) {
      for (const q of g.questionsSimilarList || []) {
        const id = String(q.id);
        if (seen.has(id)) continue;
        seen.add(id);
        recommended.push({
          id,
          type: q.logicTypeName || "",
          typeId: String(q.logicTypeId || ""),
          difficulty: q.difficultyName || "",
          content: String(q.content || "").replace(/<[^>]+>/g, "").slice(0, 100),
          from: String(g.questionId || ""),
        });
      }
    }
    recommended = recommended.slice(0, Number(flags.limit || 20));
  }

  const plan = {
    class: cls.className,
    course: course.courseName,
    students: selected.map((s) => s.studentName),
    range: [start, end],
    threshold,
    weakHomeworks: weakHomeworks.map((h) => ({
      homeworkId: h.homeworkId,
      homeworkName: h.homeworkName,
      students: h.students.length,
      minRatio: Number(h.minRatio.toFixed(3)),
      classAvg: h.classAvg,
    })),
    weakQuestions,
    recommended,
  };

  if (flags.add && recommended.length) {
    const ids = recommended.map((q) => q.id);
    await api("POST", "/api/v3/server_questions/questions/basket/batch", {
      data: {
        userId: ctx.userId,
        phaseId: ctx.phaseId,
        phaseName: ctx.phaseName,
        courseId: course.courseId,
        courseName: course.courseName,
        questionIds: ids,
        typeIds: recommended.map((q) => q.typeId || "0"),
        typeNames: recommended.map((q) => q.type || ""),
        questionNumbers: ids.map(() => 1),
        source: 1,
        typeOrdered: "",
        questionSource: "1",
      },
    });
    plan.addedToBasket = ids.length;
  }

  print(plan, flags);
}

async function cmdQuestions(flags) {
  const dir = join(SKILL_ROOT, "references", "queries");
  if (flags.templates) {
    const list = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
    print({ dir, templates: list }, flags);
    return;
  }
  const templatePath = flags.template ? flags.template : join(dir, "question-bank-chapter3.json");
  if (!existsSync(templatePath)) {
    const list = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
    die(`找不到查询模板：${templatePath}\n可用模板：${list.join("、") || "无"}\n用 --template 指定，或按 SKILL.md 抓一份新的。`);
  }
  const body = await withContext(readJson(templatePath));
  body.current = Number(flags.page || body.current || 1);
  body.size = Number(flags.size || body.size || 10);
  if (flags.search !== undefined && flags.search !== true) body.search = flags.search;
  const r = await api("POST", "/api/v3/server_questions/questions/bank/query/list/all/esDetail", { data: body });
  const d = r.data || {};
  const list = (d.records || []).map((q) => ({
    id: String(q.id),
    type: q.logicTypeName,
    difficulty: q.difficultyName,
    course: q.courseName,
    source: (q.sourceFeature || []).map((s) => s.sourceShortNote).filter(Boolean).join(" / "),
    content: String(q.content || "").replace(/<[^>]+>/g, "").slice(0, 200),
    answer: String(q.answer || "").replace(/<[^>]+>/g, "").slice(0, 120),
  }));
  print({ total: d.total, page: d.current, size: d.size, count: list.length, list }, flags);
}

function cmdLs(positional) {
  const file = join(SKILL_ROOT, "references", "api-index.json");
  if (!existsSync(file)) die("缺少接口目录，先运行：node scripts/catalog.mjs");
  const all = readJson(file);
  const kw = positional[0];
  const hit = kw ? all.filter((x) => x.path.toLowerCase().includes(kw.toLowerCase())) : all;
  const limit = 200;
  console.log(
    JSON.stringify(
      { keyword: kw || null, total: hit.length, showing: Math.min(hit.length, limit), items: hit.slice(0, limit) },
      null,
      2,
    ),
  );
}

async function cmdApi(method, path, flags) {
  const data = flags.data === true ? "{}" : flags.data?.startsWith("@") ? readText(flags.data.slice(1)) : flags.data;
  const r = await api(method, path, { query: queryFromFlags(flags), data, form: flags.form });
  print(flags.raw ? r : r.data !== undefined ? r.data : r, flags);
}

const CALLS_DIR = join(SKILL_ROOT, "references", "calls");

function substituteVars(value, ctx) {
  if (typeof value === "string") {
    return value.replace(/\$\{(\w+)\}/g, (m, k) => (ctx[k] !== undefined ? String(ctx[k]) : m));
  }
  if (Array.isArray(value)) return value.map((v) => substituteVars(v, ctx));
  if (value && typeof value === "object") {
    for (const k of Object.keys(value)) value[k] = substituteVars(value[k], ctx);
  }
  return value;
}

/** 把模板里的 ${userId} / ${schoolId} 等替换成当前账号上下文 */
async function withContext(value) {
  const probe = typeof value === "string" ? value : JSON.stringify(value);
  if (!probe.includes("${")) return value;
  const ctx = await getContext(false);
  return substituteVars(value, ctx);
}

function deepSet(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    const nextIsIndex = /^\d+$/.test(parts[i + 1]);
    if (cur[k] === undefined || typeof cur[k] !== "object") cur[k] = nextIsIndex ? [] : {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}

const parseValue = (v) => {
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
};

function listCalls(flags) {
  if (!existsSync(CALLS_DIR)) {
    print({ dir: CALLS_DIR, calls: [] }, flags);
    return;
  }
  const calls = readdirSync(CALLS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        const c = readJson(join(CALLS_DIR, f));
        return {
          name: f.replace(/\.json$/, ""),
          description: c.description || "",
          method: c.method,
          path: c.path,
          verified: !!c.verified,
          capturedAt: c.capturedAt || "",
        };
      } catch {
        return { name: f.replace(/\.json$/, ""), error: "无法解析" };
      }
    });
  print({ dir: CALLS_DIR, count: calls.length, calls }, flags);
}

async function cmdCall(name, flags) {
  const file = join(CALLS_DIR, `${name}.json`);
  if (!existsSync(file)) {
    const list = existsSync(CALLS_DIR) ? readdirSync(CALLS_DIR).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")) : [];
    die(`找不到调用模板「${name}」\n可用：${list.join("、") || "无"}`);
  }
  const tpl = readJson(file);
  let path = tpl.path;
  for (const p of flags["set-path"] || []) {
    const i = p.indexOf("=");
    if (i < 0) die(`--set-path 需要 k=v：${p}`);
    path = path.replaceAll(`{${p.slice(0, i)}}`, p.slice(i + 1));
  }

  let body = tpl.body === undefined ? undefined : JSON.parse(JSON.stringify(tpl.body));
  if (flags.body !== undefined) {
    const raw = flags.body.startsWith("@") ? readText(flags.body.slice(1)) : flags.body;
    try {
      body = JSON.parse(raw);
    } catch {
      die("--body 不是合法 JSON");
    }
  }
  for (const s of flags.set || []) {
    const i = s.indexOf("=");
    if (i < 0) die(`--set 需要 路径=值：${s}`);
    if (!body) die("该模板没有 body，用 --set-query 改查询参数。");
    deepSet(body, s.slice(0, i), parseValue(s.slice(i + 1)));
  }

  const query = { ...(tpl.query || {}), ...queryFromFlags(flags) };
  for (const s of flags["set-query"] || []) {
    const i = s.indexOf("=");
    if (i < 0) die(`--set-query 需要 k=v：${s}`);
    query[s.slice(0, i)] = s.slice(i + 1);
  }

  if (flags.dry) {
    print({ template: name, method: tpl.method, path: await withContext(path), query: await withContext(query), body: await withContext(body) }, flags);
    return;
  }
  const r = await api(tpl.method, await withContext(path), {
    query: await withContext(query),
    data: body === undefined ? undefined : await withContext(body),
  });
  print(flags.raw ? r : r.data !== undefined ? r.data : r, flags);
}

// ---------- entry ----------

const { positional, flags } = parseArgs(process.argv.slice(2));
const [cmd, ...rest] = positional;

try {
  switch (cmd) {
    case "auth":
      await cmdAuth(rest);
      break;
    case "ctx":
    case "whoami":
      await cmdCtx(flags);
      break;
    case "me": {
      const ctx = await getContext(false);
      const me = (await api("GET", `/api/v3/server_system/member/user/${ctx.userId}`)).data;
      print(me, flags);
      break;
    }
    case "classes": {
      const ctx = await getContext(false);
      print(ctx.classes, flags);
      break;
    }
    case "courses": {
      const ctx = await getContext(false);
      print(ctx.courses, flags);
      break;
    }
    case "homework":
      await cmdHomework(flags);
      break;
    case "students":
      await cmdStudents(flags);
      break;
    case "report":
      await cmdReport(flags);
      break;
    case "exams":
      await cmdExams(flags);
      break;
    case "questions":
      await cmdQuestions(flags);
      break;
    case "targeted":
      await cmdTargeted(flags);
      break;
    case "ls":
      cmdLs(rest);
      break;
    case "calls":
      listCalls(flags);
      break;
    case "call":
      await cmdCall(rest[0] || die("缺少模板名"), flags);
      break;
    case "api":
      await cmdApi((rest[0] || "GET").toUpperCase(), rest[1] || die("缺少接口路径"), flags);
      break;
    case "get":
    case "post":
    case "put":
    case "delete":
      await cmdApi(cmd.toUpperCase(), rest[0] || die("缺少接口路径"), flags);
      break;
    default:
      console.log(
        [
          "新教育智能平台 CLI",
          "",
          "  auth status | auth save [file] | auth clear",
          "  ctx [--refresh]            解析并缓存账号上下文",
          "  me | classes | courses     账号 / 班级 / 学科",
          "  homework [--class 1班] [--days 180] [--all]",
          "  students --class 1班",
          "  report --student 张三 [--class 1班] [--days 120]",
          "  exams [--days 60] [--size 10] [--keyword 质检]",
          "  questions [--search 重力] [--page 1] [--size 20] [--template 文件|--templates]",
          "  targeted [--class 1班] [--students 张三,李四] [--days 120] [--threshold 0.6] [--homeworks 5] [--limit 20] [--add]",
          "  ls [关键词]                搜索接口目录",
          "  calls                      列出可回放的调用模板",
          "  call <名称> [--set a.b=v] [--set-query k=v] [--set-path k=v] [--dry]",
          "  api <METHOD> <path> [--query k=v] [--data @file] [--form k=v|k=@file] [--raw] [--out f]",
          "",
          "所有命令都支持 --out 文件 和 --raw。",
        ].join("\n"),
      );
      process.exit(cmd ? 1 : 0);
  }
} catch (e) {
  if (e.code === 401 || e.code === 444) die(e.message, 5);
  die(e.message || String(e), 1);
}
