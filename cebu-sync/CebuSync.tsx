/**
 * Cebu Sync — Phase 1 (簡易版)
 * セブ島オフィス（スタッフ5名・管理者不在）向け 業務マネジメント Web アプリ
 *
 * 単一ファイル React + TypeScript + Tailwind CSS + lucide-react
 * Claude Artifacts / 任意の React 環境にそのまま貼り付けてプレビュー可能。
 * すべてのデータはメモリ上のモック（バックエンド不要）。
 */
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  Calendar,
  Camera,
  Car,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  Coffee,
  Download,
  FileText,
  GraduationCap,
  Landmark,
  LogIn,
  LogOut,
  MapPin,
  Navigation,
  Paperclip,
  Pencil,
  Plus,
  Radio,
  RotateCcw,
  Send,
  Shield,
  Trash2,
  User,
  Users,
  Video,
  X,
} from 'lucide-react';

/* ============================================================================
 * Types
 * ==========================================================================*/

type Role = 'staff' | 'gm' | 'hqo';
type TabKey = 'dashboard' | 'tasks' | 'transit' | 'students' | 'dtr';
type AttStatus = 'off' | 'working' | 'break' | 'transit' | 'visiting' | 'out';
type Category = 'ドキュメント' | '対外訪問' | '設備管理' | '会計' | 'レッスン' | 'その他';
type ApprovalType = 'HQO' | 'GM';
type ApprovalStatus = 'pending' | 'approved' | 'revision' | 'rejected';
type BlockerReason = 'gov' | 'jpdocs' | 'network' | 'overload';
type TransitPhase = 'none' | 'transit' | 'arrived' | 'done';
type TaskStatus = 'todo' | 'in_progress' | 'done';
type Tone = 'info' | 'ok' | 'warn' | 'danger';
type Period = 'today' | 'week' | 'month';

interface Staff {
  id: string;
  name: string;
  title: string;
  avatar: string;
}

interface GeoFix {
  lat: number;
  lng: number;
  accuracy: number;
  distance: number;
  at: number;
}

interface BreakSpan {
  start: number;
  end?: number;
}

interface Attendance {
  status: AttStatus;
  clockIn?: number;
  clockOut?: number;
  breaks: BreakSpan[];
  lastFix?: GeoFix;
  lastPing?: number;
}

interface Milestone {
  id: string;
  label: string;
  due: string; // YYYY-MM-DD
  done: boolean;
  doneAt?: number;
}

interface Blocker {
  reason: BlockerReason;
  at: number;
  by: string;
}

interface Evidence {
  id: string;
  name: string;
  kind: 'photo' | 'file' | 'link';
  at: number;
  url?: string;
  color?: string;
}

interface Approval {
  type: ApprovalType;
  status: ApprovalStatus;
  reason: string;
  note?: string;
  decidedBy?: string;
  decidedAt?: number;
}

interface Task {
  id: string;
  category: Category;
  subCategory: string;
  title: string;
  assigneeId: string;
  createdBy: string;
  dueDate: string;
  milestones: Milestone[];
  requiresOuting: boolean;
  requiresExpense: boolean;
  amount: number;
  approval: Approval | null;
  status: TaskStatus;
  blocker?: Blocker;
  evidence: Evidence[];
  destinationId?: string;
  transitPhase: TransitPhase;
  createdAt: number;
}

interface Destination {
  id: string;
  name: string;
  short: string;
  lat: number;
  lng: number;
  emoji: string;
}

interface VisitLog {
  id: string;
  staffId: string;
  taskId: string;
  destinationId: string;
  departAt: number;
  arriveAt?: number;
  returnAt?: number;
  pin?: { lat: number; lng: number };
}

interface Student {
  id: string;
  name: string;
  ageGroup: 'Kids' | 'Adult';
  levelSystem: 'CEFR' | '英検';
  level: string;
  mode: 'face' | 'online';
  pastLessons: number;
}

interface Slot {
  id: string;
  no: number;
  start: string;
  end: string;
  staffId: string | null;
  studentIds: string[];
}

interface OnlineBooking {
  id: string;
  studentId: string;
  datetime: string; // YYYY-MM-DDTHH:mm
  teamsUrl: string;
  teacherId: string;
}

interface FeedItem {
  id: string;
  at: number;
  text: string;
  tone: Tone;
}

interface Toast {
  id: string;
  text: string;
  tone: Tone;
}

interface DTRRow {
  date: string;
  staffId: string;
  clockIn?: number;
  clockOut?: number;
  breakMin: number;
  outingMin: number;
  workMin: number;
  status: string;
  live?: boolean;
}

/* ============================================================================
 * Constants & mock master data
 * ==========================================================================*/

const STAFF: Staff[] = [
  { id: 'alyssa', name: 'Alyssa', title: 'Admin / Visa', avatar: '👩🏻' },
  { id: 'mark', name: 'Mark', title: 'Accounting / BIR', avatar: '👨🏽' },
  { id: 'daisy', name: 'Daisy', title: 'Petty Cash / Office', avatar: '👩🏽' },
  { id: 'john', name: 'John', title: 'Banking / Facilities', avatar: '👨🏻' },
  { id: 'maria', name: 'Maria', title: 'Teacher / Lessons', avatar: '👩🏾' },
];

const OFFICE = { lat: 10.3302, lng: 123.9058, name: 'Cebu Office (IT Park)' };
const GEOFENCE_M = 50;

const DESTINATIONS: Destination[] = [
  { id: 'bir', name: 'BIR RDO 81 (Cebu City North)', short: 'BIR', lat: 10.3172, lng: 123.8952, emoji: '🏛️' },
  { id: 'bi', name: 'Bureau of Immigration (Mandaue)', short: 'BI', lat: 10.3362, lng: 123.9402, emoji: '🛂' },
  { id: 'unionbank', name: 'UnionBank Banilad', short: 'UnionBank', lat: 10.3428, lng: 123.9112, emoji: '🏦' },
  { id: 'bdo', name: 'BDO Ayala Center', short: 'BDO', lat: 10.3181, lng: 123.9049, emoji: '🏦' },
  { id: 'parkmall', name: 'Parkmall (Mandaue)', short: 'Parkmall', lat: 10.3256, lng: 123.9331, emoji: '🛒' },
  { id: 'tesda', name: 'TESDA Region VII', short: 'TESDA', lat: 10.3051, lng: 123.8931, emoji: '🎓' },
  { id: 'sm', name: 'SM City Cebu', short: 'SM City', lat: 10.3116, lng: 123.9181, emoji: '🛍️' },
];

const CATEGORIES: Category[] = ['ドキュメント', '対外訪問', '設備管理', '会計', 'レッスン', 'その他'];

const SUBCATEGORIES: Record<Category, string[]> = {
  ドキュメント: ['ビザ申請 (BI / SSP)', 'TESDA手続き', '雇用契約', '社内文書'],
  対外訪問: ['役所訪問', '銀行訪問', '買い出し', '取引先訪問'],
  設備管理: ['修繕', '備品調達', '清掃・点検', 'IT / ネット回線'],
  会計: ['小口現金', '口座出金', '税務申告 (BIR)', '給与', '固定費支払い'],
  レッスン: ['教材準備', '対面レッスン', 'オンラインレッスン', '生徒対応'],
  その他: ['その他'],
};

const CATEGORY_STYLE: Record<Category, string> = {
  ドキュメント: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  対外訪問: 'bg-orange-50 text-orange-700 ring-orange-200',
  設備管理: 'bg-teal-50 text-teal-700 ring-teal-200',
  会計: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  レッスン: 'bg-pink-50 text-pink-700 ring-pink-200',
  その他: 'bg-slate-100 text-slate-700 ring-slate-200',
};

const STATUS_META: Record<AttStatus, { label: string; pill: string; dot: string }> = {
  off: { label: '⚪ 未出勤', pill: 'bg-slate-100 text-slate-600', dot: 'bg-slate-300' },
  working: { label: '🟢 勤務中', pill: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
  break: { label: '☕ 休憩中', pill: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-400' },
  transit: { label: '🚗 移動中', pill: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
  visiting: { label: '📍 訪問先', pill: 'bg-sky-100 text-sky-800', dot: 'bg-sky-500' },
  out: { label: '🏁 退勤済', pill: 'bg-slate-200 text-slate-700', dot: 'bg-slate-500' },
};

const BLOCKERS: Record<BlockerReason, { label: string; short: string }> = {
  gov: { label: '🏛️ 役所待ち', short: '役所待ち' },
  jpdocs: { label: '📄 日本側書類待ち', short: '日本側書類待ち' },
  network: { label: '💻 ネット不調', short: 'ネット不調' },
  overload: { label: '⏳ 業務過多', short: '業務過多' },
};

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const EIKEN_LEVELS = ['5級', '4級', '3級', '準2級', '2級', '準1級', '1級'];

const HQO_THRESHOLD = 15000;

/* ============================================================================
 * Utilities
 * ==========================================================================*/

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

let idCounter = 0;
const uid = (p = 'id') => `${p}_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const todayStr = () => ymd(new Date());
const dayRel = (n: number) => ymd(addDays(new Date(), n));
const atTime = (date: string, hhmm: string) => {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm).getTime();
};
const minsAgo = (m: number) => Date.now() - m * 60000;

const fmtHM = (ts?: number) =>
  ts ? new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '--:--';
const fmtHMS = (ts?: number) =>
  ts ? new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--';
const fmtDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${m}/${d} (${'日月火水木金土'[dt.getDay()]})`;
};
const fmtDuration = (min: number) => `${Math.floor(min / 60)}h ${pad(Math.round(min % 60))}m`;
const fmtPhp = (n: number) => `₱${n.toLocaleString('en-US')}`;
const tzClock = (tz: string, now: number) =>
  new Date(now).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: tz });

const staffName = (id?: string | null) => STAFF.find((s) => s.id === id)?.name ?? '—';
const staffOf = (id: string) => STAFF.find((s) => s.id === id) ?? STAFF[0];
const destOf = (id?: string) => DESTINATIONS.find((d) => d.id === id);

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function offsetPoint(lat: number, lng: number, meters: number, bearing: number) {
  const dLat = (meters * Math.cos(bearing)) / 111320;
  const dLng = (meters * Math.sin(bearing)) / (111320 * Math.cos((lat * Math.PI) / 180));
  return { lat: lat + dLat, lng: lng + dLng };
}

/** 擬似GPS: office モードなら半径0〜35m、outside モードなら120〜650m の位置を返す */
function mockGeoFix(mode: 'office' | 'outside'): GeoFix {
  const meters = mode === 'office' ? Math.random() * 35 : 120 + Math.random() * 530;
  const p = offsetPoint(OFFICE.lat, OFFICE.lng, meters, Math.random() * Math.PI * 2);
  return { ...p, accuracy: Math.round(5 + Math.random() * 10), distance: Math.round(haversine(p, OFFICE)), at: Date.now() };
}

/** 決定的な疑似乱数（DTR履歴モック生成用） */
function seeded(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/** タスク種別に応じた承認ルート自動判定（HQO優先） */
function routeApproval(t: {
  category: Category;
  subCategory: string;
  title: string;
  requiresOuting: boolean;
  requiresExpense: boolean;
  amount: number;
}): { type: ApprovalType; reason: string } | null {
  const text = `${t.category} ${t.subCategory} ${t.title}`.toLowerCase();
  const hqoKw = ['出金', '給与', 'payroll', 'withdraw', '口座', '振込', '固定費', 'salary'];
  const hit = hqoKw.find((k) => text.includes(k));
  if (hit) return { type: 'HQO', reason: `口座出金・給与系（キーワード: ${hit}）` };
  if (t.requiresExpense && t.amount >= HQO_THRESHOLD)
    return { type: 'HQO', reason: `${fmtPhp(HQO_THRESHOLD)} 以上の費用（${fmtPhp(t.amount)}）` };
  const gmKw = ['visa', 'ビザ', 'ssp', 'tesda', '雇用', '契約', '公的', 'bir', 'immigration', '役所'];
  const gmHit = gmKw.find((k) => text.includes(k));
  if (gmHit) return { type: 'GM', reason: `公的手続き・契約（キーワード: ${gmHit.toUpperCase()}）` };
  if (t.requiresOuting) return { type: 'GM', reason: '外出・対外訪問' };
  if (t.requiresExpense) return { type: 'GM', reason: `少額費用（${fmtPhp(t.amount)}）` };
  return null;
}

const isMsDelayed = (m: Milestone) => !m.done && m.due < todayStr();
const isTaskDelayed = (t: Task) =>
  t.status !== 'done' && (t.dueDate < todayStr() || t.milestones.some(isMsDelayed));
const canStartOuting = (t: Task) => !t.approval || t.approval.status === 'approved';

/* ============================================================================
 * Initial mock data
 * ==========================================================================*/

function ms(label: string, due: string, done = false): Milestone {
  return { id: uid('ms'), label, due, done, doneAt: done ? minsAgo(60 * 24) : undefined };
}

function makeTask(p: Partial<Task> & Pick<Task, 'category' | 'subCategory' | 'title' | 'assigneeId' | 'dueDate'>): Task {
  const base: Task = {
    id: uid('task'),
    createdBy: p.assigneeId,
    milestones: [],
    requiresOuting: false,
    requiresExpense: false,
    amount: 0,
    approval: null,
    status: 'in_progress',
    evidence: [],
    transitPhase: 'none',
    createdAt: minsAgo(60 * 24 * 3),
    ...p,
  };
  if (p.approval === undefined) {
    const r = routeApproval(base);
    base.approval = r ? { ...r, status: 'pending' } : null;
  }
  return base;
}

function initialTasks(): Task[] {
  return [
    makeTask({
      category: 'ドキュメント',
      subCategory: 'ビザ申請 (BI / SSP)',
      title: 'BI Visa SSP申請（新入生 Yamada Taro）',
      assigneeId: 'alyssa',
      dueDate: dayRel(4),
      requiresOuting: true,
      destinationId: 'bi',
      milestones: [
        ms('必要書類リスト確認', dayRel(-4), true),
        ms('日本側パスポートコピー受領', dayRel(-1)),
        ms('BI窓口へ提出', dayRel(2)),
        ms('SSP受領・生徒へ連絡', dayRel(4)),
      ],
    }),
    makeTask({
      category: '会計',
      subCategory: '税務申告 (BIR)',
      title: 'BIR税務申告（月次 2550M / 1601C）',
      assigneeId: 'mark',
      dueDate: dayRel(1),
      requiresOuting: true,
      destinationId: 'bir',
      approval: { type: 'GM', status: 'approved', reason: '公的手続き・契約（キーワード: BIR）', decidedBy: 'GM', decidedAt: minsAgo(300) },
      transitPhase: 'transit',
      milestones: [ms('売上・源泉データ集計', dayRel(-2), true), ms('申告書作成 (eBIRForms)', dayRel(0), true), ms('BIR窓口提出・受領印', dayRel(1))],
    }),
    makeTask({
      category: '会計',
      subCategory: '小口現金',
      title: '小口現金まとめ（Petty Cash 週次精算）',
      assigneeId: 'daisy',
      dueDate: dayRel(0),
      milestones: [ms('レシート回収', dayRel(-2), true), ms('Excel入力・科目仕訳', dayRel(-1)), ms('残高照合・GMへ報告', dayRel(0))],
      blocker: { reason: 'overload', at: minsAgo(95), by: 'Daisy' },
    }),
    makeTask({
      category: '会計',
      subCategory: '固定費支払い',
      title: 'UnionBank固定費支払い（家賃・電気・ネット）',
      assigneeId: 'john',
      dueDate: dayRel(2),
      requiresExpense: true,
      requiresOuting: true,
      amount: 85400,
      destinationId: 'unionbank',
      milestones: [ms('請求書取りまとめ', dayRel(-1), true), ms('HQO出金承認', dayRel(1)), ms('UnionBank振込実行', dayRel(2))],
    }),
    makeTask({
      category: '設備管理',
      subCategory: '修繕',
      title: '教室エアコン修理（業者見積 2社）',
      assigneeId: 'john',
      dueDate: dayRel(5),
      requiresExpense: true,
      amount: 18500,
      milestones: [ms('見積取得', dayRel(1)), ms('業者手配', dayRel(3)), ms('修理完了確認', dayRel(5))],
    }),
    makeTask({
      category: 'ドキュメント',
      subCategory: '雇用契約',
      title: '新規講師 雇用契約書レビュー',
      assigneeId: 'alyssa',
      dueDate: dayRel(3),
      milestones: [ms('契約書ドラフト作成', dayRel(1)), ms('GMレビュー', dayRel(2)), ms('署名・保管', dayRel(3))],
    }),
    makeTask({
      category: '対外訪問',
      subCategory: '買い出し',
      title: 'Parkmall 文房具・教材用品の購入',
      assigneeId: 'alyssa',
      dueDate: dayRel(0),
      requiresOuting: true,
      requiresExpense: true,
      amount: 2350,
      destinationId: 'parkmall',
      approval: { type: 'GM', status: 'approved', reason: '外出・対外訪問', decidedBy: 'GM', decidedAt: minsAgo(120) },
      status: 'todo',
      milestones: [ms('購入リスト作成', dayRel(-1), true), ms('Parkmallで購入・領収書受領', dayRel(0))],
    }),
    makeTask({
      category: 'レッスン',
      subCategory: '教材準備',
      title: 'Kidsクラス 対面レッスン教材準備（Week 3）',
      assigneeId: 'maria',
      dueDate: dayRel(1),
      milestones: [ms('ワークシート作成', dayRel(0), true), ms('フラッシュカード印刷', dayRel(1))],
    }),
    makeTask({
      category: 'ドキュメント',
      subCategory: 'TESDA手続き',
      title: 'TESDA 講師資格 (TMC) 更新書類提出',
      assigneeId: 'maria',
      dueDate: dayRel(-1),
      requiresOuting: true,
      destinationId: 'tesda',
      milestones: [ms('申請書記入', dayRel(-3), true), ms('TESDA窓口提出', dayRel(-1))],
    }),
  ];
}

function initialAttendance(): Record<string, Attendance> {
  const t = todayStr();
  return {
    alyssa: { status: 'off', breaks: [] },
    mark: {
      status: 'transit',
      clockIn: atTime(t, '07:56'),
      breaks: [],
      lastFix: { ...OFFICE, accuracy: 8, distance: 12, at: atTime(t, '07:56') },
      lastPing: Date.now(),
    },
    daisy: {
      status: 'break',
      clockIn: atTime(t, '08:04'),
      breaks: [{ start: minsAgo(12) }],
      lastFix: { ...OFFICE, accuracy: 6, distance: 21, at: atTime(t, '08:04') },
    },
    john: {
      status: 'working',
      clockIn: atTime(t, '07:49'),
      breaks: [],
      lastFix: { ...OFFICE, accuracy: 9, distance: 8, at: atTime(t, '07:49') },
      lastPing: Date.now(),
    },
    maria: {
      status: 'working',
      clockIn: atTime(t, '07:41'),
      breaks: [],
      lastFix: { ...OFFICE, accuracy: 7, distance: 30, at: atTime(t, '07:41') },
      lastPing: Date.now(),
    },
  };
}

function initialStudents(): Student[] {
  return [
    { id: 'st_yamada', name: 'Yamada Taro', ageGroup: 'Adult', levelSystem: 'CEFR', level: 'A2', mode: 'face', pastLessons: 5 },
    { id: 'st_kato', name: 'Ken Kato', ageGroup: 'Adult', levelSystem: 'CEFR', level: 'B1', mode: 'online', pastLessons: 1 },
    { id: 'st_sato', name: 'Sato Hana', ageGroup: 'Kids', levelSystem: '英検', level: '4級', mode: 'face', pastLessons: 3 },
    { id: 'st_suzuki', name: 'Suzuki Yui', ageGroup: 'Kids', levelSystem: '英検', level: '3級', mode: 'online', pastLessons: 0 },
    { id: 'st_tanaka', name: 'Tanaka Ryo', ageGroup: 'Adult', levelSystem: 'CEFR', level: 'B2', mode: 'face', pastLessons: 8 },
  ];
}

function initialSlots(): Slot[] {
  const times: Array<[string, string]> = [
    ['08:00', '09:00'],
    ['09:00', '10:00'],
    ['10:00', '11:00'],
    ['11:00', '12:00'],
    ['13:00', '14:00'],
    ['14:00', '15:00'],
  ];
  return times.map(([start, end], i) => ({
    id: `slot_${i + 1}`,
    no: i + 1,
    start,
    end,
    staffId: i === 0 ? 'alyssa' : i === 2 ? 'maria' : i === 4 ? 'maria' : null,
    studentIds: i === 0 ? ['st_yamada'] : i === 2 ? ['st_sato'] : i === 4 ? ['st_tanaka'] : [],
  }));
}

function initialBookings(): OnlineBooking[] {
  return [
    { id: 'bk_1', studentId: 'st_kato', datetime: `${dayRel(-14)}T16:00`, teamsUrl: 'https://teams.microsoft.com/l/meetup-join/cebu-kato-01', teacherId: 'alyssa' },
    { id: 'bk_2', studentId: 'st_kato', datetime: `${dayRel(0)}T16:00`, teamsUrl: 'https://teams.microsoft.com/l/meetup-join/cebu-kato-02', teacherId: 'alyssa' },
    { id: 'bk_3', studentId: 'st_suzuki', datetime: `${dayRel(0)}T17:00`, teamsUrl: 'https://teams.microsoft.com/l/meetup-join/cebu-suzuki-01', teacherId: 'maria' },
    { id: 'bk_4', studentId: 'st_kato', datetime: `${dayRel(7)}T16:00`, teamsUrl: 'https://teams.microsoft.com/l/meetup-join/cebu-kato-03', teacherId: 'alyssa' },
  ];
}

function buildHistory(): DTRRow[] {
  const rows: DTRRow[] = [];
  const today = startOfDay(new Date());
  for (let i = 40; i >= 1; i--) {
    const d = addDays(today, -i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const date = ymd(d);
    for (const s of STAFF) {
      const r = seeded(s.id + date);
      if (r() < 0.04) {
        rows.push({ date, staffId: s.id, breakMin: 0, outingMin: 0, workMin: 0, status: 'Absent' });
        continue;
      }
      const inMin = 7 * 60 + 38 + Math.floor(r() * 36);
      const outMin = 17 * 60 + Math.floor(r() * 50);
      const breakMin = 50 + Math.floor(r() * 20);
      const outingMin = r() < 0.3 ? 30 + Math.floor(r() * 100) : 0;
      const clockIn = d.getTime() + inMin * 60000;
      const clockOut = d.getTime() + outMin * 60000;
      rows.push({
        date,
        staffId: s.id,
        clockIn,
        clockOut,
        breakMin,
        outingMin,
        workMin: outMin - inMin - breakMin,
        status: inMin > 8 * 60 + 5 ? 'Late' : 'Present',
      });
    }
  }
  return rows;
}

/* ============================================================================
 * App context
 * ==========================================================================*/

interface AppCtx {
  role: Role;
  me: Staff;
  actorLabel: string;
  now: number;
  attendance: Record<string, Attendance>;
  tasks: Task[];
  visits: VisitLog[];
  students: Student[];
  slots: Slot[];
  bookings: OnlineBooking[];
  feed: FeedItem[];
  history: DTRRow[];
  gpsMode: 'office' | 'outside';
  gpsBusy: boolean;
  slotPops: Record<string, number>;
  setGpsMode: (m: 'office' | 'outside') => void;
  setTab: (t: TabKey) => void;
  openAddTask: () => void;
  clockIn: () => void;
  clockOut: () => void;
  breakStart: () => void;
  breakEnd: () => void;
  toggleMilestone: (taskId: string, msId: string) => void;
  reportBlocker: (taskId: string, reason: BlockerReason) => void;
  clearBlocker: (taskId: string) => void;
  attachEvidence: (taskId: string, ev: Omit<Evidence, 'id' | 'at'>) => void;
  removeEvidence: (taskId: string, evId: string) => void;
  completeTask: (taskId: string) => void;
  reopenTask: (taskId: string) => void;
  decide: (taskId: string, decision: Exclude<ApprovalStatus, 'pending'>, note?: string) => void;
  resubmit: (taskId: string, amount?: number) => void;
  depart: (taskId: string, destId: string) => void;
  arrive: (taskId: string) => void;
  finishVisit: (taskId: string, receipt: Omit<Evidence, 'id' | 'at'>) => void;
  addStudent: (s: Omit<Student, 'id'>) => void;
  removeStudent: (id: string) => void;
  setSlotStaff: (slotId: string, staffId: string | null) => void;
  addSlotStudent: (slotId: string, studentId: string) => void;
  removeSlotStudent: (slotId: string, studentId: string) => void;
  addBooking: (b: Omit<OnlineBooking, 'id'>) => void;
  removeBooking: (id: string) => void;
  lessonNo: (b: OnlineBooking) => number;
  toast: (text: string, tone?: Tone) => void;
}

const Ctx = createContext<AppCtx | null>(null);
const useApp = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('AppCtx missing');
  return c;
};

/* ============================================================================
 * Root component
 * ==========================================================================*/

export default function CebuSyncApp() {
  const [role, setRole] = useState<Role>('staff');
  const [meId, setMeId] = useState('alyssa');
  const [tab, setTab] = useState<TabKey>('dashboard');
  const [now, setNow] = useState(Date.now());
  const [attendance, setAttendance] = useState<Record<string, Attendance>>(initialAttendance);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [visits, setVisits] = useState<VisitLog[]>(() => [
    { id: 'v_seed_1', staffId: 'mark', taskId: '', destinationId: 'bir', departAt: minsAgo(18) },
    {
      id: 'v_seed_0',
      staffId: 'john',
      taskId: '',
      destinationId: 'bdo',
      departAt: minsAgo(60 * 26),
      arriveAt: minsAgo(60 * 26 - 22),
      returnAt: minsAgo(60 * 25),
      pin: offsetPoint(10.3181, 123.9049, 15, 1),
    },
  ]);
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [bookings, setBookings] = useState<OnlineBooking[]>(initialBookings);
  const [feed, setFeed] = useState<FeedItem[]>(() => [
    { id: uid('f'), at: minsAgo(18), text: '🚗 Mark が BIR RDO 81 へ出発しました（BIR税務申告）', tone: 'info' },
    { id: uid('f'), at: minsAgo(95), text: '⚠️ Daisy がBlocker申告: ⏳ 業務過多 —「小口現金まとめ」', tone: 'warn' },
    { id: uid('f'), at: minsAgo(120), text: '✅ GM が「Parkmall 文房具・教材用品の購入」を承認しました', tone: 'ok' },
  ]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [history] = useState<DTRRow[]>(buildHistory);
  const [gpsMode, setGpsMode] = useState<'office' | 'outside'>('office');
  const [gpsBusy, setGpsBusy] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [slotPops, setSlotPops] = useState<Record<string, number>>({});

  // Mark の移動ログと BIR タスクを紐付け（初期データ）
  useEffect(() => {
    const bir = tasks.find((t) => t.assigneeId === 'mark' && t.destinationId === 'bir');
    if (bir) setVisits((vs) => vs.map((v) => (v.id === 'v_seed_1' ? { ...v, taskId: bir.id } : v)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 1秒ごとの時計
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // 位置情報トラッキング（勤務中・移動中・訪問中のみ ping。休憩中・退勤後は停止）
  useEffect(() => {
    const t = setInterval(() => {
      setAttendance((prev) => {
        const next = { ...prev };
        for (const id of Object.keys(next)) {
          const a = next[id];
          if (a.status === 'working' || a.status === 'transit' || a.status === 'visiting') {
            next[id] = { ...a, lastPing: Date.now() };
          }
        }
        return next;
      });
    }, 5000);
    return () => clearInterval(t);
  }, []);

  const me = staffOf(meId);
  const actorLabel = role === 'staff' ? me.name : role === 'gm' ? 'GM' : 'HQO';

  const toast = (text: string, tone: Tone = 'info') => {
    const id = uid('toast');
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  };
  const pushFeed = (text: string, tone: Tone = 'info') =>
    setFeed((f) => [{ id: uid('f'), at: Date.now(), text, tone }, ...f].slice(0, 40));

  const patchAtt = (id: string, fn: (a: Attendance) => Attendance) =>
    setAttendance((prev) => ({ ...prev, [id]: fn(prev[id]) }));
  const patchTask = (id: string, fn: (t: Task) => Task) => setTasks((ts) => ts.map((t) => (t.id === id ? fn(t) : t)));

  /* ---------- Attendance ---------- */
  const clockIn = () => {
    const a = attendance[meId];
    if (a.status !== 'off' && a.status !== 'out') return;
    setGpsBusy(true);
    setTimeout(() => {
      const fix = mockGeoFix(gpsMode);
      setGpsBusy(false);
      if (fix.distance <= GEOFENCE_M) {
        patchAtt(meId, () => ({ status: 'working', clockIn: Date.now(), breaks: [], lastFix: fix, lastPing: Date.now() }));
        pushFeed(`🟢 ${me.name} が出勤打刻しました（事務所から ${fix.distance}m）`, 'ok');
        toast(`Clock-In 完了 — 事務所から ${fix.distance}m（±${fix.accuracy}m）`, 'ok');
      } else {
        patchAtt(meId, (x) => ({ ...x, lastFix: fix }));
        toast(`打刻不可: 事務所から ${fix.distance}m。半径${GEOFENCE_M}m以内で再試行してください`, 'danger');
      }
    }, 1100);
  };

  const clockOut = () => {
    const a = attendance[meId];
    if (a.status === 'transit' || a.status === 'visiting') {
      toast('外出中は退勤できません。先に訪問を完了してください', 'warn');
      return;
    }
    if (a.status !== 'working' && a.status !== 'break') return;
    patchAtt(meId, (x) => ({
      ...x,
      status: 'out',
      clockOut: Date.now(),
      breaks: x.breaks.map((b) => (b.end ? b : { ...b, end: Date.now() })),
      lastFix: undefined,
      lastPing: undefined,
    }));
    pushFeed(`🏁 ${me.name} が退勤しました`, 'info');
    toast('Clock-Out 完了 — 位置情報の取得を完全に停止しました', 'ok');
  };

  const breakStart = () => {
    if (attendance[meId].status !== 'working') return;
    patchAtt(meId, (x) => ({ ...x, status: 'break', breaks: [...x.breaks, { start: Date.now() }], lastPing: undefined }));
    pushFeed(`☕ ${me.name} が休憩に入りました`, 'info');
    toast('☕ 休憩開始 — 位置情報トラッキングを一時停止しました', 'info');
  };

  const breakEnd = () => {
    if (attendance[meId].status !== 'break') return;
    patchAtt(meId, (x) => ({
      ...x,
      status: 'working',
      breaks: x.breaks.map((b) => (b.end ? b : { ...b, end: Date.now() })),
      lastPing: Date.now(),
    }));
    pushFeed(`🟢 ${me.name} が休憩から業務に復帰しました`, 'info');
    toast('休憩終了 — トラッキングを再開しました', 'ok');
  };

  /* ---------- Tasks ---------- */
  const addTask = (t: Task) => {
    setTasks((ts) => [t, ...ts]);
    pushFeed(
      `🆕 ${staffName(t.createdBy) !== '—' ? staffName(t.createdBy) : actorLabel} が新規タスクを起票:「${t.title}」${
        t.approval ? `（${t.approval.type}承認トレイへ）` : ''
      }`,
      'info',
    );
    toast(t.approval ? `タスクを登録し「${t.approval.type === 'HQO' ? 'HQO出金承認' : 'GM統括承認'}」トレイへ送信しました` : 'タスクを登録しました', 'ok');
  };

  const toggleMilestone = (taskId: string, msId: string) =>
    patchTask(taskId, (t) => {
      const milestones = t.milestones.map((m) => (m.id === msId ? { ...m, done: !m.done, doneAt: !m.done ? Date.now() : undefined } : m));
      return { ...t, milestones, status: t.status === 'todo' ? 'in_progress' : t.status };
    });

  const reportBlocker = (taskId: string, reason: BlockerReason) => {
    const t = tasks.find((x) => x.id === taskId);
    patchTask(taskId, (x) => ({ ...x, blocker: { reason, at: Date.now(), by: actorLabel } }));
    pushFeed(`⚠️ ${actorLabel} がBlocker申告: ${BLOCKERS[reason].label} —「${t?.title ?? ''}」`, 'warn');
    toast(`${BLOCKERS[reason].label} をチーム & GMへ即時共有しました`, 'warn');
  };

  const clearBlocker = (taskId: string) => {
    patchTask(taskId, (x) => ({ ...x, blocker: undefined }));
    toast('Blockerを解除しました', 'ok');
  };

  const attachEvidence = (taskId: string, ev: Omit<Evidence, 'id' | 'at'>) => {
    patchTask(taskId, (x) => ({ ...x, evidence: [...x.evidence, { ...ev, id: uid('ev'), at: Date.now() }] }));
    toast(`📎 証跡を添付: ${ev.name}`, 'ok');
  };

  const removeEvidence = (taskId: string, evId: string) =>
    patchTask(taskId, (x) => ({ ...x, evidence: x.evidence.filter((e) => e.id !== evId) }));

  const completeTask = (taskId: string) => {
    const t = tasks.find((x) => x.id === taskId);
    if (!t) return;
    if (t.approval && t.approval.status !== 'approved') {
      toast('承認が完了していないため完了にできません', 'warn');
      return;
    }
    if ((t.requiresExpense || t.requiresOuting) && t.evidence.length === 0) {
      toast('外出・費用タスクは完了前に領収書/書類の証跡添付が必要です', 'warn');
      return;
    }
    patchTask(taskId, (x) => ({
      ...x,
      status: 'done',
      blocker: undefined,
      milestones: x.milestones.map((m) => (m.done ? m : { ...m, done: true, doneAt: Date.now() })),
    }));
    pushFeed(`✅ ${actorLabel} がタスク完了:「${t.title}」（証跡 ${t.evidence.length}件）`, 'ok');
    toast('タスクを完了しました 🎉', 'ok');
  };

  const reopenTask = (taskId: string) => patchTask(taskId, (x) => ({ ...x, status: 'in_progress' }));

  const decide = (taskId: string, decision: Exclude<ApprovalStatus, 'pending'>, note?: string) => {
    const t = tasks.find((x) => x.id === taskId);
    if (!t || !t.approval) return;
    patchTask(taskId, (x) =>
      x.approval ? { ...x, approval: { ...x.approval, status: decision, note, decidedBy: actorLabel, decidedAt: Date.now() } } : x,
    );
    const label = decision === 'approved' ? '✅ 承認' : decision === 'revision' ? '✏️ 修正依頼' : '↩️ 差戻し';
    pushFeed(
      `${label}: ${actorLabel} →「${t.title}」（担当 ${staffName(t.assigneeId)}）${note ? ` 💬 ${note}` : ''}`,
      decision === 'approved' ? 'ok' : decision === 'revision' ? 'warn' : 'danger',
    );
    toast(`${label} しました — ${staffName(t.assigneeId)} に通知`, decision === 'approved' ? 'ok' : 'warn');
  };

  const resubmit = (taskId: string, amount?: number) => {
    const t = tasks.find((x) => x.id === taskId);
    if (!t) return;
    patchTask(taskId, (x) => {
      const next = { ...x, amount: amount ?? x.amount };
      const r = routeApproval(next);
      next.approval = r ? { ...r, status: 'pending' } : null;
      return next;
    });
    pushFeed(`🔁 ${actorLabel} が「${t.title}」を再申請しました`, 'info');
    toast('再申請しました', 'ok');
  };

  /* ---------- Transit ---------- */
  const depart = (taskId: string, destId: string) => {
    const a = attendance[meId];
    const t = tasks.find((x) => x.id === taskId);
    if (!t) return;
    if (a.status !== 'working') {
      toast(a.status === 'break' ? '休憩中は出発できません。休憩を終了してください' : '出勤打刻（Clock-In）後に出発できます', 'warn');
      return;
    }
    if (!canStartOuting(t)) {
      toast('GM承認が完了していないため出発できません', 'warn');
      return;
    }
    const d = destOf(destId);
    patchTask(taskId, (x) => ({ ...x, destinationId: destId, transitPhase: 'transit', status: 'in_progress' }));
    setVisits((v) => [{ id: uid('v'), staffId: meId, taskId, destinationId: destId, departAt: Date.now() }, ...v]);
    patchAtt(meId, (x) => ({ ...x, status: 'transit', lastPing: Date.now() }));
    pushFeed(`🚗 ${me.name} が ${d?.name} へ出発しました（${t.title}）`, 'info');
    toast(`🚗 出発 — ${d?.short} へ移動中`, 'info');
  };

  const arrive = (taskId: string) => {
    const t = tasks.find((x) => x.id === taskId);
    const d = destOf(t?.destinationId);
    if (!t || !d) return;
    const pin = offsetPoint(d.lat, d.lng, Math.random() * 25, Math.random() * Math.PI * 2);
    patchTask(taskId, (x) => ({ ...x, transitPhase: 'arrived' }));
    setVisits((vs) => vs.map((v) => (v.taskId === taskId && !v.arriveAt ? { ...v, arriveAt: Date.now(), pin } : v)));
    patchAtt(meId, (x) => ({
      ...x,
      status: 'visiting',
      lastFix: { ...pin, accuracy: 9, distance: Math.round(haversine(pin, OFFICE)), at: Date.now() },
    }));
    pushFeed(`📍 ${me.name} が ${d.name} に到着チェックイン（${fmtHM(Date.now())}）`, 'info');
    toast(`📍 到着チェックイン — ${d.short} ${fmtHM(Date.now())}`, 'ok');
  };

  const finishVisit = (taskId: string, receipt: Omit<Evidence, 'id' | 'at'>) => {
    const t = tasks.find((x) => x.id === taskId);
    if (!t) return;
    patchTask(taskId, (x) => ({
      ...x,
      transitPhase: 'done',
      status: 'done',
      blocker: undefined,
      evidence: [...x.evidence, { ...receipt, id: uid('ev'), at: Date.now() }],
      milestones: x.milestones.map((m) => (m.done ? m : { ...m, done: true, doneAt: Date.now() })),
    }));
    setVisits((vs) => vs.map((v) => (v.taskId === taskId && !v.returnAt ? { ...v, returnAt: Date.now() } : v)));
    patchAtt(meId, (x) => ({ ...x, status: 'working', lastFix: mockGeoFix('office'), lastPing: Date.now() }));
    pushFeed(`🏢 ${me.name} が帰社しました — 領収書添付 & 完了「${t.title}」`, 'ok');
    toast('📸 領収書を添付してタスク完了 — 事務所へ帰社しました', 'ok');
  };

  /* ---------- Students & Lessons ---------- */
  const addStudent = (s: Omit<Student, 'id'>) => {
    setStudents((ss) => [...ss, { ...s, id: uid('st') }]);
    toast(`🎓 学生を登録しました: ${s.name}`, 'ok');
  };
  const removeStudent = (id: string) => {
    setStudents((ss) => ss.filter((s) => s.id !== id));
    setSlots((sl) => sl.map((s) => ({ ...s, studentIds: s.studentIds.filter((x) => x !== id) })));
    setBookings((bs) => bs.filter((b) => b.studentId !== id));
  };

  const popSlot = (slot: Slot) => {
    if (!slot.staffId || slot.studentIds.length === 0) return;
    setSlotPops((p) => ({ ...p, [slot.id]: Date.now() }));
    toast(`📌 ${staffName(slot.staffId)} の「本日のマイルストーン」に ${slot.no}限 (${slot.start}) のレッスンを自動追加しました`, 'ok');
  };
  const updateSlot = (slotId: string, fn: (s: Slot) => Slot) => {
    const cur = slots.find((s) => s.id === slotId);
    if (!cur) return;
    const next = fn(cur);
    setSlots((sl) => sl.map((s) => (s.id === slotId ? next : s)));
    popSlot(next);
  };
  const setSlotStaff = (slotId: string, staffId: string | null) => updateSlot(slotId, (s) => ({ ...s, staffId }));
  const addSlotStudent = (slotId: string, studentId: string) =>
    updateSlot(slotId, (s) => (s.studentIds.includes(studentId) ? s : { ...s, studentIds: [...s.studentIds, studentId] }));
  const removeSlotStudent = (slotId: string, studentId: string) =>
    setSlots((sl) => sl.map((s) => (s.id === slotId ? { ...s, studentIds: s.studentIds.filter((x) => x !== studentId) } : s)));

  const lessonNo = (b: OnlineBooking) => {
    const st = students.find((s) => s.id === b.studentId);
    const earlier = bookings.filter((x) => x.studentId === b.studentId && x.datetime < b.datetime).length;
    return (st?.pastLessons ?? 0) + earlier + 1;
  };
  const addBooking = (b: Omit<OnlineBooking, 'id'>) => {
    const nb = { ...b, id: uid('bk') };
    setBookings((bs) => [...bs, nb]);
    const st = students.find((s) => s.id === b.studentId);
    const n = (st?.pastLessons ?? 0) + bookings.filter((x) => x.studentId === b.studentId && x.datetime < b.datetime).length + 1;
    toast(`💻 Teamsレッスン予約: ${st?.name} 第${n}回 → ${staffName(b.teacherId)} の画面にタスク表示`, 'ok');
  };
  const removeBooking = (id: string) => setBookings((bs) => bs.filter((b) => b.id !== id));

  const ctx: AppCtx = {
    role,
    me,
    actorLabel,
    now,
    attendance,
    tasks,
    visits,
    students,
    slots,
    bookings,
    feed,
    history,
    gpsMode,
    gpsBusy,
    slotPops,
    setGpsMode,
    setTab,
    openAddTask: () => setShowAddTask(true),
    clockIn,
    clockOut,
    breakStart,
    breakEnd,
    toggleMilestone,
    reportBlocker,
    clearBlocker,
    attachEvidence,
    removeEvidence,
    completeTask,
    reopenTask,
    decide,
    resubmit,
    depart,
    arrive,
    finishVisit,
    addStudent,
    removeStudent,
    setSlotStaff,
    addSlotStudent,
    removeSlotStudent,
    addBooking,
    removeBooking,
    lessonNo,
    toast,
  };

  const gmPending = tasks.filter((t) => t.approval?.type === 'GM' && t.approval.status === 'pending').length;
  const hqoPending = tasks.filter((t) => t.approval?.type === 'HQO' && t.approval.status === 'pending').length;

  const TABS: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }> = [
    { key: 'dashboard', label: 'Dashboard', icon: Building2 },
    {
      key: 'tasks',
      label: 'Tasks & Approval',
      icon: ClipboardList,
      badge: role === 'gm' ? gmPending : role === 'hqo' ? hqoPending : tasks.filter((t) => t.assigneeId === meId && isTaskDelayed(t)).length,
    },
    { key: 'transit', label: 'Transit & Visits', icon: Car },
    { key: 'students', label: 'Students & Lessons', icon: GraduationCap },
    { key: 'dtr', label: 'Work Log (DTR)', icon: BarChart3 },
  ];

  return (
    <Ctx.Provider value={ctx}>
      <div className="min-h-screen bg-slate-100 text-slate-800 font-sans">
        {/* ---------- Header + Role bar ---------- */}
        <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 mr-auto">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-emerald-400 flex items-center justify-center font-black text-slate-900">
                CS
              </div>
              <div>
                <div className="font-bold leading-tight tracking-wide">
                  Cebu Sync <span className="ml-1 text-xs font-medium bg-sky-500 text-white px-1.5 py-0.5 rounded">Phase 1</span>
                </div>
                <div className="text-xs text-slate-400 leading-tight">Cebu Office Remote Management</div>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-3 text-xs font-mono text-slate-300">
              <span>🇵🇭 Cebu {tzClock('Asia/Manila', now)}</span>
              <span className="text-slate-600">|</span>
              <span>🇯🇵 Tokyo {tzClock('Asia/Tokyo', now)}</span>
            </div>
            <div className="flex items-center gap-1 bg-slate-800 rounded-xl p-1">
              <div
                className={cx(
                  'flex items-center rounded-lg text-sm transition',
                  role === 'staff' ? 'bg-white text-slate-900 shadow' : 'text-slate-300 hover:bg-slate-700',
                )}
              >
                <button className="pl-3 pr-1 py-1.5 font-medium" onClick={() => setRole('staff')}>
                  👤 {me.name} <span className="opacity-60">(Staff)</span>
                </button>
                <select
                  aria-label="スタッフ切替"
                  value={meId}
                  onChange={(e) => {
                    setMeId(e.target.value);
                    setRole('staff');
                  }}
                  className="bg-transparent text-xs pr-1 py-1.5 outline-none cursor-pointer w-5"
                >
                  {STAFF.map((s) => (
                    <option key={s.id} value={s.id} className="text-slate-900">
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <RoleButton active={role === 'gm'} onClick={() => setRole('gm')} badge={gmPending}>
                👔 GM <span className="opacity-60">(Japan)</span>
              </RoleButton>
              <RoleButton active={role === 'hqo'} onClick={() => setRole('hqo')} badge={hqoPending}>
                🏦 HQO <span className="opacity-60">(Finance)</span>
              </RoleButton>
            </div>
          </div>
          <nav className="bg-white text-slate-700 border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-2 flex overflow-x-auto">
              {TABS.map(({ key, label, icon: Icon, badge }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={cx(
                    'flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition',
                    tab === key ? 'border-sky-500 text-sky-700' : 'border-transparent hover:text-slate-900 hover:bg-slate-50',
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                  {!!badge && <span className="ml-1 text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5 leading-none">{badge}</span>}
                </button>
              ))}
            </div>
          </nav>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-6">
          {tab === 'dashboard' && <DashboardTab />}
          {tab === 'tasks' && <TasksTab />}
          {tab === 'transit' && <TransitTab />}
          {tab === 'students' && <StudentsTab />}
          {tab === 'dtr' && <DTRTab />}
        </main>

        <footer className="text-center text-xs text-slate-400 pb-8">
          Cebu Sync Phase 1 — mock data only · GPS / Teams / CSV はシミュレーション
        </footer>

        {showAddTask && <AddTaskModal onClose={() => setShowAddTask(false)} onSubmit={(t) => { addTask(t); setShowAddTask(false); }} />}

        {/* ---------- Toasts ---------- */}
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80 max-w-full">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={cx(
                'rounded-xl shadow-lg px-4 py-3 text-sm text-white flex items-start gap-2',
                t.tone === 'ok' && 'bg-emerald-600',
                t.tone === 'info' && 'bg-slate-800',
                t.tone === 'warn' && 'bg-orange-500',
                t.tone === 'danger' && 'bg-red-600',
              )}
            >
              <Bell className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{t.text}</span>
            </div>
          ))}
        </div>
      </div>
    </Ctx.Provider>
  );
}

function RoleButton({ active, onClick, badge, children }: { active: boolean; onClick: () => void; badge?: number; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'relative px-3 py-1.5 rounded-lg text-sm font-medium transition',
        active ? 'bg-white text-slate-900 shadow' : 'text-slate-300 hover:bg-slate-700',
      )}
    >
      {children}
      {!!badge && (
        <span className="absolute -top-1 -right-1 text-xs bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center leading-none">
          {badge}
        </span>
      )}
    </button>
  );
}

/* ============================================================================
 * Shared UI pieces
 * ==========================================================================*/

function Card({ title, icon, right, children, className }: { title?: React.ReactNode; icon?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx('bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 min-w-0', className)}>
      {title && (
        <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-slate-100">
          {icon}
          <h2 className="font-semibold text-slate-800">{title}</h2>
          <div className="ml-auto">{right}</div>
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

function StatusPill({ status }: { status: AttStatus }) {
  const m = STATUS_META[status];
  return <span className={cx('text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap', m.pill)}>{m.label}</span>;
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ring-1 whitespace-nowrap', className)}>{children}</span>;
}

function ApprovalBadge({ approval }: { approval: Approval | null }) {
  if (!approval) return null;
  const tray = approval.type === 'HQO' ? '🏦 HQO' : '👔 GM';
  if (approval.status === 'pending') return <Badge className="bg-yellow-50 text-yellow-800 ring-yellow-300">⏳ 要承認 · {tray}</Badge>;
  if (approval.status === 'approved') return <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">✅ 承認済 · {tray}</Badge>;
  if (approval.status === 'revision') return <Badge className="bg-orange-50 text-orange-700 ring-orange-300">✏️ 修正依頼 · {tray}</Badge>;
  return <Badge className="bg-red-50 text-red-700 ring-red-300">↩️ 差戻し · {tray}</Badge>;
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-slate-400 text-center py-6">{children}</div>;
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        className={cx('bg-white rounded-2xl shadow-2xl w-full my-8', wide ? 'max-w-3xl' : 'max-w-xl')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-lg">{title}</h3>
          <button onClick={onClose} className="ml-auto p-1 rounded-lg hover:bg-slate-100" aria-label="閉じる">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 bg-white';
const labelCls = 'block text-xs font-semibold text-slate-500 mb-1';
const btn = {
  primary: 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed transition',
  dark: 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed transition',
  ghost: 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-white ring-1 ring-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed transition',
  green: 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed transition',
  yellow: 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-slate-900 text-sm font-semibold px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed transition',
  orange: 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed transition',
  red: 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed transition',
};

const MOCK_COLORS = ['bg-amber-200', 'bg-sky-200', 'bg-emerald-200', 'bg-pink-200', 'bg-violet-200'];
const mockPhotoName = (prefix: string) => {
  const d = new Date();
  return `${prefix}_${ymd(d).replace(/-/g, '')}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.jpg`;
};

/* ============================================================================
 * Tab 1: Dashboard
 * ==========================================================================*/

function useAlerts() {
  const { tasks, attendance, role, me, now } = useApp();
  return useMemo(() => {
    const items: Array<{ id: string; tone: Tone; text: string }> = [];
    const mine = (t: Task) => role !== 'staff' || t.assigneeId === me.id;
    for (const t of tasks) {
      if (isTaskDelayed(t) && mine(t))
        items.push({ id: `d_${t.id}`, tone: 'danger', text: `⚠️ Delayed:「${t.title}」（${staffName(t.assigneeId)}）` });
      if (t.blocker && t.status !== 'done')
        items.push({ id: `b_${t.id}`, tone: 'warn', text: `${BLOCKERS[t.blocker.reason].label}:「${t.title}」— ${t.blocker.by} が申告` });
      if (t.approval?.status === 'pending') {
        if ((role === 'gm' && t.approval.type === 'GM') || (role === 'hqo' && t.approval.type === 'HQO'))
          items.push({ id: `a_${t.id}`, tone: 'info', text: `📝 承認待ち:「${t.title}」${t.requiresExpense ? fmtPhp(t.amount) : ''}` });
      }
      if (role === 'staff' && t.assigneeId === me.id && t.approval && (t.approval.status === 'revision' || t.approval.status === 'rejected'))
        items.push({
          id: `r_${t.id}`,
          tone: 'warn',
          text: `${t.approval.status === 'revision' ? '✏️ 修正依頼' : '↩️ 差戻し'}（${t.approval.decidedBy}）:「${t.title}」${t.approval.note ? ` — ${t.approval.note}` : ''}`,
        });
    }
    if (role !== 'staff') {
      const d = new Date(now);
      if (d.getHours() * 60 + d.getMinutes() > 8 * 60 + 15) {
        for (const s of STAFF) if (attendance[s.id].status === 'off') items.push({ id: `late_${s.id}`, tone: 'warn', text: `⏰ ${s.name} が未出勤（8:15超過）` });
      }
      for (const s of STAFF) {
        const b = attendance[s.id].breaks.find((x) => !x.end);
        if (b && now - b.start > 75 * 60000) items.push({ id: `brk_${s.id}`, tone: 'warn', text: `☕ ${s.name} の休憩が75分を超過` });
      }
    }
    const order: Record<Tone, number> = { danger: 0, warn: 1, info: 2, ok: 3 };
    return items.sort((a, b) => order[a.tone] - order[b.tone]);
  }, [tasks, attendance, role, me.id, now]);
}

function DashboardTab() {
  const { role, attendance, tasks } = useApp();
  const alerts = useAlerts();
  const working = STAFF.filter((s) => ['working', 'transit', 'visiting', 'break'].includes(attendance[s.id].status)).length;
  const delayed = tasks.filter(isTaskDelayed).length;
  const blockers = tasks.filter((t) => t.blocker && t.status !== 'done').length;
  const pending = tasks.filter((t) => t.approval?.status === 'pending' && (role === 'staff' || t.approval.type === (role === 'gm' ? 'GM' : 'HQO'))).length;

  return (
    <div className="space-y-6">
      {role === 'staff' ? (
        <div className="grid lg:grid-cols-3 gap-6">
          <AttendanceCard />
          <MyTodayCard />
          <AlertsCard alerts={alerts} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi label="出勤中 (Present)" value={`${working} / ${STAFF.length}`} tone="green" icon={<Users className="w-5 h-5" />} />
            <Kpi label="遅延タスク (Delayed)" value={delayed} tone="red" icon={<AlertTriangle className="w-5 h-5" />} />
            <Kpi label="Blocker 申告中" value={blockers} tone="orange" icon={<Radio className="w-5 h-5" />} />
            <Kpi label={role === 'gm' ? 'GM統括承認 待ち' : 'HQO出金承認 待ち'} value={pending} tone="yellow" icon={<Shield className="w-5 h-5" />} />
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <AlertsCard alerts={alerts} />
            </div>
            <FeedCard />
          </div>
        </>
      )}
      <TeamBoard />
      {role === 'staff' && <FeedCard />}
    </div>
  );
}

function Kpi({ label, value, tone, icon }: { label: string; value: React.ReactNode; tone: 'green' | 'red' | 'orange' | 'yellow'; icon: React.ReactNode }) {
  const c = {
    green: 'from-emerald-500 to-emerald-600',
    red: 'from-red-500 to-red-600',
    orange: 'from-orange-400 to-orange-500',
    yellow: 'from-yellow-400 to-amber-500',
  }[tone];
  return (
    <div className={cx('rounded-2xl p-4 text-white shadow-sm bg-gradient-to-br', c)}>
      <div className="flex items-center justify-between opacity-90 text-xs font-semibold">
        {label}
        {icon}
      </div>
      <div className="text-3xl font-black mt-2">{value}</div>
    </div>
  );
}

function AttendanceCard() {
  const { me, attendance, now, clockIn, clockOut, breakStart, breakEnd, gpsBusy, gpsMode, setGpsMode, setTab } = useApp();
  const a = attendance[me.id];
  const tracking = a.status === 'working' || a.status === 'transit' || a.status === 'visiting';
  const breakMin = a.breaks.reduce((s, b) => s + ((b.end ?? now) - b.start) / 60000, 0);
  const workMin = a.clockIn ? Math.max(0, ((a.clockOut ?? now) - a.clockIn) / 60000 - breakMin) : 0;
  const onBreak = a.breaks.find((b) => !b.end);

  return (
    <Card
      title="勤怠 · Work Log Record"
      icon={<Clock className="w-5 h-5 text-sky-600" />}
      right={<StatusPill status={a.status} />}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="text-4xl">{me.avatar}</div>
        <div>
          <div className="font-bold text-lg leading-tight">{me.name}</div>
          <div className="text-xs text-slate-500">{me.title}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-xs text-slate-400">実働</div>
          <div className="font-mono font-bold text-xl">{fmtDuration(workMin)}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs mb-4">
        <div className="bg-slate-50 rounded-lg py-2">
          <div className="text-slate-400">Clock-In</div>
          <div className="font-mono font-semibold text-sm">{fmtHM(a.clockIn)}</div>
        </div>
        <div className="bg-slate-50 rounded-lg py-2">
          <div className="text-slate-400">休憩</div>
          <div className="font-mono font-semibold text-sm">{Math.round(breakMin)}分</div>
        </div>
        <div className="bg-slate-50 rounded-lg py-2">
          <div className="text-slate-400">Clock-Out</div>
          <div className="font-mono font-semibold text-sm">{fmtHM(a.clockOut)}</div>
        </div>
      </div>

      {(a.status === 'off' || a.status === 'out') && (
        <>
          <button onClick={clockIn} disabled={gpsBusy} className={cx(btn.green, 'w-full py-3 text-base')}>
            {gpsBusy ? (
              <>
                <Navigation className="w-5 h-5 animate-pulse" /> GPS測位中…
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" /> Clock-In（GPS出勤打刻）
              </>
            )}
          </button>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <span>擬似GPS位置:</span>
            <button
              onClick={() => setGpsMode('office')}
              className={cx('px-2 py-1 rounded-md ring-1', gpsMode === 'office' ? 'bg-emerald-50 ring-emerald-300 text-emerald-700 font-semibold' : 'ring-slate-200')}
            >
              🏢 事務所内
            </button>
            <button
              onClick={() => setGpsMode('outside')}
              className={cx('px-2 py-1 rounded-md ring-1', gpsMode === 'outside' ? 'bg-red-50 ring-red-300 text-red-700 font-semibold' : 'ring-slate-200')}
            >
              🌴 事務所外
            </button>
          </div>
        </>
      )}

      {a.status === 'working' && (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={breakStart} className={btn.yellow}>
            <Coffee className="w-4 h-4" /> 休憩開始
          </button>
          <button onClick={clockOut} className={btn.dark}>
            <LogOut className="w-4 h-4" /> Clock-Out
          </button>
        </div>
      )}

      {a.status === 'break' && (
        <div className="space-y-2">
          <div className="rounded-xl bg-yellow-50 ring-1 ring-yellow-200 p-3 text-sm text-yellow-800 text-center">
            ☕ 休憩中 — {onBreak ? fmtDuration((now - onBreak.start) / 60000) : ''} 経過
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={breakEnd} className={btn.green}>
              <RotateCcw className="w-4 h-4" /> 休憩終了
            </button>
            <button onClick={clockOut} className={btn.dark}>
              <LogOut className="w-4 h-4" /> Clock-Out
            </button>
          </div>
        </div>
      )}

      {(a.status === 'transit' || a.status === 'visiting') && (
        <button onClick={() => setTab('transit')} className={cx(btn.orange, 'w-full')}>
          <Car className="w-4 h-4" /> 外出中 — Transit 画面を開く
        </button>
      )}

      <div
        className={cx(
          'mt-4 rounded-xl p-3 text-xs flex items-start gap-2',
          tracking ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' : 'bg-slate-50 text-slate-500 ring-1 ring-slate-200',
        )}
      >
        <Radio className={cx('w-4 h-4 shrink-0', tracking && 'animate-pulse')} />
        <div>
          <div className="font-semibold">
            📡 位置情報トラッキング: {tracking ? 'ON' : a.status === 'break' ? 'PAUSED（休憩中）' : a.status === 'out' ? 'OFF（退勤後は完全停止）' : 'OFF'}
          </div>
          {a.lastFix && (
            <div className="mt-0.5 font-mono">
              {a.lastFix.lat.toFixed(5)}, {a.lastFix.lng.toFixed(5)} · 事務所から {a.lastFix.distance}m
              {a.lastFix.distance > GEOFENCE_M && a.status === 'off' && <span className="text-red-600 font-semibold"> （範囲外）</span>}
            </div>
          )}
          {tracking && <div className="font-mono">last ping {fmtHMS(a.lastPing)}</div>}
          <div className="opacity-70">ジオフェンス: {OFFICE.name} 半径 {GEOFENCE_M}m</div>
        </div>
      </div>
    </Card>
  );
}

function MyTodayCard() {
  const { me, tasks, slots, bookings, students, slotPops, now, lessonNo, setTab, toggleMilestone } = useApp();
  const today = todayStr();
  const myTasks = tasks.filter((t) => t.assigneeId === me.id && t.status !== 'done');
  const msItems = myTasks.flatMap((t) => t.milestones.filter((m) => !m.done && m.due <= today).map((m) => ({ t, m })));
  const mySlots = slots.filter((s) => s.staffId === me.id && s.studentIds.length > 0);
  const myOnline = bookings.filter((b) => b.teacherId === me.id && b.datetime.startsWith(today)).sort((a, b) => a.datetime.localeCompare(b.datetime));
  const total = msItems.length + mySlots.length + myOnline.length;

  return (
    <Card title="本日のマイルストーン" icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />} right={<span className="text-xs text-slate-400">{total}件</span>}>
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {mySlots.map((s) => {
          const isNew = slotPops[s.id] && now - slotPops[s.id] < 60000;
          return (
            <div key={s.id} className={cx('rounded-xl p-3 ring-1 flex gap-3 items-start', isNew ? 'bg-pink-50 ring-pink-300 animate-pulse' : 'bg-pink-50 ring-pink-100')}>
              <GraduationCap className="w-5 h-5 text-pink-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-sm font-semibold">
                  🎓 対面レッスン {s.no}限 {s.start}–{s.end}
                  {isNew && <span className="ml-2 text-xs bg-pink-600 text-white rounded px-1.5 py-0.5">NEW 自動追加</span>}
                </div>
                <div className="text-xs text-slate-600 truncate">
                  {s.studentIds.map((id) => students.find((x) => x.id === id)?.name).filter(Boolean).join(', ')}
                </div>
              </div>
            </div>
          );
        })}
        {myOnline.map((b) => {
          const st = students.find((s) => s.id === b.studentId);
          return (
            <div key={b.id} className="rounded-xl p-3 ring-1 ring-violet-200 bg-violet-50 flex gap-3 items-center">
              <Video className="w-5 h-5 text-violet-600 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">
                  💻 オンライン {b.datetime.slice(11)} · {st?.name} <span className="text-violet-700">第{lessonNo(b)}回</span>
                </div>
                <div className="text-xs text-slate-500 truncate">{b.teamsUrl}</div>
              </div>
              <a href={b.teamsUrl} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-2.5 py-1.5">
                Teams会議に参加
              </a>
            </div>
          );
        })}
        {msItems.map(({ t, m }) => {
          const late = isMsDelayed(m);
          return (
            <div key={m.id} className={cx('rounded-xl p-3 ring-1 flex gap-3 items-start', late ? 'bg-red-50 ring-red-200' : 'bg-slate-50 ring-slate-200')}>
              <button
                onClick={() => toggleMilestone(t.id, m.id)}
                className="w-5 h-5 rounded-md ring-2 ring-slate-300 bg-white shrink-0 mt-0.5 hover:ring-emerald-500"
                aria-label="完了にする"
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold">
                  {m.label} {late && <span className="text-xs text-red-600 font-bold ml-1">⚠️ Delayed（期日 {fmtDate(m.due)}）</span>}
                </div>
                <div className="text-xs text-slate-500 truncate">{t.title}</div>
              </div>
            </div>
          );
        })}
        {total === 0 && <EmptyState>本日の予定はありません 🎉</EmptyState>}
      </div>
      <button onClick={() => setTab('tasks')} className={cx(btn.ghost, 'w-full mt-3')}>
        <ClipboardList className="w-4 h-4" /> すべてのタスクを見る
      </button>
    </Card>
  );
}

function AlertsCard({ alerts }: { alerts: Array<{ id: string; tone: Tone; text: string }> }) {
  return (
    <Card title="アラート一覧" icon={<AlertTriangle className="w-5 h-5 text-orange-500" />} right={<span className="text-xs text-slate-400">{alerts.length}件</span>}>
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {alerts.map((a) => (
          <div
            key={a.id}
            className={cx(
              'text-sm rounded-lg px-3 py-2 border-l-4',
              a.tone === 'danger' && 'bg-red-50 border-red-500 text-red-800',
              a.tone === 'warn' && 'bg-orange-50 border-orange-400 text-orange-800',
              a.tone === 'info' && 'bg-yellow-50 border-yellow-400 text-yellow-900',
              a.tone === 'ok' && 'bg-emerald-50 border-emerald-500 text-emerald-800',
            )}
          >
            {a.text}
          </div>
        ))}
        {alerts.length === 0 && <EmptyState>アラートはありません ✅</EmptyState>}
      </div>
    </Card>
  );
}

function FeedCard() {
  const { feed } = useApp();
  return (
    <Card title="チーム共有フィード" icon={<Send className="w-5 h-5 text-sky-600" />}>
      <ol className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {feed.slice(0, 15).map((f) => (
          <li key={f.id} className="flex gap-2 text-sm">
            <span className="font-mono text-xs text-slate-400 pt-0.5 shrink-0">{fmtHM(f.at)}</span>
            <span
              className={cx(
                f.tone === 'ok' && 'text-emerald-700',
                f.tone === 'warn' && 'text-orange-700',
                f.tone === 'danger' && 'text-red-700',
                f.tone === 'info' && 'text-slate-700',
              )}
            >
              {f.text}
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function TeamBoard() {
  const { attendance, visits, tasks, now } = useApp();
  return (
    <Card title="リアルタイム勤怠ステータス（Cebu Office）" icon={<Users className="w-5 h-5 text-slate-600" />}>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {STAFF.map((s) => {
          const a = attendance[s.id];
          const v = visits.find((x) => x.staffId === s.id && !x.returnAt);
          const d = destOf(v?.destinationId);
          const tracking = a.status === 'working' || a.status === 'transit' || a.status === 'visiting';
          const open = tasks.filter((t) => t.assigneeId === s.id && t.status !== 'done');
          const late = open.filter(isTaskDelayed).length;
          const onBreak = a.breaks.find((b) => !b.end);
          return (
            <div key={s.id} className="rounded-xl ring-1 ring-slate-200 p-3 relative overflow-hidden">
              <div className={cx('absolute left-0 top-0 bottom-0 w-1', STATUS_META[a.status].dot)} />
              <div className="flex items-center gap-2">
                <span className="text-2xl">{s.avatar}</span>
                <div className="min-w-0">
                  <div className="font-semibold text-sm">{s.name}</div>
                  <div className="text-xs text-slate-400 truncate">{s.title}</div>
                </div>
              </div>
              <div className="mt-2">
                <StatusPill status={a.status} />
              </div>
              <div className="mt-2 text-xs text-slate-500 space-y-0.5">
                <div>
                  IN {fmtHM(a.clockIn)} · OUT {fmtHM(a.clockOut)}
                </div>
                {onBreak && <div className="text-yellow-700">☕ {Math.round((now - onBreak.start) / 60000)}分経過</div>}
                {d && (
                  <div className="text-orange-700 truncate">
                    {d.emoji} {a.status === 'transit' ? `→ ${d.short}` : `@ ${d.short} (${fmtHM(v?.arriveAt)})`}
                  </div>
                )}
                <div className={cx('flex items-center gap-1', tracking ? 'text-emerald-600' : 'text-slate-400')}>
                  <Radio className="w-3 h-3" /> GPS {tracking ? 'ON' : 'OFF'}
                </div>
                <div>
                  タスク {open.length}件{late > 0 && <span className="text-red-600 font-semibold"> · ⚠️遅延 {late}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ============================================================================
 * Tab 2: Tasks & Approval
 * ==========================================================================*/

type TaskView = 'list' | 'gm' | 'hqo';
type TaskFilter = 'all' | 'mine' | 'delayed' | 'approval' | 'done';

function TasksTab() {
  const { role, tasks, me, openAddTask } = useApp();
  const [view, setView] = useState<TaskView>(role === 'gm' ? 'gm' : role === 'hqo' ? 'hqo' : 'list');
  const [filter, setFilter] = useState<TaskFilter>(role === 'staff' ? 'mine' : 'all');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setView(role === 'gm' ? 'gm' : role === 'hqo' ? 'hqo' : 'list');
    setFilter(role === 'staff' ? 'mine' : 'all');
  }, [role]);

  const gmTray = tasks.filter((t) => t.approval?.type === 'GM');
  const hqoTray = tasks.filter((t) => t.approval?.type === 'HQO');

  const filtered = tasks.filter((t) => {
    if (filter === 'mine') return t.assigneeId === me.id && t.status !== 'done';
    if (filter === 'delayed') return isTaskDelayed(t);
    if (filter === 'approval') return t.approval?.status === 'pending';
    if (filter === 'done') return t.status === 'done';
    return t.status !== 'done';
  });

  const sorted = [...filtered].sort((a, b) => Number(isTaskDelayed(b)) - Number(isTaskDelayed(a)) || a.dueDate.localeCompare(b.dueDate));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex bg-white rounded-xl ring-1 ring-slate-200 p-1">
          {(
            [
              ['list', '📋 タスク一覧', 0],
              ['gm', '👔 GM統括承認', gmTray.filter((t) => t.approval?.status === 'pending').length],
              ['hqo', '🏦 HQO出金承認', hqoTray.filter((t) => t.approval?.status === 'pending').length],
            ] as Array<[TaskView, string, number]>
          ).map(([k, l, n]) => (
            <button
              key={k}
              onClick={() => setView(k)}
              className={cx('px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5', view === k ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100')}
            >
              {l}
              {n > 0 && <span className="text-xs bg-yellow-400 text-slate-900 rounded-full px-1.5 leading-tight">{n}</span>}
            </button>
          ))}
        </div>
        <button onClick={openAddTask} className={cx(btn.primary, 'ml-auto')}>
          <Plus className="w-4 h-4" /> Add Task
        </button>
      </div>

      {view === 'list' && (
        <>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['mine', `👤 自分のタスク (${me.name})`],
                ['all', '全オープン'],
                ['delayed', '⚠️ Delayed'],
                ['approval', '⏳ 要承認'],
                ['done', '✅ 完了'],
              ] as Array<[TaskFilter, string]>
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={cx('text-xs px-3 py-1.5 rounded-full ring-1 font-medium', filter === k ? 'bg-sky-600 text-white ring-sky-600' : 'bg-white ring-slate-300 text-slate-600 hover:bg-slate-50')}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {sorted.map((t) => (
              <TaskCard key={t.id} task={t} expanded={expanded === t.id} onToggle={() => setExpanded(expanded === t.id ? null : t.id)} />
            ))}
            {sorted.length === 0 && (
              <Card>
                <EmptyState>該当するタスクはありません</EmptyState>
              </Card>
            )}
          </div>
        </>
      )}

      {view === 'gm' && <ApprovalTray type="GM" items={gmTray} />}
      {view === 'hqo' && <ApprovalTray type="HQO" items={hqoTray} />}
    </div>
  );
}

function TaskCard({ task: t, expanded, onToggle }: { task: Task; expanded: boolean; onToggle: () => void }) {
  const { role, me, toggleMilestone, reportBlocker, clearBlocker, attachEvidence, removeEvidence, completeTask, reopenTask, resubmit, setTab } = useApp();
  const delayed = isTaskDelayed(t);
  const done = t.milestones.filter((m) => m.done).length;
  const pct = t.milestones.length ? Math.round((done / t.milestones.length) * 100) : 0;
  const isMine = role === 'staff' && t.assigneeId === me.id;
  const canEdit = role === 'staff';
  const fileRef = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState('');
  const [newAmount, setNewAmount] = useState(String(t.amount || ''));

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const isImg = f.type.startsWith('image/');
    attachEvidence(t.id, { name: f.name, kind: isImg ? 'photo' : 'file', url: isImg ? URL.createObjectURL(f) : undefined });
    e.target.value = '';
  };

  return (
    <div className={cx('bg-white rounded-2xl ring-1 shadow-sm transition', delayed ? 'ring-red-300' : 'ring-slate-200', t.status === 'done' && 'opacity-75')}>
      <button onClick={onToggle} className="w-full text-left p-4 flex gap-3 items-start">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <Badge className={CATEGORY_STYLE[t.category]}>{t.category}</Badge>
            <span className="text-xs text-slate-400">{t.subCategory}</span>
            {delayed && <Badge className="bg-red-600 text-white ring-red-600">⚠️ Delayed</Badge>}
            <ApprovalBadge approval={t.approval} />
            {t.requiresOuting && <Badge className="bg-orange-50 text-orange-700 ring-orange-200">🚗 外出</Badge>}
            {t.requiresExpense && <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">💰 {fmtPhp(t.amount)}</Badge>}
            {t.blocker && t.status !== 'done' && <Badge className="bg-orange-500 text-white ring-orange-500">{BLOCKERS[t.blocker.reason].label}</Badge>}
            {t.status === 'done' && <Badge className="bg-emerald-600 text-white ring-emerald-600">✅ 完了</Badge>}
          </div>
          <div className="font-semibold text-slate-800">{t.title}</div>
          <div className="mt-1 text-xs text-slate-500 flex flex-wrap gap-x-3">
            <span>
              <User className="inline w-3 h-3 -mt-0.5" /> {staffName(t.assigneeId)}
            </span>
            <span className={cx(t.dueDate < todayStr() && t.status !== 'done' && 'text-red-600 font-semibold')}>
              <Calendar className="inline w-3 h-3 -mt-0.5" /> 期日 {fmtDate(t.dueDate)}
            </span>
            {t.evidence.length > 0 && (
              <span>
                <Paperclip className="inline w-3 h-3 -mt-0.5" /> 証跡 {t.evidence.length}
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className={cx('h-full rounded-full', delayed ? 'bg-red-500' : pct === 100 ? 'bg-emerald-500' : 'bg-sky-500')} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-slate-500 font-mono">
              {done}/{t.milestones.length}
            </span>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-100 p-4 grid md:grid-cols-2 gap-5">
          {/* Milestones */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 mb-2">🏁 マイルストーン</h4>
            <ol className="relative border-l-2 border-slate-200 ml-2 space-y-3">
              {t.milestones.map((m) => {
                const late = isMsDelayed(m);
                return (
                  <li key={m.id} className="ml-4">
                    <span
                      className={cx(
                        'absolute -left-2 w-3.5 h-3.5 rounded-full ring-2 ring-white mt-1',
                        m.done ? 'bg-emerald-500' : late ? 'bg-red-500' : 'bg-slate-300',
                      )}
                    />
                    <label className={cx('flex items-start gap-2 text-sm', canEdit && t.status !== 'done' ? 'cursor-pointer' : 'cursor-default')}>
                      <input
                        type="checkbox"
                        checked={m.done}
                        disabled={!canEdit || t.status === 'done'}
                        onChange={() => toggleMilestone(t.id, m.id)}
                        className="mt-0.5 accent-emerald-600"
                      />
                      <span className={cx(m.done && 'line-through text-slate-400')}>
                        {m.label}
                        <span className={cx('block text-xs', late ? 'text-red-600 font-semibold' : 'text-slate-400')}>
                          {fmtDate(m.due)}
                          {late && ' ⚠️ Delayed'}
                          {m.done && m.doneAt && ` · 完了 ${fmtHM(m.doneAt)}`}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ol>

            {t.approval && (
              <div className="mt-4 rounded-xl bg-slate-50 ring-1 ring-slate-200 p-3 text-xs space-y-1">
                <div className="font-semibold text-slate-600">承認ルート: {t.approval.type === 'HQO' ? '🏦 HQO出金承認' : '👔 GM統括承認'}</div>
                <div className="text-slate-500">自動振り分け理由: {t.approval.reason}</div>
                {t.approval.decidedBy && (
                  <div className="text-slate-500">
                    判定: {t.approval.decidedBy} · {fmtHM(t.approval.decidedAt)}
                    {t.approval.note && <span className="block text-slate-700">💬 {t.approval.note}</span>}
                  </div>
                )}
                {isMine && (t.approval.status === 'revision' || t.approval.status === 'rejected') && (
                  <div className="flex items-center gap-2 pt-2">
                    {t.requiresExpense && (
                      <input className={cx(inputCls, 'w-32 py-1')} type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="金額(Php)" />
                    )}
                    <button onClick={() => resubmit(t.id, t.requiresExpense ? Number(newAmount) || 0 : undefined)} className={cx(btn.primary, 'py-1')}>
                      <RotateCcw className="w-3.5 h-3.5" /> 修正して再申請
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Blocker + Evidence + Actions */}
          <div className="space-y-4">
            {t.status !== 'done' && (
              <div>
                <h4 className="text-xs font-bold text-slate-500 mb-2">🚧 3秒ワンタップ Blocker 申告</h4>
                {t.blocker ? (
                  <div className="rounded-xl bg-orange-50 ring-1 ring-orange-200 p-3 text-sm flex items-center gap-2">
                    <span className="font-semibold text-orange-800">{BLOCKERS[t.blocker.reason].label}</span>
                    <span className="text-xs text-orange-700">
                      {t.blocker.by} · {fmtHM(t.blocker.at)}
                    </span>
                    {canEdit && (
                      <button onClick={() => clearBlocker(t.id)} className="ml-auto text-xs underline text-orange-800">
                        解除
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(BLOCKERS) as BlockerReason[]).map((r) => (
                      <button
                        key={r}
                        disabled={!canEdit}
                        onClick={() => reportBlocker(t.id, r)}
                        className="text-sm rounded-xl ring-1 ring-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-800 font-medium py-2 disabled:opacity-40"
                      >
                        {BLOCKERS[r].label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <h4 className="text-xs font-bold text-slate-500 mb-2">📎 証跡（写真・書類・リンク）</h4>
              <div className="flex flex-wrap gap-2 mb-2">
                {t.evidence.map((e) => (
                  <div key={e.id} className="group relative rounded-lg ring-1 ring-slate-200 p-1.5 flex items-center gap-2 text-xs bg-slate-50 max-w-full">
                    {e.kind === 'photo' ? (
                      e.url ? (
                        <img src={e.url} alt={e.name} className="w-10 h-10 object-cover rounded" />
                      ) : (
                        <div className={cx('w-10 h-10 rounded flex items-center justify-center', e.color ?? 'bg-amber-200')}>
                          <FileText className="w-5 h-5 text-slate-600" />
                        </div>
                      )
                    ) : e.kind === 'link' ? (
                      <Paperclip className="w-4 h-4 text-sky-600" />
                    ) : (
                      <FileText className="w-4 h-4 text-slate-500" />
                    )}
                    {e.kind === 'link' ? (
                      <a href={e.url} target="_blank" rel="noreferrer" className="text-sky-700 underline truncate max-w-xs">
                        {e.name}
                      </a>
                    ) : (
                      <span className="truncate max-w-xs">{e.name}</span>
                    )}
                    {canEdit && t.status !== 'done' && (
                      <button onClick={() => removeEvidence(t.id, e.id)} className="text-slate-400 hover:text-red-600" aria-label="削除">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {t.evidence.length === 0 && <span className="text-xs text-slate-400">まだ証跡はありません</span>}
              </div>
              {canEdit && t.status !== 'done' && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        attachEvidence(t.id, { name: mockPhotoName('receipt'), kind: 'photo', color: MOCK_COLORS[t.evidence.length % MOCK_COLORS.length] })
                      }
                      className={cx(btn.ghost, 'flex-1 py-1.5')}
                    >
                      <Camera className="w-4 h-4" /> 写真を撮る（モック）
                    </button>
                    <button onClick={() => fileRef.current?.click()} className={cx(btn.ghost, 'flex-1 py-1.5')}>
                      <Paperclip className="w-4 h-4" /> ファイル選択
                    </button>
                    <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onFile} />
                  </div>
                  <div className="flex gap-2">
                    <input className={cx(inputCls, 'py-1.5')} placeholder="https://drive.google.com/... (リンク添付)" value={link} onChange={(e) => setLink(e.target.value)} />
                    <button
                      disabled={!link.trim()}
                      onClick={() => {
                        attachEvidence(t.id, { name: link.trim(), kind: 'link', url: link.trim() });
                        setLink('');
                      }}
                      className={cx(btn.ghost, 'py-1.5')}
                    >
                      追加
                    </button>
                  </div>
                </div>
              )}
            </div>

            {canEdit && (
              <div className="flex gap-2 pt-1">
                {t.status !== 'done' ? (
                  <>
                    <button onClick={() => completeTask(t.id)} className={cx(btn.green, 'flex-1')}>
                      <Check className="w-4 h-4" /> 証跡を添付して完了
                    </button>
                    {t.requiresOuting && isMine && (
                      <button onClick={() => setTab('transit')} className={btn.orange}>
                        <Car className="w-4 h-4" /> 外出へ
                      </button>
                    )}
                  </>
                ) : (
                  <button onClick={() => reopenTask(t.id)} className={btn.ghost}>
                    <RotateCcw className="w-4 h-4" /> 再オープン
                  </button>
                )}
              </div>
            )}
            {!canEdit && <div className="text-xs text-slate-400">※ GM / HQO ビューは閲覧のみ（承認操作は承認トレイから）</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function ApprovalTray({ type, items }: { type: ApprovalType; items: Task[] }) {
  const { role } = useApp();
  const canAct = (type === 'GM' && role === 'gm') || (type === 'HQO' && role === 'hqo');
  const pending = items.filter((t) => t.approval?.status === 'pending');
  const decided = items.filter((t) => t.approval?.status !== 'pending');
  const total = pending.reduce((s, t) => s + (t.requiresExpense ? t.amount : 0), 0);

  return (
    <div className="space-y-4">
      <div
        className={cx(
          'rounded-2xl p-4 text-white flex flex-wrap items-center gap-4',
          type === 'HQO' ? 'bg-gradient-to-r from-emerald-700 to-teal-600' : 'bg-gradient-to-r from-indigo-700 to-sky-600',
        )}
      >
        <div className="flex items-center gap-2">
          {type === 'HQO' ? <Landmark className="w-6 h-6" /> : <Briefcase className="w-6 h-6" />}
          <div>
            <div className="font-bold">{type === 'HQO' ? '🏦 HQO 出金承認トレイ' : '👔 GM 統括承認トレイ'}</div>
            <div className="text-xs opacity-80">
              {type === 'HQO' ? '口座出金・15,000 Php以上の備品調達・給与 など' : 'ビザ・TESDA等の公的手続き・雇用契約・外出訪問 など'}
            </div>
          </div>
        </div>
        <div className="ml-auto flex gap-6 text-right">
          <div>
            <div className="text-xs opacity-80">承認待ち</div>
            <div className="text-2xl font-black">{pending.length}</div>
          </div>
          {type === 'HQO' && (
            <div>
              <div className="text-xs opacity-80">出金予定総額</div>
              <div className="text-2xl font-black">{fmtPhp(total)}</div>
            </div>
          )}
        </div>
      </div>
      {!canAct && (
        <div className="text-xs rounded-lg bg-yellow-50 ring-1 ring-yellow-200 text-yellow-800 px-3 py-2">
          👀 閲覧モード — 承認操作は上部ロールバーで「{type === 'HQO' ? '🏦 HQO (Finance)' : '👔 GM (Japan)'}」に切り替えてください
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-3">
        {pending.map((t) => (
          <ApprovalCard key={t.id} task={t} canAct={canAct} />
        ))}
        {pending.length === 0 && (
          <Card className="md:col-span-2">
            <EmptyState>承認待ちはありません ✅</EmptyState>
          </Card>
        )}
      </div>
      {decided.length > 0 && (
        <Card title="処理済み履歴" icon={<FileText className="w-5 h-5 text-slate-500" />}>
          <div className="divide-y divide-slate-100">
            {decided.map((t) => (
              <div key={t.id} className="py-2 flex flex-wrap items-center gap-2 text-sm">
                <ApprovalBadge approval={t.approval} />
                <span className="font-medium">{t.title}</span>
                <span className="text-xs text-slate-400">
                  {staffName(t.assigneeId)} · {t.approval?.decidedBy} {fmtHM(t.approval?.decidedAt)}
                </span>
                {t.approval?.note && <span className="text-xs text-slate-600">💬 {t.approval.note}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function ApprovalCard({ task: t, canAct }: { task: Task; canAct: boolean }) {
  const { decide } = useApp();
  const [mode, setMode] = useState<null | 'revision' | 'rejected'>(null);
  const [note, setNote] = useState('');
  const delayed = isTaskDelayed(t);
  return (
    <div className="bg-white rounded-2xl ring-1 ring-yellow-300 shadow-sm p-4 flex flex-col">
      <div className="flex flex-wrap items-center gap-1.5 mb-1">
        <Badge className={CATEGORY_STYLE[t.category]}>{t.category}</Badge>
        <span className="text-xs text-slate-400">{t.subCategory}</span>
        {delayed && <Badge className="bg-red-600 text-white ring-red-600">⚠️ Delayed</Badge>}
      </div>
      <div className="font-semibold">{t.title}</div>
      <div className="text-xs text-slate-500 mt-1 space-y-0.5">
        <div>
          申請: {staffName(t.createdBy)} → 担当 {staffName(t.assigneeId)} · 期日 {fmtDate(t.dueDate)}
        </div>
        <div>振り分け理由: {t.approval?.reason}</div>
        {t.requiresOuting && <div>🚗 外出先: {destOf(t.destinationId)?.name ?? '未設定'}</div>}
      </div>
      {t.requiresExpense && <div className="mt-2 text-2xl font-black text-emerald-700">{fmtPhp(t.amount)}</div>}
      <div className="mt-2 flex flex-wrap gap-1">
        {t.milestones.map((m) => (
          <span key={m.id} className={cx('text-xs px-2 py-0.5 rounded-full', m.done ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
            {m.done ? '✓' : '○'} {m.label}
          </span>
        ))}
      </div>
      <div className="mt-auto pt-3">
        {mode ? (
          <div className="space-y-2">
            <textarea
              className={cx(inputCls, 'h-16')}
              placeholder={mode === 'revision' ? '修正してほしい点（例: 見積をもう1社追加してください）' : '差戻し理由（例: 今月は予算外のため見送り）'}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                className={cx(mode === 'revision' ? btn.orange : btn.red, 'flex-1')}
                onClick={() => {
                  decide(t.id, mode, note.trim() || undefined);
                  setMode(null);
                  setNote('');
                }}
              >
                <Send className="w-4 h-4" /> {mode === 'revision' ? '修正依頼を送信' : '差戻しを送信'}
              </button>
              <button className={btn.ghost} onClick={() => setMode(null)}>
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <button disabled={!canAct} onClick={() => decide(t.id, 'approved')} className={btn.green}>
              <Check className="w-4 h-4" /> 承認
            </button>
            <button disabled={!canAct} onClick={() => setMode('revision')} className={btn.yellow}>
              <Pencil className="w-4 h-4" /> 修正
            </button>
            <button disabled={!canAct} onClick={() => setMode('rejected')} className={btn.red}>
              <RotateCcw className="w-4 h-4" /> 差戻し
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Add Task modal ---------- */

function AddTaskModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (t: Task) => void }) {
  const { role, me } = useApp();
  const [category, setCategory] = useState<Category>('ドキュメント');
  const [subCategory, setSubCategory] = useState(SUBCATEGORIES['ドキュメント'][0]);
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState(role === 'staff' ? me.id : 'alyssa');
  const [dueDate, setDueDate] = useState(dayRel(3));
  const [milestones, setMilestones] = useState<Array<{ id: string; label: string; due: string }>>([
    { id: uid('m'), label: '', due: dayRel(1) },
  ]);
  const [requiresOuting, setOuting] = useState(false);
  const [destinationId, setDestinationId] = useState(DESTINATIONS[0].id);
  const [requiresExpense, setExpense] = useState(false);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const amt = Number(amount) || 0;
  const route = routeApproval({ category, subCategory, title, requiresOuting, requiresExpense, amount: amt });

  const submit = () => {
    if (!title.trim()) return setError('タスク名を入力してください');
    if (requiresExpense && amt <= 0) return setError('費用フラグONの場合は金額を入力してください');
    const ms = milestones.filter((m) => m.label.trim());
    const task: Task = {
      id: uid('task'),
      category,
      subCategory,
      title: title.trim(),
      assigneeId,
      createdBy: role === 'staff' ? me.id : role.toUpperCase(),
      dueDate,
      milestones: (ms.length ? ms : [{ id: uid('m'), label: '完了', due: dueDate }]).map((m) => ({
        id: uid('ms'),
        label: m.label.trim() || '完了',
        due: m.due || dueDate,
        done: false,
      })),
      requiresOuting,
      requiresExpense,
      amount: requiresExpense ? amt : 0,
      approval: route ? { ...route, status: 'pending' } : null,
      status: 'todo',
      evidence: [],
      destinationId: requiresOuting ? destinationId : undefined,
      transitPhase: 'none',
      createdAt: Date.now(),
    };
    onSubmit(task);
  };

  return (
    <Modal title="＋ Add Task（新規タスク起票）" onClose={onClose} wide>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>大分類</label>
          <select
            className={inputCls}
            value={category}
            onChange={(e) => {
              const c = e.target.value as Category;
              setCategory(c);
              setSubCategory(SUBCATEGORIES[c][0]);
            }}
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>中分類</label>
          <input className={inputCls} list="subcats" value={subCategory} onChange={(e) => setSubCategory(e.target.value)} />
          <datalist id="subcats">
            {SUBCATEGORIES[category].map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>タスク名 *</label>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例: BI Visa 9G 延長申請 / 給与振込 / プリンター購入" />
        </div>
        <div>
          <label className={labelCls}>担当者（単一選択）</label>
          <select className={inputCls} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            {STAFF.map((s) => (
              <option key={s.id} value={s.id}>
                {s.avatar} {s.name} — {s.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>期日</label>
          <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>

        <div className="md:col-span-2">
          <label className={labelCls}>マイルストーン（複数ステップ）</label>
          <div className="space-y-2">
            {milestones.map((m, i) => (
              <div key={m.id} className="flex gap-2 items-center">
                <span className="text-xs font-mono text-slate-400 w-5">{i + 1}.</span>
                <input
                  className={inputCls}
                  placeholder={`ステップ ${i + 1}（例: 書類準備 → 窓口提出 → 受領）`}
                  value={m.label}
                  onChange={(e) => setMilestones((ms) => ms.map((x) => (x.id === m.id ? { ...x, label: e.target.value } : x)))}
                />
                <input
                  type="date"
                  className={cx(inputCls, 'w-44')}
                  value={m.due}
                  onChange={(e) => setMilestones((ms) => ms.map((x) => (x.id === m.id ? { ...x, due: e.target.value } : x)))}
                />
                <button
                  disabled={milestones.length === 1}
                  onClick={() => setMilestones((ms) => ms.filter((x) => x.id !== m.id))}
                  className="p-2 text-slate-400 hover:text-red-600 disabled:opacity-30"
                  aria-label="削除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button onClick={() => setMilestones((ms) => [...ms, { id: uid('m'), label: '', due: dueDate }])} className={cx(btn.ghost, 'py-1.5')}>
              <Plus className="w-4 h-4" /> ステップを追加
            </button>
          </div>
        </div>

        <div className="rounded-xl ring-1 ring-slate-200 p-3 space-y-2">
          <Toggle checked={requiresOuting} onChange={setOuting} label="🚗 外出フラグ（対外訪問あり）" />
          {requiresOuting && (
            <select className={inputCls} value={destinationId} onChange={(e) => setDestinationId(e.target.value)}>
              {DESTINATIONS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.emoji} {d.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="rounded-xl ring-1 ring-slate-200 p-3 space-y-2">
          <Toggle checked={requiresExpense} onChange={setExpense} label="💰 費用フラグ（支出あり）" />
          {requiresExpense && (
            <input type="number" min={0} className={inputCls} placeholder="金額 (Php)" value={amount} onChange={(e) => setAmount(e.target.value)} />
          )}
        </div>

        <div
          className={cx(
            'md:col-span-2 rounded-xl p-3 text-sm flex items-center gap-2',
            !route ? 'bg-slate-50 text-slate-500' : route.type === 'HQO' ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' : 'bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200',
          )}
        >
          <Shield className="w-4 h-4 shrink-0" />
          {route ? (
            <span>
              <b>⏳ 要承認</b> → 「{route.type === 'HQO' ? '🏦 HQO出金承認' : '👔 GM統括承認'}」トレイへ自動振り分け（理由: {route.reason}）
            </span>
          ) : (
            <span>承認不要 — 登録後すぐに着手できます</span>
          )}
        </div>
      </div>
      {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className={btn.ghost}>
          キャンセル
        </button>
        <button onClick={submit} className={btn.primary}>
          <Plus className="w-4 h-4" /> タスクを登録
        </button>
      </div>
    </Modal>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-3 w-full text-left">
      <span className={cx('relative w-10 h-6 rounded-full transition shrink-0', checked ? 'bg-sky-600' : 'bg-slate-300')}>
        <span className={cx('absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all', checked ? 'left-5' : 'left-1')} />
      </span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

/* ============================================================================
 * Tab 3: Transit & Visits
 * ==========================================================================*/

function TransitTab() {
  const { role, me, tasks, attendance, visits, depart, arrive, finishVisit, now } = useApp();
  const myOutings = tasks.filter((t) => t.assigneeId === me.id && t.requiresOuting && (t.status !== 'done' || t.transitPhase === 'done'));
  const active = myOutings.find((t) => t.transitPhase === 'transit' || t.transitPhase === 'arrived');
  const [selected, setSelected] = useState<string>(active?.id ?? myOutings.find((t) => t.status !== 'done')?.id ?? '');
  const sel = tasks.find((t) => t.id === selected);
  const [destId, setDestId] = useState<string>(sel?.destinationId ?? DESTINATIONS[0].id);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = tasks.find((x) => x.id === selected);
    if (t?.destinationId) setDestId(t.destinationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useEffect(() => {
    // ロール/スタッフ切替時に選択をリセット
    setSelected(active?.id ?? myOutings.find((t) => t.status !== 'done')?.id ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.id]);

  const onField = attendance[me.id].status;
  const curVisit = sel ? visits.find((v) => v.taskId === sel.id && !v.returnAt) : undefined;
  const busyElsewhere = !!active && active.id !== sel?.id;

  const onReceiptFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !sel) return;
    const isImg = f.type.startsWith('image/');
    finishVisit(sel.id, { name: f.name, kind: isImg ? 'photo' : 'file', url: isImg ? URL.createObjectURL(f) : undefined });
    e.target.value = '';
  };

  const steps: Array<{ key: TransitPhase; label: string }> = [
    { key: 'none', label: '🏢 事務所' },
    { key: 'transit', label: '🚗 移動中' },
    { key: 'arrived', label: '📍 到着' },
    { key: 'done', label: '📸 完了・帰社' },
  ];
  const phaseIdx = sel ? steps.findIndex((s) => s.key === sel.transitPhase) : 0;

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-5 gap-6">
        {role === 'staff' ? (
          <Card title={`外出タスク（${me.name}）`} icon={<Car className="w-5 h-5 text-orange-500" />} className="lg:col-span-2" right={<StatusPill status={onField} />}>
            {myOutings.length === 0 ? (
              <EmptyState>外出フラグ付きのタスクはありません。Tasks タブで「🚗 外出フラグ」をONにして起票してください。</EmptyState>
            ) : (
              <>
                <label className={labelCls}>外出タスクを選択</label>
                <select className={inputCls} value={selected} onChange={(e) => setSelected(e.target.value)}>
                  <option value="">— 選択してください —</option>
                  {myOutings.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.transitPhase === 'done' ? '✅ ' : ''}
                      {t.title}
                    </option>
                  ))}
                </select>

                {sel && (
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center gap-1">
                      {steps.map((s, i) => (
                        <React.Fragment key={s.key}>
                          <div
                            className={cx(
                              'flex-1 text-center text-xs font-semibold rounded-lg py-1.5',
                              i < phaseIdx && 'bg-emerald-100 text-emerald-700',
                              i === phaseIdx && 'bg-orange-500 text-white',
                              i > phaseIdx && 'bg-slate-100 text-slate-400',
                            )}
                          >
                            {s.label}
                          </div>
                          {i < steps.length - 1 && <span className="text-slate-300">›</span>}
                        </React.Fragment>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <ApprovalBadge approval={sel.approval} />
                      {sel.requiresExpense && <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">💰 {fmtPhp(sel.amount)}</Badge>}
                    </div>

                    {sel.transitPhase === 'none' && (
                      <>
                        <div>
                          <label className={labelCls}>目的地</label>
                          <select className={inputCls} value={destId} onChange={(e) => setDestId(e.target.value)}>
                            {DESTINATIONS.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.emoji} {d.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        {!canStartOuting(sel) && (
                          <div className="text-xs rounded-lg bg-yellow-50 ring-1 ring-yellow-200 text-yellow-800 px-3 py-2">
                            ⏳ {sel.approval?.type}承認待ちのため出発できません（{sel.approval?.status === 'pending' ? '承認待ち' : sel.approval?.status === 'revision' ? '修正依頼中' : '差戻し'}）。
                            ロールバーで {sel.approval?.type} に切り替えて承認をテストできます。
                          </div>
                        )}
                        {onField !== 'working' && (
                          <div className="text-xs rounded-lg bg-slate-50 ring-1 ring-slate-200 text-slate-600 px-3 py-2">
                            ℹ️ 出発するには勤務中（Clock-In済・休憩外）である必要があります。
                          </div>
                        )}
                        {busyElsewhere && (
                          <div className="text-xs rounded-lg bg-orange-50 ring-1 ring-orange-200 text-orange-800 px-3 py-2">
                            🚗 別の外出（{active?.title}）が進行中です。
                          </div>
                        )}
                        <button
                          onClick={() => depart(sel.id, destId)}
                          disabled={!canStartOuting(sel) || onField !== 'working' || busyElsewhere}
                          className={cx(btn.orange, 'w-full py-3 text-base')}
                        >
                          <Car className="w-5 h-5" /> 🚗 出発 (Transit)
                        </button>
                      </>
                    )}

                    {sel.transitPhase === 'transit' && (
                      <>
                        <div className="rounded-xl bg-orange-50 ring-1 ring-orange-200 p-3 text-sm text-orange-800">
                          🚗 {destOf(sel.destinationId)?.name} へ移動中 — 出発 {fmtHM(curVisit?.departAt)}（{curVisit ? Math.round((now - curVisit.departAt) / 60000) : 0}分経過）
                        </div>
                        <button onClick={() => arrive(sel.id)} className={cx(btn.primary, 'w-full py-3 text-base')}>
                          <MapPin className="w-5 h-5" /> 📍 到着チェックイン
                        </button>
                      </>
                    )}

                    {sel.transitPhase === 'arrived' && (
                      <>
                        <div className="rounded-xl bg-sky-50 ring-1 ring-sky-200 p-3 text-sm text-sky-800">
                          📍 {destOf(sel.destinationId)?.name} 到着 {fmtHM(curVisit?.arriveAt)}
                          {curVisit?.pin && (
                            <span className="block font-mono text-xs mt-0.5">
                              pin {curVisit.pin.lat.toFixed(5)}, {curVisit.pin.lng.toFixed(5)}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => finishVisit(sel.id, { name: mockPhotoName('receipt'), kind: 'photo', color: 'bg-amber-200' })}
                            className={cx(btn.green, 'py-3')}
                          >
                            <Camera className="w-5 h-5" /> 📸 領収書撮影 & 完了
                          </button>
                          <button onClick={() => fileRef.current?.click()} className={cx(btn.ghost, 'py-3')}>
                            <Paperclip className="w-5 h-5" /> ファイルで添付 & 完了
                          </button>
                          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onReceiptFile} />
                        </div>
                      </>
                    )}

                    {sel.transitPhase === 'done' && (
                      <div className="rounded-xl bg-emerald-50 ring-1 ring-emerald-200 p-3 text-sm text-emerald-800">
                        ✅ 訪問完了・帰社済み — 証跡: {sel.evidence.map((e) => e.name).join(', ') || 'なし'}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </Card>
        ) : (
          <Card title="外出中のスタッフ" icon={<Car className="w-5 h-5 text-orange-500" />} className="lg:col-span-2">
            <div className="space-y-2">
              {visits
                .filter((v) => !v.returnAt)
                .map((v) => {
                  const d = destOf(v.destinationId);
                  const s = staffOf(v.staffId);
                  const t = tasks.find((x) => x.id === v.taskId);
                  return (
                    <div key={v.id} className={cx('rounded-xl p-3 ring-1', v.arriveAt ? 'bg-sky-50 ring-sky-200' : 'bg-orange-50 ring-orange-200')}>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{s.avatar}</span>
                        <span className="font-semibold">{s.name}</span>
                        <StatusPill status={v.arriveAt ? 'visiting' : 'transit'} />
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        {d?.emoji} {d?.name} · 出発 {fmtHM(v.departAt)}
                        {v.arriveAt ? ` · 到着 ${fmtHM(v.arriveAt)}` : ` · ${Math.round((now - v.departAt) / 60000)}分経過`}
                      </div>
                      {t && <div className="text-xs text-slate-500 truncate">📌 {t.title}</div>}
                    </div>
                  );
                })}
              {visits.filter((v) => !v.returnAt).length === 0 && <EmptyState>現在外出中のスタッフはいません</EmptyState>}
            </div>
          </Card>
        )}

        <Card title="チェックイン履歴マップ（モック）" icon={<MapPin className="w-5 h-5 text-red-500" />} className="lg:col-span-3">
          <MockMap />
        </Card>
      </div>

      <Card title="外出・チェックイン履歴" icon={<Navigation className="w-5 h-5 text-slate-600" />}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-3">日付</th>
                <th className="py-2 pr-3">スタッフ</th>
                <th className="py-2 pr-3">目的地</th>
                <th className="py-2 pr-3">タスク</th>
                <th className="py-2 pr-3">🚗 出発</th>
                <th className="py-2 pr-3">📍 到着</th>
                <th className="py-2 pr-3">🏢 帰社</th>
                <th className="py-2 pr-3">ピン</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => {
                const d = destOf(v.destinationId);
                return (
                  <tr key={v.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(ymd(new Date(v.departAt)))}</td>
                    <td className="py-2 pr-3">{staffName(v.staffId)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {d?.emoji} {d?.short}
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-500">{tasks.find((t) => t.id === v.taskId)?.title ?? '—'}</td>
                    <td className="py-2 pr-3 font-mono">{fmtHM(v.departAt)}</td>
                    <td className="py-2 pr-3 font-mono">{fmtHM(v.arriveAt)}</td>
                    <td className="py-2 pr-3 font-mono">{v.returnAt ? fmtHM(v.returnAt) : <StatusPill status={v.arriveAt ? 'visiting' : 'transit'} />}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-slate-500">{v.pin ? `${v.pin.lat.toFixed(4)}, ${v.pin.lng.toFixed(4)}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function MockMap() {
  const { visits, now } = useApp();
  const pts = [OFFICE, ...DESTINATIONS];
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const pos = (lat: number, lng: number) => ({
    left: `${8 + ((lng - minLng) / (maxLng - minLng)) * 84}%`,
    top: `${8 + (1 - (lat - minLat) / (maxLat - minLat)) * 84}%`,
  });
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const active = visits.filter((v) => !v.returnAt);
  const pins = visits.filter((v) => v.pin);
  const officePos = pos(OFFICE.lat, OFFICE.lng);

  return (
    <div>
      <div
        className="relative h-80 rounded-xl overflow-hidden ring-1 ring-slate-200 bg-emerald-50"
        style={{
          backgroundImage:
            'linear-gradient(rgba(148,163,184,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.18) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      >
        {/* 海（マクタン海峡）っぽい装飾 */}
        <div className="absolute right-0 top-0 bottom-0 w-1/6 bg-sky-200 opacity-70" />
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          {active.map((v) => {
            const d = destOf(v.destinationId);
            if (!d) return null;
            const p = pos(d.lat, d.lng);
            return (
              <line
                key={v.id}
                x1={officePos.left}
                y1={officePos.top}
                x2={p.left}
                y2={p.top}
                stroke="#f97316"
                strokeWidth="2.5"
                strokeDasharray="6 5"
              />
            );
          })}
        </svg>

        {/* Office + geofence */}
        <div className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center" style={officePos}>
          <div className="w-14 h-14 rounded-full bg-emerald-400/30 ring-2 ring-emerald-500 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-emerald-800" />
          </div>
          <span className="text-xs font-bold bg-white rounded px-1 shadow mt-0.5 whitespace-nowrap">🏢 Office (50m)</span>
        </div>

        {DESTINATIONS.map((d) => (
          <div key={d.id} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center" style={pos(d.lat, d.lng)}>
            <span className="text-lg leading-none">{d.emoji}</span>
            <span className="text-xs bg-white/90 rounded px-1 shadow whitespace-nowrap">{d.short}</span>
          </div>
        ))}

        {pins.map((v) => (
          <div
            key={`pin_${v.id}`}
            title={`${staffName(v.staffId)} ${fmtHM(v.arriveAt)}`}
            className="absolute -translate-x-1/2 -translate-y-full"
            style={pos(v.pin!.lat, v.pin!.lng)}
          >
            <MapPin className={cx('w-6 h-6 drop-shadow', v.returnAt ? 'text-red-400' : 'text-red-600 animate-bounce')} fill="white" />
          </div>
        ))}

        {active.map((v) => {
          const d = destOf(v.destinationId);
          if (!d) return null;
          const t = v.arriveAt ? 1 : Math.min(0.85, 0.15 + (now - v.departAt) / (30 * 60000));
          const p = pos(lerp(OFFICE.lat, d.lat, t), lerp(OFFICE.lng, d.lng, t));
          return (
            <div key={`car_${v.id}`} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-1000" style={p}>
              <div className={cx('rounded-full p-1.5 shadow-lg text-white', v.arriveAt ? 'bg-sky-600' : 'bg-orange-500')}>
                {v.arriveAt ? <MapPin className="w-4 h-4" /> : <Car className="w-4 h-4" />}
              </div>
              <span className="text-xs font-bold bg-slate-900 text-white rounded px-1 mt-0.5 whitespace-nowrap">{staffName(v.staffId)}</span>
            </div>
          );
        })}

        <div className="absolute bottom-2 right-2 text-xs bg-white/90 rounded-lg px-2 py-1 shadow space-x-2">
          <span>🟠 移動中</span>
          <span>🔵 訪問中</span>
          <span>📍 チェックイン</span>
        </div>
        <div className="absolute top-2 left-2 text-xs bg-white/90 rounded-lg px-2 py-1 shadow font-semibold">Cebu City / Mandaue</div>
      </div>
    </div>
  );
}

/* ============================================================================
 * Tab 4: Students & Lessons
 * ==========================================================================*/

function StudentsTab() {
  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-3 gap-6">
        <StudentForm />
        <StudentList />
      </div>
      <Timetable />
      <OnlineLessons />
    </div>
  );
}

function StudentForm() {
  const { addStudent } = useApp();
  const [name, setName] = useState('');
  const [ageGroup, setAgeGroup] = useState<'Kids' | 'Adult'>('Adult');
  const [levelSystem, setLevelSystem] = useState<'CEFR' | '英検'>('CEFR');
  const [level, setLevel] = useState('A1');
  const [mode, setMode] = useState<'face' | 'online'>('face');
  const [past, setPast] = useState('0');

  return (
    <Card title="学生登録" icon={<Plus className="w-5 h-5 text-sky-600" />}>
      <div className="space-y-3">
        <div>
          <label className={labelCls}>氏名 *</label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="例: Suzuki Ichiro" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>年齢区分</label>
            <Segmented value={ageGroup} onChange={setAgeGroup} options={[['Kids', '🧒 Kids'], ['Adult', '🧑 Adult']]} />
          </div>
          <div>
            <label className={labelCls}>受講タイプ</label>
            <Segmented value={mode} onChange={setMode} options={[['face', '🏫 対面'], ['online', '💻 オンライン']]} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>レベル指標</label>
            <Segmented
              value={levelSystem}
              onChange={(v) => {
                setLevelSystem(v);
                setLevel(v === 'CEFR' ? 'A1' : '5級');
              }}
              options={[['CEFR', 'CEFR'], ['英検', '英検']]}
            />
          </div>
          <div>
            <label className={labelCls}>英語レベル</label>
            <select className={inputCls} value={level} onChange={(e) => setLevel(e.target.value)}>
              {(levelSystem === 'CEFR' ? CEFR_LEVELS : EIKEN_LEVELS).map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>過去の受講回数（移行データ）</label>
          <input type="number" min={0} className={inputCls} value={past} onChange={(e) => setPast(e.target.value)} />
        </div>
        <button
          disabled={!name.trim()}
          onClick={() => {
            addStudent({ name: name.trim(), ageGroup, levelSystem, level, mode, pastLessons: Math.max(0, Number(past) || 0) });
            setName('');
            setPast('0');
          }}
          className={cx(btn.primary, 'w-full')}
        >
          <Plus className="w-4 h-4" /> 登録する
        </button>
      </div>
    </Card>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: Array<[T, string]> }) {
  return (
    <div className="flex bg-slate-100 rounded-lg p-0.5">
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cx('flex-1 text-xs py-1.5 px-2 whitespace-nowrap rounded-md font-medium', value === v ? 'bg-white shadow text-slate-900' : 'text-slate-500')}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function StudentList() {
  const { students, removeStudent, bookings, role } = useApp();
  const [filter, setFilter] = useState<'all' | 'face' | 'online'>('all');
  const list = students.filter((s) => filter === 'all' || s.mode === filter);
  return (
    <Card
      title={`学生リスト（${students.length}名）`}
      icon={<Users className="w-5 h-5 text-pink-600" />}
      className="lg:col-span-2"
      right={<Segmented value={filter} onChange={setFilter} options={[['all', 'すべて'], ['face', '対面'], ['online', 'オンライン']]} />}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-3">氏名</th>
              <th className="py-2 pr-3">年齢区分</th>
              <th className="py-2 pr-3">レベル</th>
              <th className="py-2 pr-3">受講タイプ</th>
              <th className="py-2 pr-3">受講回数</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {list.map((s) => {
              const done = s.pastLessons + bookings.filter((b) => b.studentId === s.id && b.datetime < `${todayStr()}T00:00`).length;
              return (
                <tr key={s.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-medium">{s.name}</td>
                  <td className="py-2 pr-3">
                    <Badge className={s.ageGroup === 'Kids' ? 'bg-yellow-50 text-yellow-800 ring-yellow-200' : 'bg-slate-50 text-slate-700 ring-slate-200'}>
                      {s.ageGroup === 'Kids' ? '🧒 Kids' : '🧑 Adult'}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3">
                    <Badge className="bg-sky-50 text-sky-700 ring-sky-200">
                      {s.levelSystem} {s.level}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3">{s.mode === 'face' ? '🏫 対面' : '💻 オンライン'}</td>
                  <td className="py-2 pr-3 font-mono">{done}回</td>
                  <td className="py-2 text-right">
                    {role === 'staff' && (
                      <button onClick={() => removeStudent(s.id)} className="text-slate-300 hover:text-red-600" aria-label="削除">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 && <EmptyState>学生がいません</EmptyState>}
      </div>
    </Card>
  );
}

function Timetable() {
  const { slots, students, setSlotStaff, addSlotStudent, removeSlotStudent, now } = useApp();
  const faceStudents = students.filter((s) => s.mode === 'face');
  const d = new Date(now);
  const cur = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return (
    <Card
      title={`対面クラス時間割 — 本日 ${fmtDate(todayStr())}`}
      icon={<Calendar className="w-5 h-5 text-pink-600" />}
      right={<span className="text-xs text-slate-400">担当スタッフ + 生徒を紐付けると本日のマイルストーンに自動追加</span>}
    >
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {slots.map((s) => {
          const live = cur >= s.start && cur < s.end;
          const avail = faceStudents.filter((st) => !s.studentIds.includes(st.id));
          const linked = !!s.staffId && s.studentIds.length > 0;
          return (
            <div key={s.id} className={cx('rounded-xl ring-1 p-3', live ? 'ring-2 ring-emerald-400 bg-emerald-50' : linked ? 'ring-pink-200 bg-pink-50' : 'ring-slate-200 bg-white')}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 rounded-lg bg-slate-800 text-white text-sm font-bold flex items-center justify-center">{s.no}</span>
                <span className="font-mono font-semibold">
                  {s.start}–{s.end}
                </span>
                {live && <span className="text-xs bg-emerald-600 text-white rounded px-1.5 py-0.5 ml-auto">NOW</span>}
                {!live && linked && <span className="text-xs text-pink-700 ml-auto">📌 タスク連動中</span>}
              </div>
              <label className={labelCls}>担当スタッフ</label>
              <select className={cx(inputCls, 'py-1.5')} value={s.staffId ?? ''} onChange={(e) => setSlotStaff(s.id, e.target.value || null)}>
                <option value="">— 未割当 —</option>
                {STAFF.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.avatar} {st.name}
                  </option>
                ))}
              </select>
              <label className={cx(labelCls, 'mt-2')}>生徒</label>
              <div className="flex flex-wrap gap-1 mb-1.5 min-h-6">
                {s.studentIds.map((id) => {
                  const st = students.find((x) => x.id === id);
                  if (!st) return null;
                  return (
                    <span key={id} className="text-xs bg-white ring-1 ring-pink-200 rounded-full pl-2 pr-1 py-0.5 flex items-center gap-1">
                      {st.name} <span className="text-slate-400">{st.level}</span>
                      <button onClick={() => removeSlotStudent(s.id, id)} className="text-slate-400 hover:text-red-600" aria-label="外す">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
                {s.studentIds.length === 0 && <span className="text-xs text-slate-400">未割当</span>}
              </div>
              <select
                className={cx(inputCls, 'py-1.5')}
                value=""
                onChange={(e) => e.target.value && addSlotStudent(s.id, e.target.value)}
                disabled={avail.length === 0}
              >
                <option value="">＋ 生徒を追加…</option>
                {avail.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}（{st.ageGroup} / {st.levelSystem} {st.level}）
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function OnlineLessons() {
  const { students, bookings, addBooking, removeBooking, lessonNo, me, role } = useApp();
  const [studentId, setStudentId] = useState(students.find((s) => s.mode === 'online')?.id ?? students[0]?.id ?? '');
  const [datetime, setDatetime] = useState(`${dayRel(1)}T16:00`);
  const [teamsUrl, setTeamsUrl] = useState('');
  const [teacherId, setTeacherId] = useState(role === 'staff' ? me.id : 'alyssa');
  const [mineOnly, setMineOnly] = useState(false);

  const st = students.find((s) => s.id === studentId);
  const previewNo = st ? st.pastLessons + bookings.filter((b) => b.studentId === studentId && b.datetime < datetime).length + 1 : 0;
  const sorted = [...bookings]
    .filter((b) => !mineOnly || b.teacherId === me.id)
    .sort((a, b) => a.datetime.localeCompare(b.datetime));
  const nowStr = `${todayStr()}T00:00`;

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card title="オンラインレッスン予約（Teams）" icon={<Video className="w-5 h-5 text-violet-600" />}>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>生徒</label>
            <select className={inputCls} value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.mode === 'online' ? '💻' : '🏫'} {s.name}（{s.levelSystem} {s.level}）
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>日時</label>
            <input type="datetime-local" className={inputCls} value={datetime} onChange={(e) => setDatetime(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Teams 会議URL</label>
            <input className={inputCls} value={teamsUrl} onChange={(e) => setTeamsUrl(e.target.value)} placeholder="https://teams.microsoft.com/l/meetup-join/..." />
          </div>
          <div>
            <label className={labelCls}>担当講師</label>
            <select className={inputCls} value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              {STAFF.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.avatar} {s.name}
                </option>
              ))}
            </select>
          </div>
          {st && (
            <div className="rounded-lg bg-violet-50 ring-1 ring-violet-200 px-3 py-2 text-sm text-violet-800">
              🔢 回数自動カウント: <b>{st.name} 第{previewNo}回</b>
            </div>
          )}
          <button
            disabled={!studentId || !datetime}
            onClick={() => {
              addBooking({
                studentId,
                datetime,
                teacherId,
                teamsUrl: teamsUrl.trim() || `https://teams.microsoft.com/l/meetup-join/cebu-${Math.random().toString(36).slice(2, 10)}`,
              });
              setTeamsUrl('');
            }}
            className={cx(btn.primary, 'w-full bg-violet-600 hover:bg-violet-700')}
          >
            <Calendar className="w-4 h-4" /> 予約を登録
          </button>
          <p className="text-xs text-slate-400">URL未入力の場合はモックのTeamsリンクを自動発行します。</p>
        </div>
      </Card>

      <Card
        title="予約一覧"
        icon={<Video className="w-5 h-5 text-violet-600" />}
        className="lg:col-span-2"
        right={
          role === 'staff' ? (
            <label className="text-xs flex items-center gap-1.5 text-slate-500">
              <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} className="accent-violet-600" />
              自分の担当のみ
            </label>
          ) : undefined
        }
      >
        <div className="space-y-2">
          {sorted.map((b) => {
            const s = students.find((x) => x.id === b.studentId);
            const past = b.datetime < nowStr;
            const isToday = b.datetime.startsWith(todayStr());
            const mine = role === 'staff' && b.teacherId === me.id;
            return (
              <div
                key={b.id}
                className={cx('rounded-xl ring-1 p-3 flex flex-wrap items-center gap-3', past ? 'bg-slate-50 ring-slate-200 opacity-60' : isToday ? 'bg-violet-50 ring-violet-300' : 'bg-white ring-slate-200')}
              >
                <div className="w-16 text-center">
                  <div className="text-xs text-slate-500">{fmtDate(b.datetime.slice(0, 10))}</div>
                  <div className="font-mono font-bold">{b.datetime.slice(11)}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">
                    {s?.name ?? '(削除済)'} <span className="text-violet-700">第{lessonNo(b)}回</span>
                    {isToday && <span className="ml-2 text-xs bg-violet-600 text-white rounded px-1.5 py-0.5">TODAY</span>}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    講師 {staffName(b.teacherId)} · {b.teamsUrl}
                  </div>
                </div>
                {!past && (
                  <a
                    href={b.teamsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={cx(
                      'text-xs font-semibold rounded-lg px-3 py-1.5',
                      mine || role !== 'staff' ? 'bg-violet-600 hover:bg-violet-700 text-white' : 'bg-white ring-1 ring-violet-300 text-violet-700',
                    )}
                  >
                    Teams会議に参加
                  </a>
                )}
                {past && <span className="text-xs text-slate-500">✓ 受講済</span>}
                <button onClick={() => removeBooking(b.id)} className="text-slate-300 hover:text-red-600" aria-label="削除">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
          {sorted.length === 0 && <EmptyState>予約はありません</EmptyState>}
        </div>
      </Card>
    </div>
  );
}

/* ============================================================================
 * Tab 5: Work Log (DTR)
 * ==========================================================================*/

function DTRTab() {
  const { role, me, history, attendance, visits, now, toast } = useApp();
  const [period, setPeriod] = useState<Period>('week');
  const [staffFilter, setStaffFilter] = useState<string>(role === 'staff' ? me.id : 'all');
  const [csv, setCsv] = useState<string | null>(null);

  useEffect(() => setStaffFilter(role === 'staff' ? me.id : 'all'), [role, me.id]);

  const today = todayStr();
  const liveRows: DTRRow[] = STAFF.map((s) => {
    const a = attendance[s.id];
    const breakMin = a.breaks.reduce((sum, b) => sum + ((b.end ?? now) - b.start) / 60000, 0);
    const outingMin = visits
      .filter((v) => v.staffId === s.id && ymd(new Date(v.departAt)) === today)
      .reduce((sum, v) => sum + ((v.returnAt ?? now) - v.departAt) / 60000, 0);
    const workMin = a.clockIn ? Math.max(0, ((a.clockOut ?? now) - a.clockIn) / 60000 - breakMin) : 0;
    const late = a.clockIn ? new Date(a.clockIn).getHours() * 60 + new Date(a.clockIn).getMinutes() > 8 * 60 + 5 : false;
    return {
      date: today,
      staffId: s.id,
      clockIn: a.clockIn,
      clockOut: a.clockOut,
      breakMin: Math.round(breakMin),
      outingMin: Math.round(outingMin),
      workMin: Math.round(workMin),
      status: !a.clockIn ? 'Not yet' : a.clockOut ? (late ? 'Late' : 'Present') : `${STATUS_META[a.status].label}`,
      live: true,
    };
  });

  const from = useMemo(() => {
    const d = new Date();
    if (period === 'today') return today;
    if (period === 'week') {
      const dow = (d.getDay() + 6) % 7; // Monday start
      return ymd(addDays(d, -dow));
    }
    return ymd(new Date(d.getFullYear(), d.getMonth(), 1));
  }, [period, today]);

  const rows = [...history, ...liveRows]
    .filter((r) => r.date >= from && r.date <= today)
    .filter((r) => staffFilter === 'all' || r.staffId === staffFilter)
    .sort((a, b) => b.date.localeCompare(a.date) || STAFF.findIndex((s) => s.id === a.staffId) - STAFF.findIndex((s) => s.id === b.staffId));

  const summary = STAFF.filter((s) => staffFilter === 'all' || s.id === staffFilter).map((s) => {
    const rs = rows.filter((r) => r.staffId === s.id);
    return {
      s,
      days: rs.filter((r) => r.clockIn).length,
      late: rs.filter((r) => r.status === 'Late').length,
      absent: rs.filter((r) => r.status === 'Absent').length,
      work: rs.reduce((x, r) => x + r.workMin, 0),
      brk: rs.reduce((x, r) => x + r.breakMin, 0),
      out: rs.reduce((x, r) => x + r.outingMin, 0),
    };
  });

  const exportCsv = () => {
    const header = ['Date', 'Staff', 'Clock-In', 'Clock-Out', 'Break (min)', 'Outing (min)', 'Work Hours', 'Status'];
    const lines = rows
      .slice()
      .reverse()
      .map((r) =>
        [r.date, staffName(r.staffId), fmtHM(r.clockIn), r.clockOut ? fmtHM(r.clockOut) : r.live && r.clockIn ? '(working)' : '--:--', r.breakMin, r.outingMin, (r.workMin / 60).toFixed(2), r.status.replace(/[^\x20-\x7E]/g, '').trim() || 'Working']
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      );
    const text = [header.join(','), ...lines].join('\n');
    setCsv(text);
    try {
      const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DTR_${staffFilter === 'all' ? 'ALL' : staffName(staffFilter)}_${from}_${today}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(`📊 DTR CSV を出力しました（${rows.length}行）`, 'ok');
    } catch {
      toast('ダウンロードがブロックされました。プレビューからコピーしてください', 'warn');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className={labelCls}>期間</label>
            <Segmented value={period} onChange={setPeriod} options={[['today', '今日'], ['week', '今週'], ['month', '今月']]} />
          </div>
          <div>
            <label className={labelCls}>スタッフ</label>
            <select className={cx(inputCls, 'py-1.5 w-44')} value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} disabled={role === 'staff'}>
              {role !== 'staff' && <option value="all">全員 (5名)</option>}
              {STAFF.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="text-xs text-slate-500 pb-2">
            {fmtDate(from)} 〜 {fmtDate(today)} · {rows.length}件
          </div>
          <button onClick={exportCsv} className={cx(btn.green, 'ml-auto')}>
            <Download className="w-4 h-4" /> DTR CSVエクスポート
          </button>
        </div>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {summary.map(({ s, days, late, absent, work, brk, out }) => (
          <div key={s.id} className="bg-white rounded-2xl ring-1 ring-slate-200 p-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{s.avatar}</span>
              <span className="font-semibold">{s.name}</span>
            </div>
            <div className="text-2xl font-black mt-2 font-mono">{fmtDuration(work)}</div>
            <div className="text-xs text-slate-500">実働合計</div>
            <div className="grid grid-cols-3 gap-1 mt-2 text-center text-xs">
              <div className="bg-slate-50 rounded py-1">
                <div className="font-bold">{days}</div>出勤日
              </div>
              <div className="bg-yellow-50 rounded py-1">
                <div className="font-bold text-yellow-700">{late}</div>遅刻
              </div>
              <div className="bg-red-50 rounded py-1">
                <div className="font-bold text-red-600">{absent}</div>欠勤
              </div>
            </div>
            <div className="text-xs text-slate-500 mt-2">
              ☕ 休憩 {fmtDuration(brk)} · 🚗 外出 {fmtDuration(out)}
            </div>
          </div>
        ))}
      </div>

      <Card title="出退勤・休憩 集計表（DTR）" icon={<FileText className="w-5 h-5 text-slate-600" />}>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-3">日付</th>
                <th className="py-2 pr-3">スタッフ</th>
                <th className="py-2 pr-3">Clock-In</th>
                <th className="py-2 pr-3">Clock-Out</th>
                <th className="py-2 pr-3 text-right">休憩</th>
                <th className="py-2 pr-3 text-right">外出</th>
                <th className="py-2 pr-3 text-right">実働</th>
                <th className="py-2">ステータス</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.date}_${r.staffId}`} className={cx('border-b border-slate-100', r.live && 'bg-sky-50')}>
                  <td className="py-1.5 pr-3 whitespace-nowrap">
                    {fmtDate(r.date)} {r.live && <span className="text-xs text-sky-600 font-semibold">LIVE</span>}
                  </td>
                  <td className="py-1.5 pr-3">{staffName(r.staffId)}</td>
                  <td className="py-1.5 pr-3 font-mono">{fmtHM(r.clockIn)}</td>
                  <td className="py-1.5 pr-3 font-mono">{fmtHM(r.clockOut)}</td>
                  <td className="py-1.5 pr-3 font-mono text-right">{r.breakMin}m</td>
                  <td className="py-1.5 pr-3 font-mono text-right">{r.outingMin}m</td>
                  <td className="py-1.5 pr-3 font-mono text-right font-semibold">{fmtDuration(r.workMin)}</td>
                  <td className="py-1.5">
                    <span
                      className={cx(
                        'text-xs font-semibold px-2 py-0.5 rounded-full',
                        r.status === 'Present' && 'bg-emerald-100 text-emerald-800',
                        r.status === 'Late' && 'bg-yellow-100 text-yellow-800',
                        r.status === 'Absent' && 'bg-red-100 text-red-700',
                        r.live && r.status !== 'Present' && r.status !== 'Late' && 'bg-sky-100 text-sky-800',
                      )}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <EmptyState>該当期間のデータはありません</EmptyState>}
        </div>
      </Card>

      {csv !== null && (
        <Modal title="📊 CSV プレビュー（Excel / Google Sheets に貼り付け可）" onClose={() => setCsv(null)} wide>
          <textarea readOnly className={cx(inputCls, 'h-72 font-mono text-xs')} value={csv} onFocus={(e) => e.currentTarget.select()} />
          <div className="mt-3 flex justify-end gap-2">
            <button
              className={btn.ghost}
              onClick={() => {
                navigator.clipboard?.writeText(csv).then(
                  () => toast('クリップボードにコピーしました', 'ok'),
                  () => toast('コピーできませんでした。テキストを選択してコピーしてください', 'warn'),
                );
              }}
            >
              コピー
            </button>
            <button className={btn.dark} onClick={() => setCsv(null)}>
              閉じる
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
