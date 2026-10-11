"use client";

/**
 * Cebu Sync — Phase 1 (簡易版)
 * セブ島オフィス（スタッフ5名・管理者不在）向け 業務マネジメント Web アプリ
 *
 * 単一ファイル React + TypeScript + Tailwind CSS + lucide-react
 * 英語（現地スタッフ）／日本語（GM・HQO）のワンタップ切り替えに対応。
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
  Globe,
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
  Settings,
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

type Lang = 'en' | 'ja';
/** 2言語テキスト。ユーザー入力は string、システム文言・モックデータは Bi */
type Bi = { en: string; ja: string };
type Text = string | Bi;

type Role = 'staff' | 'gm' | 'hqo';
type TabKey = 'dashboard' | 'tasks' | 'transit' | 'students' | 'dtr' | 'settings';
type AttStatus = 'off' | 'working' | 'break' | 'transit' | 'visiting' | 'out';
type Category = 'docs' | 'visit' | 'facility' | 'accounting' | 'lesson' | 'other';
type ApprovalType = 'HQO' | 'GM';
type ApprovalStatus = 'pending' | 'approved' | 'revision' | 'rejected';
type BlockerReason = 'gov' | 'jpdocs' | 'network' | 'overload';
type TransitPhase = 'none' | 'transit' | 'arrived' | 'done';
type TaskStatus = 'todo' | 'in_progress' | 'done';
type Tone = 'info' | 'ok' | 'warn' | 'danger';
type Period = 'today' | 'week' | 'month';
type DTRStatus = 'present' | 'late' | 'absent' | 'notyet' | AttStatus;

interface Staff {
  id: string;
  name: string;
  title: Text;
  avatar: string;
  /** 兼任している ROLE（JobRole.id）。複数可・他スタッフと重複可 */
  roles: string[];
  /** false = 無効化（ロールバー・担当者候補などから外れる。過去データの表示には残る） */
  active: boolean;
}

/** 社内の担当 ROLE（例: HR & Admin）。アプリの表示ロール（Staff / GM / HQO）とは別物 */
interface JobRole {
  id: string;
  label: Text;
  color: string;
  custom?: boolean;
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
  label: Text;
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
  reason: Bi;
  note?: string;
  decidedBy?: string;
  decidedAt?: number;
}

interface Task {
  id: string;
  category: Category;
  subCategory: Text;
  title: Text;
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
  levelSystem: 'CEFR' | 'EIKEN';
  level: string;
  mode: 'face' | 'online';
  pastLessons: number;
  /** 対面のみ: 受講期間（YYYY-MM-DD） */
  startDate?: string;
  endDate?: string;
  /** 対面のみ: 1日の受講時間帯（HH:mm）。この範囲に収まる標準コマが受講対象 */
  startTime?: string;
  endTime?: string;
}

/** 標準コマ（各50分・12:00-13:00 昼休憩） */
interface StdSlot {
  no: number;
  start: string;
  end: string;
}

interface Subject {
  id: string;
  name: Text;
  custom?: boolean;
}

/** 対面授業 1コマ分のアサイン（日付 × 生徒 × コマ） */
interface Lesson {
  id: string;
  date: string;
  studentId: string;
  slotNo: number;
  subjectId?: string;
  teacherId?: string;
  /** 講師がアサインされた時刻（本日のマイルストーンの NEW 表示用） */
  assignedAt?: number;
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
  text: Text;
  tone: Tone;
}

interface Toast {
  id: string;
  text: Text;
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
  status: DTRStatus;
  live?: boolean;
}

/* ============================================================================
 * i18n helpers
 * ==========================================================================*/

const bi = (en: string, ja: string): Bi => ({ en, ja });
const tx = (lang: Lang, t: Text) => (typeof t === 'string' ? t : t[lang]);
/** キーワード判定用に両言語をつなげた文字列 */
const both = (t: Text) => (typeof t === 'string' ? t : `${t.en} ${t.ja}`);

/* ============================================================================
 * Constants & mock master data
 * ==========================================================================*/

const ROLE_COLORS = [
  'bg-indigo-50 text-indigo-700 ring-indigo-200',
  'bg-emerald-50 text-emerald-700 ring-emerald-200',
  'bg-pink-50 text-pink-700 ring-pink-200',
  'bg-orange-50 text-orange-700 ring-orange-200',
  'bg-teal-50 text-teal-700 ring-teal-200',
  'bg-violet-50 text-violet-700 ring-violet-200',
  'bg-amber-50 text-amber-800 ring-amber-200',
  'bg-sky-50 text-sky-700 ring-sky-200',
  'bg-rose-50 text-rose-700 ring-rose-200',
  'bg-lime-50 text-lime-800 ring-lime-200',
];

const DEFAULT_JOB_ROLES: JobRole[] = [
  { id: 'hr', label: bi('HR & Admin', '人事・総務'), color: ROLE_COLORS[0] },
  { id: 'accounting', label: bi('Accounting & BIR', '経理・BIR'), color: ROLE_COLORS[1] },
  { id: 'academic', label: bi('Academic & Lessons', '教務・レッスン'), color: ROLE_COLORS[2] },
  { id: 'visits', label: bi('External Visits', '対外訪問'), color: ROLE_COLORS[3] },
  { id: 'facilities', label: bi('Facilities & IT', '設備・IT'), color: ROLE_COLORS[4] },
  { id: 'teachers', label: bi('Teacher Management', '講師管理'), color: ROLE_COLORS[5] },
];

/** タスクの大分類ごとに「向いている ROLE」（担当者選びで ★ おすすめ表示） */
const CATEGORY_ROLES: Record<string, string[]> = {
  docs: ['hr'],
  visit: ['visits'],
  facility: ['facilities'],
  accounting: ['accounting'],
  lesson: ['academic', 'teachers'],
  other: [],
};
/** レッスン担当（時間割・オンライン予約で ★ おすすめ表示） */
const LESSON_ROLES = ['academic', 'teachers'];

const INITIAL_STAFF: Staff[] = [
  { id: 'alyssa', name: 'Alyssa', title: bi('Admin / Visa', '総務・ビザ'), avatar: '👩🏻', roles: ['hr', 'visits', 'teachers'], active: true },
  { id: 'mark', name: 'Mark', title: bi('Accounting / BIR', '経理・BIR'), avatar: '👨🏽', roles: ['accounting', 'visits'], active: true },
  { id: 'daisy', name: 'Daisy', title: bi('Petty Cash / Office', '小口現金・庶務'), avatar: '👩🏽', roles: ['accounting', 'hr'], active: true },
  { id: 'john', name: 'John', title: bi('Banking / Facilities', '銀行・設備'), avatar: '👨🏻', roles: ['facilities', 'accounting', 'visits'], active: true },
  { id: 'maria', name: 'Maria', title: bi('Teacher / Lessons', '講師・レッスン'), avatar: '👩🏾', roles: ['academic', 'teachers'], active: true },
];

const AVATARS = ['👩🏻', '👨🏻', '👩🏽', '👨🏽', '👩🏾', '👨🏾', '🧑🏻', '🧑🏽'];
const hasAnyRole = (s: Staff, roles: string[]) => roles.some((r) => s.roles.includes(r));

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

const CATEGORIES: Category[] = ['docs', 'visit', 'facility', 'accounting', 'lesson', 'other'];

const CATEGORY_LABEL: Record<Category, Bi> = {
  docs: bi('Documents', 'ドキュメント'),
  visit: bi('External Visit', '対外訪問'),
  facility: bi('Facilities', '設備管理'),
  accounting: bi('Accounting', '会計'),
  lesson: bi('Lessons', 'レッスン'),
  other: bi('Other', 'その他'),
};

const SUBCATEGORIES: Record<Category, Bi[]> = {
  docs: [bi('Visa (BI / SSP)', 'ビザ申請 (BI / SSP)'), bi('TESDA', 'TESDA手続き'), bi('Employment Contract', '雇用契約'), bi('Internal Documents', '社内文書')],
  visit: [bi('Government Office', '役所訪問'), bi('Bank Visit', '銀行訪問'), bi('Shopping / Supplies', '買い出し'), bi('Client Visit', '取引先訪問')],
  facility: [bi('Repair', '修繕'), bi('Equipment Purchase', '備品調達'), bi('Cleaning / Inspection', '清掃・点検'), bi('IT / Internet', 'IT / ネット回線')],
  accounting: [bi('Petty Cash', '小口現金'), bi('Bank Withdrawal', '口座出金'), bi('Tax Filing (BIR)', '税務申告 (BIR)'), bi('Payroll', '給与'), bi('Fixed Cost Payment', '固定費支払い')],
  lesson: [bi('Materials Prep', '教材準備'), bi('Face-to-face Lesson', '対面レッスン'), bi('Online Lesson', 'オンラインレッスン'), bi('Student Support', '生徒対応')],
  other: [bi('Other', 'その他')],
};

const CATEGORY_STYLE: Record<Category, string> = {
  docs: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  visit: 'bg-orange-50 text-orange-700 ring-orange-200',
  facility: 'bg-teal-50 text-teal-700 ring-teal-200',
  accounting: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  lesson: 'bg-pink-50 text-pink-700 ring-pink-200',
  other: 'bg-slate-100 text-slate-700 ring-slate-200',
};

const STATUS_META: Record<AttStatus, { label: Bi; pill: string; dot: string }> = {
  off: { label: bi('⚪ Not in', '⚪ 未出勤'), pill: 'bg-slate-100 text-slate-600', dot: 'bg-slate-300' },
  working: { label: bi('🟢 Working', '🟢 勤務中'), pill: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
  break: { label: bi('☕ On Break', '☕ 休憩中'), pill: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-400' },
  transit: { label: bi('🚗 In Transit', '🚗 移動中'), pill: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
  visiting: { label: bi('📍 On Site', '📍 訪問先'), pill: 'bg-sky-100 text-sky-800', dot: 'bg-sky-500' },
  out: { label: bi('🏁 Clocked Out', '🏁 退勤済'), pill: 'bg-slate-200 text-slate-700', dot: 'bg-slate-500' },
};

const DTR_STATUS_LABEL: Record<'present' | 'late' | 'absent' | 'notyet', Bi> = {
  present: bi('Present', '出勤'),
  late: bi('Late', '遅刻'),
  absent: bi('Absent', '欠勤'),
  notyet: bi('Not yet', '未出勤'),
};

const BLOCKERS: Record<BlockerReason, Bi> = {
  gov: bi('🏛️ Waiting on Gov’t Office', '🏛️ 役所待ち'),
  jpdocs: bi('📄 Waiting on Japan Docs', '📄 日本側書類待ち'),
  network: bi('💻 Internet Down', '💻 ネット不調'),
  overload: bi('⏳ Too Much Work', '⏳ 業務過多'),
};

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const EIKEN_LEVELS = ['5級', '4級', '3級', '準2級', '2級', '準1級', '1級'];
const EIKEN_EN: Record<string, string> = {
  '5級': 'Grade 5',
  '4級': 'Grade 4',
  '3級': 'Grade 3',
  '準2級': 'Grade Pre-2',
  '2級': 'Grade 2',
  '準1級': 'Grade Pre-1',
  '1級': 'Grade 1',
};
const levelName = (lang: Lang, system: Student['levelSystem'], level: string) =>
  system === 'CEFR' ? level : lang === 'ja' ? level : EIKEN_EN[level] ?? level;
const levelText = (lang: Lang, s: Pick<Student, 'levelSystem' | 'level'>) =>
  `${s.levelSystem === 'CEFR' ? 'CEFR' : lang === 'ja' ? '英検' : 'EIKEN'} ${levelName(lang, s.levelSystem, s.level)}`;

const HQO_THRESHOLD = 15000;

const STD_SLOTS: StdSlot[] = [
  { no: 1, start: '08:00', end: '08:50' },
  { no: 2, start: '09:00', end: '09:50' },
  { no: 3, start: '10:00', end: '10:50' },
  { no: 4, start: '11:00', end: '11:50' },
  { no: 5, start: '13:00', end: '13:50' },
  { no: 6, start: '14:00', end: '14:50' },
  { no: 7, start: '15:00', end: '15:50' },
  { no: 8, start: '16:00', end: '16:50' },
  { no: 9, start: '17:00', end: '17:50' },
];
const slotOf = (no: number) => STD_SLOTS.find((x) => x.no === no);
/** 受講時間帯の選択肢（08:00〜18:00） */
const START_TIMES = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
const END_TIMES = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
/** 生徒の受講時間帯に収まる標準コマ */
const slotsInWindow = (startTime?: string, endTime?: string) =>
  startTime && endTime ? STD_SLOTS.filter((x) => x.start >= startTime && x.end <= endTime) : [];
const isEnrolledOn = (st: Student, date: string) =>
  st.mode === 'face' && !!st.startDate && !!st.endDate && st.startDate <= date && date <= st.endDate;

const DEFAULT_SUBJECTS: Subject[] = [
  { id: 'speaking', name: bi('Speaking', 'スピーキング') },
  { id: 'listening', name: bi('Listening', 'リスニング') },
  { id: 'reading', name: bi('Reading', 'リーディング') },
  { id: 'writing', name: bi('Writing', 'ライティング') },
  { id: 'vocabulary', name: bi('Vocabulary', '語彙') },
  { id: 'grammar', name: bi('Grammar', '文法') },
  { id: 'pronunciation', name: bi('Pronunciation', '発音') },
  { id: 'business', name: bi('Business English', 'ビジネス英語') },
];

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
const nowTs = () => Date.now();
/** 目的地から半径25m以内のランダムなチェックイン位置（擬似GPS） */
const pinNear = (p: { lat: number; lng: number }) => offsetPoint(p.lat, p.lng, Math.random() * 25, Math.random() * Math.PI * 2);

const fmtHM = (ts?: number) =>
  ts ? new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '--:--';
const fmtHMS = (ts?: number) =>
  ts ? new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--';
const fmtDate = (lang: Lang, s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (lang === 'ja') return `${m}/${d} (${'日月火水木金土'[dt.getDay()]})`;
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};
const fmtDuration = (min: number) => `${Math.floor(min / 60)}h ${pad(Math.round(min % 60))}m`;
const fmtPhp = (n: number) => `₱${n.toLocaleString('en-US')}`;
const tzClock = (tz: string, now: number) =>
  new Date(now).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: tz });

const destOf = (id?: string) => DESTINATIONS.find((d) => d.id === id);
const trayName = (type: ApprovalType): Bi =>
  type === 'HQO' ? bi('🏦 HQO Payment Approval', '🏦 HQO出金承認') : bi('👔 GM Approval', '👔 GM統括承認');

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
  subCategory: Text;
  title: Text;
  requiresOuting: boolean;
  requiresExpense: boolean;
  amount: number;
}): { type: ApprovalType; reason: Bi } | null {
  const text = `${t.category} ${both(t.subCategory)} ${both(t.title)}`.toLowerCase();
  // [判定に使う語, 英語表示, 日本語表示]
  const hqoKw: Array<[string, string, string]> = [
    ['出金', 'withdrawal', '出金'],
    ['給与', 'payroll', '給与'],
    ['口座', 'bank account', '口座'],
    ['振込', 'bank transfer', '振込'],
    ['固定費', 'fixed cost', '固定費'],
    ['payroll', 'payroll', '給与'],
    ['withdraw', 'withdrawal', '出金'],
    ['salary', 'salary', '給与'],
    ['fixed cost', 'fixed cost', '固定費'],
    ['bank transfer', 'bank transfer', '振込'],
  ];
  const hit = hqoKw.find(([k]) => text.includes(k));
  if (hit) return { type: 'HQO', reason: bi(`Bank withdrawal / payroll (keyword: ${hit[1]})`, `口座出金・給与系（キーワード: ${hit[2]}）`) };
  if (t.requiresExpense && t.amount >= HQO_THRESHOLD)
    return {
      type: 'HQO',
      reason: bi(`Expense of ${fmtPhp(HQO_THRESHOLD)} or more (${fmtPhp(t.amount)})`, `${fmtPhp(HQO_THRESHOLD)} 以上の費用（${fmtPhp(t.amount)}）`),
    };
  const gmKw: Array<[string, string, string]> = [
    ['visa', 'VISA', 'VISA'],
    ['ビザ', 'VISA', 'ビザ'],
    ['ssp', 'SSP', 'SSP'],
    ['tesda', 'TESDA', 'TESDA'],
    ['雇用', 'employment', '雇用'],
    ['契約', 'contract', '契約'],
    ['公的', 'government', '公的手続き'],
    ['bir', 'BIR', 'BIR'],
    ['immigration', 'immigration', '入管'],
    ['役所', 'government office', '役所'],
    ['contract', 'contract', '契約'],
    ['employment', 'employment', '雇用'],
    ['government', 'government', '公的手続き'],
  ];
  const gmHit = gmKw.find(([k]) => text.includes(k));
  if (gmHit)
    return {
      type: 'GM',
      reason: bi(`Government procedure / contract (keyword: ${gmHit[1]})`, `公的手続き・契約（キーワード: ${gmHit[2]}）`),
    };
  if (t.requiresOuting) return { type: 'GM', reason: bi('Outing / external visit', '外出・対外訪問') };
  if (t.requiresExpense) return { type: 'GM', reason: bi(`Small expense (${fmtPhp(t.amount)})`, `少額費用（${fmtPhp(t.amount)}）`) };
  return null;
}

const isMsDelayed = (m: Milestone) => !m.done && m.due < todayStr();
const isTaskDelayed = (t: Task) =>
  t.status !== 'done' && (t.dueDate < todayStr() || t.milestones.some(isMsDelayed));
const canStartOuting = (t: Task) => !t.approval || t.approval.status === 'approved';

/* ============================================================================
 * Initial mock data
 * ==========================================================================*/

function ms(label: Bi, due: string, done = false): Milestone {
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
      category: 'docs',
      subCategory: SUBCATEGORIES.docs[0],
      title: bi('BI Visa SSP application (new student Yamada Taro)', 'BI Visa SSP申請（新入生 Yamada Taro）'),
      assigneeId: 'alyssa',
      dueDate: dayRel(4),
      requiresOuting: true,
      destinationId: 'bi',
      milestones: [
        ms(bi('Check required documents', '必要書類リスト確認'), dayRel(-4), true),
        ms(bi('Receive passport copy from Japan', '日本側パスポートコピー受領'), dayRel(-1)),
        ms(bi('Submit at BI counter', 'BI窓口へ提出'), dayRel(2)),
        ms(bi('Receive SSP & notify student', 'SSP受領・生徒へ連絡'), dayRel(4)),
      ],
    }),
    makeTask({
      category: 'accounting',
      subCategory: SUBCATEGORIES.accounting[2],
      title: bi('BIR tax filing (monthly 2550M / 1601C)', 'BIR税務申告（月次 2550M / 1601C）'),
      assigneeId: 'mark',
      dueDate: dayRel(1),
      requiresOuting: true,
      destinationId: 'bir',
      approval: {
        type: 'GM',
        status: 'approved',
        reason: bi('Government procedure / contract (keyword: BIR)', '公的手続き・契約（キーワード: BIR）'),
        decidedBy: 'GM',
        decidedAt: minsAgo(300),
      },
      transitPhase: 'transit',
      milestones: [
        ms(bi('Compile sales & withholding data', '売上・源泉データ集計'), dayRel(-2), true),
        ms(bi('Prepare return (eBIRForms)', '申告書作成 (eBIRForms)'), dayRel(0), true),
        ms(bi('File at BIR & get stamped copy', 'BIR窓口提出・受領印'), dayRel(1)),
      ],
    }),
    makeTask({
      category: 'accounting',
      subCategory: SUBCATEGORIES.accounting[0],
      title: bi('Petty cash weekly reconciliation', '小口現金まとめ（Petty Cash 週次精算）'),
      assigneeId: 'daisy',
      dueDate: dayRel(0),
      milestones: [
        ms(bi('Collect receipts', 'レシート回収'), dayRel(-2), true),
        ms(bi('Enter in Excel & classify', 'Excel入力・科目仕訳'), dayRel(-1)),
        ms(bi('Reconcile balance & report to GM', '残高照合・GMへ報告'), dayRel(0)),
      ],
      blocker: { reason: 'overload', at: minsAgo(95), by: 'Daisy' },
    }),
    makeTask({
      category: 'accounting',
      subCategory: SUBCATEGORIES.accounting[4],
      title: bi('UnionBank fixed cost payment (rent, power, internet)', 'UnionBank固定費支払い（家賃・電気・ネット）'),
      assigneeId: 'john',
      dueDate: dayRel(2),
      requiresExpense: true,
      requiresOuting: true,
      amount: 85400,
      destinationId: 'unionbank',
      milestones: [
        ms(bi('Gather invoices', '請求書取りまとめ'), dayRel(-1), true),
        ms(bi('HQO payment approval', 'HQO出金承認'), dayRel(1)),
        ms(bi('Execute UnionBank transfer', 'UnionBank振込実行'), dayRel(2)),
      ],
    }),
    makeTask({
      category: 'facility',
      subCategory: SUBCATEGORIES.facility[0],
      title: bi('Classroom aircon repair (2 contractor quotes)', '教室エアコン修理（業者見積 2社）'),
      assigneeId: 'john',
      dueDate: dayRel(5),
      requiresExpense: true,
      amount: 18500,
      milestones: [
        ms(bi('Get quotes', '見積取得'), dayRel(1)),
        ms(bi('Book contractor', '業者手配'), dayRel(3)),
        ms(bi('Confirm repair done', '修理完了確認'), dayRel(5)),
      ],
    }),
    makeTask({
      category: 'docs',
      subCategory: SUBCATEGORIES.docs[2],
      title: bi('Review employment contract for new teacher', '新規講師 雇用契約書レビュー'),
      assigneeId: 'alyssa',
      dueDate: dayRel(3),
      milestones: [
        ms(bi('Draft contract', '契約書ドラフト作成'), dayRel(1)),
        ms(bi('GM review', 'GMレビュー'), dayRel(2)),
        ms(bi('Sign & file', '署名・保管'), dayRel(3)),
      ],
    }),
    makeTask({
      category: 'visit',
      subCategory: SUBCATEGORIES.visit[2],
      title: bi('Buy stationery & lesson supplies at Parkmall', 'Parkmall 文房具・教材用品の購入'),
      assigneeId: 'alyssa',
      dueDate: dayRel(0),
      requiresOuting: true,
      requiresExpense: true,
      amount: 2350,
      destinationId: 'parkmall',
      approval: {
        type: 'GM',
        status: 'approved',
        reason: bi('Outing / external visit', '外出・対外訪問'),
        decidedBy: 'GM',
        decidedAt: minsAgo(120),
      },
      status: 'todo',
      milestones: [
        ms(bi('Make shopping list', '購入リスト作成'), dayRel(-1), true),
        ms(bi('Buy at Parkmall & get receipt', 'Parkmallで購入・領収書受領'), dayRel(0)),
      ],
    }),
    makeTask({
      category: 'lesson',
      subCategory: SUBCATEGORIES.lesson[0],
      title: bi('Kids class face-to-face materials (Week 3)', 'Kidsクラス 対面レッスン教材準備（Week 3）'),
      assigneeId: 'maria',
      dueDate: dayRel(1),
      milestones: [
        ms(bi('Make worksheets', 'ワークシート作成'), dayRel(0), true),
        ms(bi('Print flashcards', 'フラッシュカード印刷'), dayRel(1)),
      ],
    }),
    makeTask({
      category: 'docs',
      subCategory: SUBCATEGORIES.docs[1],
      title: bi('Submit TESDA trainer (TMC) renewal documents', 'TESDA 講師資格 (TMC) 更新書類提出'),
      assigneeId: 'maria',
      dueDate: dayRel(-1),
      requiresOuting: true,
      destinationId: 'tesda',
      milestones: [
        ms(bi('Fill in application form', '申請書記入'), dayRel(-3), true),
        ms(bi('Submit at TESDA counter', 'TESDA窓口提出'), dayRel(-1)),
      ],
    }),
  ];
}

/** タスクと移動ログの初期データ（Mark の移動中ログを BIR タスクに紐付け） */
function initialTasksAndVisits(): { tasks: Task[]; visits: VisitLog[] } {
  const tasks = initialTasks();
  const bir = tasks.find((t) => t.assigneeId === 'mark' && t.destinationId === 'bir');
  const visits: VisitLog[] = [
    { id: 'v_seed_1', staffId: 'mark', taskId: bir?.id ?? '', destinationId: 'bir', departAt: minsAgo(18) },
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
  ];
  return { tasks, visits };
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
    {
      id: 'st_yamada',
      name: 'Yamada Taro',
      ageGroup: 'Adult',
      levelSystem: 'CEFR',
      level: 'A2',
      mode: 'face',
      pastLessons: 5,
      startDate: dayRel(-10),
      endDate: dayRel(50),
      startTime: '08:00',
      endTime: '17:00',
    },
    { id: 'st_kato', name: 'Ken Kato', ageGroup: 'Adult', levelSystem: 'CEFR', level: 'B1', mode: 'online', pastLessons: 1 },
    {
      id: 'st_sato',
      name: 'Sato Hana',
      ageGroup: 'Kids',
      levelSystem: 'EIKEN',
      level: '4級',
      mode: 'face',
      pastLessons: 3,
      startDate: dayRel(-5),
      endDate: dayRel(25),
      startTime: '13:00',
      endTime: '16:00',
    },
    { id: 'st_suzuki', name: 'Suzuki Yui', ageGroup: 'Kids', levelSystem: 'EIKEN', level: '3級', mode: 'online', pastLessons: 0 },
    {
      id: 'st_tanaka',
      name: 'Tanaka Ryo',
      ageGroup: 'Adult',
      levelSystem: 'CEFR',
      level: 'B2',
      mode: 'face',
      pastLessons: 8,
      startDate: dayRel(0),
      endDate: dayRel(30),
      startTime: '09:00',
      endTime: '12:00',
    },
  ];
}

function initialLessons(): Lesson[] {
  const d = todayStr();
  const l = (studentId: string, slotNo: number, subjectId?: string, teacherId?: string): Lesson => ({
    id: uid('ls'),
    date: d,
    studentId,
    slotNo,
    subjectId,
    teacherId,
  });
  return [
    l('st_yamada', 1, 'speaking', 'alyssa'),
    l('st_yamada', 2, 'listening', 'maria'),
    l('st_yamada', 3, 'grammar', 'maria'),
    l('st_tanaka', 2, 'business', 'alyssa'),
    l('st_tanaka', 3, 'reading'),
    l('st_sato', 5, 'vocabulary', 'maria'),
  ];
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
    for (const s of INITIAL_STAFF) {
      const r = seeded(s.id + date);
      if (r() < 0.04) {
        rows.push({ date, staffId: s.id, breakMin: 0, outingMin: 0, workMin: 0, status: 'absent' });
        continue;
      }
      const inMin = 7 * 60 + 38 + Math.floor(r() * 36);
      const outMin = 17 * 60 + Math.floor(r() * 50);
      const breakMin = 50 + Math.floor(r() * 20);
      const outingMin = r() < 0.3 ? 30 + Math.floor(r() * 100) : 0;
      rows.push({
        date,
        staffId: s.id,
        clockIn: d.getTime() + inMin * 60000,
        clockOut: d.getTime() + outMin * 60000,
        breakMin,
        outingMin,
        workMin: outMin - inMin - breakMin,
        status: inMin > 8 * 60 + 5 ? 'late' : 'present',
      });
    }
  }
  return rows;
}

/* ============================================================================
 * App context
 * ==========================================================================*/

interface AppCtx {
  lang: Lang;
  /** 現在の言語の文言を返す: L('English', '日本語') */
  L: (en: string, ja: string) => string;
  /** Text（string | Bi）を現在の言語で表示 */
  T: (t: Text) => string;
  role: Role;
  me: Staff;
  actorLabel: string;
  /** 全スタッフ（無効化済みを含む） */
  staff: Staff[];
  /** 有効なスタッフのみ */
  activeStaff: Staff[];
  jobRoles: JobRole[];
  staffName: (id?: string | null) => string;
  staffOf: (id: string) => Staff;
  roleNames: (ids: string[]) => string;
  saveStaff: (id: string, patch: { name: string; roles: string[] }) => void;
  addStaff: (p: { name: string; avatar: string; roles: string[] }) => void;
  setStaffActive: (id: string, active: boolean) => void;
  addJobRole: (label: string) => boolean;
  removeJobRole: (id: string) => void;
  now: number;
  attendance: Record<string, Attendance>;
  tasks: Task[];
  visits: VisitLog[];
  students: Student[];
  lessons: Lesson[];
  subjects: Subject[];
  bookings: OnlineBooking[];
  feed: FeedItem[];
  history: DTRRow[];
  gpsMode: 'office' | 'outside';
  gpsBusy: boolean;
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
  /** 対面授業のアサイン。講師が同じ日・同じコマで他の生徒に入っている場合は false（拒否） */
  setLesson: (date: string, studentId: string, slotNo: number, patch: { subjectId?: string | null; teacherId?: string | null }) => boolean;
  /** その日・そのコマで講師が他の生徒を担当中なら、その生徒名 */
  busyWith: (date: string, slotNo: number, teacherId: string, exceptStudentId?: string) => string | null;
  subjectName: (id?: string) => string;
  addSubject: (name: string) => boolean;
  removeSubject: (id: string) => void;
  addBooking: (b: Omit<OnlineBooking, 'id'>) => void;
  removeBooking: (id: string) => void;
  lessonNo: (b: OnlineBooking) => number;
  toast: (text: Text, tone?: Tone) => void;
}

const Ctx = createContext<AppCtx | null>(null);
const useApp = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('AppCtx missing');
  return c;
};

/** 言語の初期値: 現地スタッフは英語、GM / HQO は日本語 */
const defaultLang = (r: Role): Lang => (r === 'staff' ? 'en' : 'ja');

/* ============================================================================
 * Root component
 * ==========================================================================*/

export default function CebuSyncApp() {
  const [role, setRoleState] = useState<Role>('staff');
  const [lang, setLang] = useState<Lang>(defaultLang('staff'));
  const [meId, setMeId] = useState('alyssa');
  const [staff, setStaff] = useState<Staff[]>(INITIAL_STAFF);
  const [jobRoles, setJobRoles] = useState<JobRole[]>(DEFAULT_JOB_ROLES);
  const [tab, setTab] = useState<TabKey>('dashboard');
  const [now, setNow] = useState(() => Date.now());
  const [attendance, setAttendance] = useState<Record<string, Attendance>>(initialAttendance);
  const [seed] = useState(initialTasksAndVisits);
  const [tasks, setTasks] = useState<Task[]>(seed.tasks);
  const [visits, setVisits] = useState<VisitLog[]>(seed.visits);
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [lessons, setLessons] = useState<Lesson[]>(initialLessons);
  const [subjects, setSubjects] = useState<Subject[]>(DEFAULT_SUBJECTS);
  const [bookings, setBookings] = useState<OnlineBooking[]>(initialBookings);
  const [feed, setFeed] = useState<FeedItem[]>(() => [
    {
      id: uid('f'),
      at: minsAgo(18),
      text: bi('🚗 Mark left for BIR RDO 81 (BIR tax filing)', '🚗 Mark が BIR RDO 81 へ出発しました（BIR税務申告）'),
      tone: 'info',
    },
    {
      id: uid('f'),
      at: minsAgo(95),
      text: bi('⚠️ Daisy reported a blocker: ⏳ Too Much Work — "Petty cash weekly reconciliation"', '⚠️ Daisy がBlocker申告: ⏳ 業務過多 —「小口現金まとめ」'),
      tone: 'warn',
    },
    {
      id: uid('f'),
      at: minsAgo(120),
      text: bi('✅ GM approved "Buy stationery & lesson supplies at Parkmall"', '✅ GM が「Parkmall 文房具・教材用品の購入」を承認しました'),
      tone: 'ok',
    },
  ]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [history] = useState<DTRRow[]>(buildHistory);
  const [gpsMode, setGpsMode] = useState<'office' | 'outside'>('office');
  const [gpsBusy, setGpsBusy] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);

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

  // ブラウザ・読み上げソフト向けに <html lang> を合わせる
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const L = (en: string, ja: string) => (lang === 'ja' ? ja : en);
  const T = (t: Text) => tx(lang, t);

  // ロール切替時は、そのロールの既定言語に合わせる（その後はワンタップで自由に切替可）
  const setRole = (r: Role) => {
    setRoleState(r);
    setLang(defaultLang(r));
    // スタッフ設定タブは GM / HQO 専用
    if (r === 'staff' && tab === 'settings') setTab('dashboard');
  };

  const activeStaff = staff.filter((s) => s.active);
  const staffName = (id?: string | null) => staff.find((s) => s.id === id)?.name ?? '—';
  const staffOf = (id: string) => staff.find((s) => s.id === id) ?? activeStaff[0] ?? staff[0];
  const roleNames = (ids: string[]) =>
    ids
      .map((id) => jobRoles.find((r) => r.id === id))
      .filter((r): r is JobRole => !!r)
      .map((r) => T(r.label))
      .join(', ');
  const me = staffOf(meId);
  const actorLabel = role === 'staff' ? me.name : role === 'gm' ? 'GM' : 'HQO';

  const toast = (text: Text, tone: Tone = 'info') => {
    const id = uid('toast');
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  };
  const pushFeed = (text: Text, tone: Tone = 'info') =>
    setFeed((f) => [{ id: uid('f'), at: Date.now(), text, tone }, ...f].slice(0, 40));

  const patchAtt = (id: string, fn: (a: Attendance) => Attendance) =>
    setAttendance((prev) => ({ ...prev, [id]: fn(prev[id]) }));
  const patchTask = (id: string, fn: (t: Task) => Task) => setTasks((ts) => ts.map((t) => (t.id === id ? fn(t) : t)));
  /** タスク名を両言語で（ユーザー入力の名前はそのまま） */
  const titleBi = (t?: Task): Bi => (t ? { en: tx('en', t.title), ja: tx('ja', t.title) } : bi('', ''));

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
        pushFeed(bi(`🟢 ${me.name} clocked in (${fix.distance}m from office)`, `🟢 ${me.name} が出勤打刻しました（事務所から ${fix.distance}m）`), 'ok');
        toast(
          bi(`Clocked in — ${fix.distance}m from office (±${fix.accuracy}m)`, `Clock-In 完了 — 事務所から ${fix.distance}m（±${fix.accuracy}m）`),
          'ok',
        );
      } else {
        patchAtt(meId, (x) => ({ ...x, lastFix: fix }));
        toast(
          bi(
            `Can't clock in: you are ${fix.distance}m from the office. Move within ${GEOFENCE_M}m and try again.`,
            `打刻不可: 事務所から ${fix.distance}m。半径${GEOFENCE_M}m以内で再試行してください`,
          ),
          'danger',
        );
      }
    }, 1100);
  };

  const clockOut = () => {
    const a = attendance[meId];
    if (a.status === 'transit' || a.status === 'visiting') {
      toast(bi('You can’t clock out while on an outing. Finish the visit first.', '外出中は退勤できません。先に訪問を完了してください'), 'warn');
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
    pushFeed(bi(`🏁 ${me.name} clocked out`, `🏁 ${me.name} が退勤しました`), 'info');
    toast(bi('Clocked out — location tracking is fully stopped', 'Clock-Out 完了 — 位置情報の取得を完全に停止しました'), 'ok');
  };

  const breakStart = () => {
    if (attendance[meId].status !== 'working') return;
    patchAtt(meId, (x) => ({ ...x, status: 'break', breaks: [...x.breaks, { start: Date.now() }], lastPing: undefined }));
    pushFeed(bi(`☕ ${me.name} started a break`, `☕ ${me.name} が休憩に入りました`), 'info');
    toast(bi('☕ Break started — location tracking paused', '☕ 休憩開始 — 位置情報トラッキングを一時停止しました'), 'info');
  };

  const breakEnd = () => {
    if (attendance[meId].status !== 'break') return;
    patchAtt(meId, (x) => ({
      ...x,
      status: 'working',
      breaks: x.breaks.map((b) => (b.end ? b : { ...b, end: Date.now() })),
      lastPing: Date.now(),
    }));
    pushFeed(bi(`🟢 ${me.name} is back from break`, `🟢 ${me.name} が休憩から業務に復帰しました`), 'info');
    toast(bi('Break ended — tracking resumed', '休憩終了 — トラッキングを再開しました'), 'ok');
  };

  /* ---------- Tasks ---------- */
  const addTask = (t: Task) => {
    setTasks((ts) => [t, ...ts]);
    const who = staffName(t.createdBy) !== '—' ? staffName(t.createdBy) : actorLabel;
    const tb = titleBi(t);
    pushFeed(
      t.approval
        ? bi(`🆕 ${who} created "${tb.en}" (sent to ${t.approval.type} tray)`, `🆕 ${who} が新規タスクを起票:「${tb.ja}」（${t.approval.type}承認トレイへ）`)
        : bi(`🆕 ${who} created "${tb.en}"`, `🆕 ${who} が新規タスクを起票:「${tb.ja}」`),
      'info',
    );
    if (t.approval) {
      const tray = trayName(t.approval.type);
      toast(bi(`Task created and sent to the ${tray.en} tray`, `タスクを登録し「${tray.ja}」トレイへ送信しました`), 'ok');
    } else {
      toast(bi('Task created', 'タスクを登録しました'), 'ok');
    }
  };

  const toggleMilestone = (taskId: string, msId: string) =>
    patchTask(taskId, (t) => {
      const milestones = t.milestones.map((m) => (m.id === msId ? { ...m, done: !m.done, doneAt: !m.done ? Date.now() : undefined } : m));
      return { ...t, milestones, status: t.status === 'todo' ? 'in_progress' : t.status };
    });

  const reportBlocker = (taskId: string, reason: BlockerReason) => {
    const tb = titleBi(tasks.find((x) => x.id === taskId));
    patchTask(taskId, (x) => ({ ...x, blocker: { reason, at: Date.now(), by: actorLabel } }));
    pushFeed(
      bi(`⚠️ ${actorLabel} reported a blocker: ${BLOCKERS[reason].en} — "${tb.en}"`, `⚠️ ${actorLabel} がBlocker申告: ${BLOCKERS[reason].ja} —「${tb.ja}」`),
      'warn',
    );
    toast(bi(`${BLOCKERS[reason].en} — shared with the team & GM`, `${BLOCKERS[reason].ja} をチーム & GMへ即時共有しました`), 'warn');
  };

  const clearBlocker = (taskId: string) => {
    patchTask(taskId, (x) => ({ ...x, blocker: undefined }));
    toast(bi('Blocker cleared', 'Blockerを解除しました'), 'ok');
  };

  const attachEvidence = (taskId: string, ev: Omit<Evidence, 'id' | 'at'>) => {
    patchTask(taskId, (x) => ({ ...x, evidence: [...x.evidence, { ...ev, id: uid('ev'), at: Date.now() }] }));
    toast(bi(`📎 Attached: ${ev.name}`, `📎 証跡を添付: ${ev.name}`), 'ok');
  };

  const removeEvidence = (taskId: string, evId: string) =>
    patchTask(taskId, (x) => ({ ...x, evidence: x.evidence.filter((e) => e.id !== evId) }));

  const completeTask = (taskId: string) => {
    const t = tasks.find((x) => x.id === taskId);
    if (!t) return;
    if (t.approval && t.approval.status !== 'approved') {
      toast(bi('This task is not approved yet, so it can’t be completed', '承認が完了していないため完了にできません'), 'warn');
      return;
    }
    if ((t.requiresExpense || t.requiresOuting) && t.evidence.length === 0) {
      toast(
        bi('Outing / expense tasks need a receipt or document attached before completing', '外出・費用タスクは完了前に領収書/書類の証跡添付が必要です'),
        'warn',
      );
      return;
    }
    patchTask(taskId, (x) => ({
      ...x,
      status: 'done',
      blocker: undefined,
      milestones: x.milestones.map((m) => (m.done ? m : { ...m, done: true, doneAt: Date.now() })),
    }));
    const tb = titleBi(t);
    pushFeed(
      bi(`✅ ${actorLabel} completed "${tb.en}" (${t.evidence.length} attachment(s))`, `✅ ${actorLabel} がタスク完了:「${tb.ja}」（証跡 ${t.evidence.length}件）`),
      'ok',
    );
    toast(bi('Task completed 🎉', 'タスクを完了しました 🎉'), 'ok');
  };

  const reopenTask = (taskId: string) => patchTask(taskId, (x) => ({ ...x, status: 'in_progress' }));

  const decide = (taskId: string, decision: Exclude<ApprovalStatus, 'pending'>, note?: string) => {
    const t = tasks.find((x) => x.id === taskId);
    if (!t || !t.approval) return;
    patchTask(taskId, (x) =>
      x.approval ? { ...x, approval: { ...x.approval, status: decision, note, decidedBy: actorLabel, decidedAt: Date.now() } } : x,
    );
    const label =
      decision === 'approved' ? bi('✅ Approved', '✅ 承認') : decision === 'revision' ? bi('✏️ Revision requested', '✏️ 修正依頼') : bi('↩️ Returned', '↩️ 差戻し');
    const tb = titleBi(t);
    const who = staffName(t.assigneeId);
    pushFeed(
      bi(
        `${label.en}: ${actorLabel} → "${tb.en}" (assignee ${who})${note ? ` 💬 ${note}` : ''}`,
        `${label.ja}: ${actorLabel} →「${tb.ja}」（担当 ${who}）${note ? ` 💬 ${note}` : ''}`,
      ),
      decision === 'approved' ? 'ok' : decision === 'revision' ? 'warn' : 'danger',
    );
    toast(bi(`${label.en} — ${who} has been notified`, `${label.ja} しました — ${who} に通知`), decision === 'approved' ? 'ok' : 'warn');
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
    const tb = titleBi(t);
    pushFeed(bi(`🔁 ${actorLabel} resubmitted "${tb.en}"`, `🔁 ${actorLabel} が「${tb.ja}」を再申請しました`), 'info');
    toast(bi('Resubmitted for approval', '再申請しました'), 'ok');
  };

  /* ---------- Transit ---------- */
  const depart = (taskId: string, destId: string) => {
    const a = attendance[meId];
    const t = tasks.find((x) => x.id === taskId);
    if (!t) return;
    if (a.status !== 'working') {
      toast(
        a.status === 'break'
          ? bi('You’re on break. End your break before leaving.', '休憩中は出発できません。休憩を終了してください')
          : bi('Clock in first, then you can leave.', '出勤打刻（Clock-In）後に出発できます'),
        'warn',
      );
      return;
    }
    if (!canStartOuting(t)) {
      toast(bi('GM approval is still pending, so you can’t leave yet', 'GM承認が完了していないため出発できません'), 'warn');
      return;
    }
    const d = destOf(destId);
    const tb = titleBi(t);
    patchTask(taskId, (x) => ({ ...x, destinationId: destId, transitPhase: 'transit', status: 'in_progress' }));
    setVisits((v) => [{ id: uid('v'), staffId: meId, taskId, destinationId: destId, departAt: Date.now() }, ...v]);
    patchAtt(meId, (x) => ({ ...x, status: 'transit', lastPing: Date.now() }));
    pushFeed(bi(`🚗 ${me.name} left for ${d?.name} (${tb.en})`, `🚗 ${me.name} が ${d?.name} へ出発しました（${tb.ja}）`), 'info');
    toast(bi(`🚗 Departed — on the way to ${d?.short}`, `🚗 出発 — ${d?.short} へ移動中`), 'info');
  };

  const arrive = (taskId: string) => {
    const t = tasks.find((x) => x.id === taskId);
    const d = destOf(t?.destinationId);
    if (!t || !d) return;
    const pin = pinNear(d);
    patchTask(taskId, (x) => ({ ...x, transitPhase: 'arrived' }));
    setVisits((vs) => vs.map((v) => (v.taskId === taskId && !v.arriveAt ? { ...v, arriveAt: Date.now(), pin } : v)));
    patchAtt(meId, (x) => ({
      ...x,
      status: 'visiting',
      lastFix: { ...pin, accuracy: 9, distance: Math.round(haversine(pin, OFFICE)), at: Date.now() },
    }));
    const hm = fmtHM(nowTs());
    pushFeed(bi(`📍 ${me.name} checked in at ${d.name} (${hm})`, `📍 ${me.name} が ${d.name} に到着チェックイン（${hm}）`), 'info');
    toast(bi(`📍 Checked in — ${d.short} ${hm}`, `📍 到着チェックイン — ${d.short} ${hm}`), 'ok');
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
    const tb = titleBi(t);
    pushFeed(
      bi(`🏢 ${me.name} is back at the office — receipt attached, "${tb.en}" done`, `🏢 ${me.name} が帰社しました — 領収書添付 & 完了「${tb.ja}」`),
      'ok',
    );
    toast(bi('📸 Receipt attached & task completed — back at the office', '📸 領収書を添付してタスク完了 — 事務所へ帰社しました'), 'ok');
  };

  /* ---------- Students & Lessons ---------- */
  const addStudent = (s: Omit<Student, 'id'>) => {
    setStudents((ss) => [...ss, { ...s, id: uid('st') }]);
    toast(bi(`🎓 Student registered: ${s.name}`, `🎓 学生を登録しました: ${s.name}`), 'ok');
  };
  const removeStudent = (id: string) => {
    setStudents((ss) => ss.filter((s) => s.id !== id));
    setLessons((ls) => ls.filter((l) => l.studentId !== id));
    setBookings((bs) => bs.filter((b) => b.studentId !== id));
  };

  const studentName = (id: string) => students.find((x) => x.id === id)?.name ?? '—';
  const subjectName = (id?: string) => {
    const sb = subjects.find((x) => x.id === id);
    return sb ? T(sb.name) : '';
  };
  const busyWith = (date: string, slotNo: number, teacherId: string, exceptStudentId?: string) => {
    const hit = lessons.find((l) => l.date === date && l.slotNo === slotNo && l.teacherId === teacherId && l.studentId !== exceptStudentId);
    return hit ? studentName(hit.studentId) : null;
  };

  const setLesson = (date: string, studentId: string, slotNo: number, patch: { subjectId?: string | null; teacherId?: string | null }) => {
    const slot = slotOf(slotNo);
    if (patch.teacherId) {
      const other = busyWith(date, slotNo, patch.teacherId, studentId);
      if (other) {
        const who = staffName(patch.teacherId);
        toast(
          bi(
            `⛔ ${who} is already teaching ${other} in slot ${slotNo} (${slot?.start}) on ${date}. Choose another teacher.`,
            `⛔ ${who} は ${date} の Slot ${slotNo}（${slot?.start}）で既に ${other} を担当しています。別の講師を選んでください。`,
          ),
          'danger',
        );
        return false;
      }
    }
    const cur = lessons.find((l) => l.date === date && l.studentId === studentId && l.slotNo === slotNo);
    const next: Lesson = { ...(cur ?? { id: uid('ls'), date, studentId, slotNo }) };
    if (patch.subjectId !== undefined) next.subjectId = patch.subjectId ?? undefined;
    const teacherChanged = patch.teacherId !== undefined && (patch.teacherId ?? undefined) !== cur?.teacherId;
    if (patch.teacherId !== undefined) {
      next.teacherId = patch.teacherId ?? undefined;
      next.assignedAt = patch.teacherId ? nowTs() : undefined;
    }
    setLessons((ls) => (cur ? ls.map((l) => (l.id === cur.id ? next : l)) : [...ls, next]));
    if (teacherChanged && next.teacherId) {
      const who = staffName(next.teacherId);
      const st = studentName(studentId);
      toast(
        date === todayStr()
          ? bi(
              `📌 Added slot ${slotNo} (${slot?.start}) · ${st} to ${who}’s Today’s Milestones`,
              `📌 ${who} の「本日のマイルストーン」に Slot ${slotNo}（${slot?.start}）${st} の授業を自動追加しました`,
            )
          : bi(`📅 ${who} assigned to ${st} — ${date} slot ${slotNo} (${slot?.start})`, `📅 ${who} を ${st} に割り当てました — ${date} Slot ${slotNo}（${slot?.start}）`),
        'ok',
      );
    }
    return true;
  };

  const addSubject = (name: string) => {
    const n = name.trim();
    if (!n) return false;
    if (subjects.some((x) => [tx('en', x.name), tx('ja', x.name)].some((v) => v.toLowerCase() === n.toLowerCase()))) {
      toast(bi(`"${n}" already exists`, `「${n}」は既にあります`), 'warn');
      return false;
    }
    setSubjects((list) => [...list, { id: uid('sub'), name: n, custom: true }]);
    toast(bi(`Subject added: ${n}`, `科目を追加しました: ${n}`), 'ok');
    return true;
  };
  const removeSubject = (id: string) => {
    const sb = subjects.find((x) => x.id === id);
    if (!sb) return;
    setSubjects((list) => list.filter((x) => x.id !== id));
    setLessons((ls) => ls.map((l) => (l.subjectId === id ? { ...l, subjectId: undefined } : l)));
    toast(bi(`Subject removed: ${tx('en', sb.name)}`, `科目を削除しました: ${tx('ja', sb.name)}`), 'info');
  };

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
    const who = staffName(b.teacherId);
    toast(
      bi(`💻 Teams lesson booked: ${st?.name} — lesson #${n}, added to ${who}’s screen`, `💻 Teamsレッスン予約: ${st?.name} 第${n}回 → ${who} の画面にタスク表示`),
      'ok',
    );
  };
  const removeBooking = (id: string) => setBookings((bs) => bs.filter((b) => b.id !== id));

  /* ---------- Staff management (GM / HQO) ---------- */
  const saveStaff = (id: string, patch: { name: string; roles: string[] }) => {
    const before = staff.find((s) => s.id === id);
    setStaff((list) => list.map((s) => (s.id === id ? { ...s, name: patch.name, roles: patch.roles } : s)));
    pushFeed(
      bi(`⚙️ ${actorLabel} updated ${patch.name}'s profile & roles`, `⚙️ ${actorLabel} が ${patch.name} のプロフィール・ROLE を更新しました`),
      'info',
    );
    toast(
      before && before.name !== patch.name
        ? bi(`Saved — ${before.name} is now ${patch.name}`, `保存しました — ${before.name} → ${patch.name}`)
        : bi(`Saved ${patch.name}`, `${patch.name} を保存しました`),
      'ok',
    );
  };

  const addStaff = (p: { name: string; avatar: string; roles: string[] }) => {
    const id = uid('staff');
    setStaff((list) => [...list, { id, name: p.name, avatar: p.avatar, roles: p.roles, title: '', active: true }]);
    setAttendance((prev) => ({ ...prev, [id]: { status: 'off', breaks: [] } }));
    pushFeed(bi(`👋 ${actorLabel} added a new staff member: ${p.name}`, `👋 ${actorLabel} が新しいスタッフ ${p.name} を追加しました`), 'ok');
    toast(bi(`Added ${p.name}`, `${p.name} を追加しました`), 'ok');
  };

  const setStaffActive = (id: string, active: boolean) => {
    const target = staff.find((s) => s.id === id);
    if (!target) return;
    if (!active && activeStaff.length <= 1) {
      toast(bi('At least one active staff member is required', '有効なスタッフが最低1名必要です'), 'warn');
      return;
    }
    setStaff((list) => list.map((s) => (s.id === id ? { ...s, active } : s)));
    // 表示中のスタッフを無効化したら、別の有効スタッフに切り替える
    if (!active && id === meId) {
      const next = activeStaff.find((s) => s.id !== id);
      if (next) setMeId(next.id);
    }
    pushFeed(
      active
        ? bi(`✅ ${actorLabel} reactivated ${target.name}`, `✅ ${actorLabel} が ${target.name} を再有効化しました`)
        : bi(`⛔ ${actorLabel} deactivated ${target.name}`, `⛔ ${actorLabel} が ${target.name} を無効化しました`),
      active ? 'ok' : 'warn',
    );
    toast(active ? bi(`${target.name} reactivated`, `${target.name} を再有効化しました`) : bi(`${target.name} deactivated`, `${target.name} を無効化しました`), active ? 'ok' : 'warn');
  };

  const addJobRole = (label: string) => {
    const name = label.trim();
    if (!name) return false;
    const dup = jobRoles.some((r) => [tx('en', r.label), tx('ja', r.label)].some((x) => x.toLowerCase() === name.toLowerCase()));
    if (dup) {
      toast(bi(`"${name}" already exists`, `「${name}」は既にあります`), 'warn');
      return false;
    }
    setJobRoles((list) => [...list, { id: uid('role'), label: name, color: ROLE_COLORS[list.length % ROLE_COLORS.length], custom: true }]);
    toast(bi(`Role added: ${name}`, `ROLE を追加しました: ${name}`), 'ok');
    return true;
  };

  const removeJobRole = (id: string) => {
    const r = jobRoles.find((x) => x.id === id);
    if (!r?.custom) return;
    setJobRoles((list) => list.filter((x) => x.id !== id));
    setStaff((list) => list.map((s) => ({ ...s, roles: s.roles.filter((x) => x !== id) })));
    toast(bi(`Role removed: ${tx('en', r.label)}`, `ROLE を削除しました: ${tx('ja', r.label)}`), 'info');
  };

  const ctx: AppCtx = {
    lang,
    L,
    T,
    role,
    me,
    actorLabel,
    staff,
    activeStaff,
    jobRoles,
    staffName,
    staffOf,
    roleNames,
    saveStaff,
    addStaff,
    setStaffActive,
    addJobRole,
    removeJobRole,
    now,
    attendance,
    tasks,
    visits,
    students,
    lessons,
    subjects,
    bookings,
    feed,
    history,
    gpsMode,
    gpsBusy,
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
    setLesson,
    busyWith,
    subjectName,
    addSubject,
    removeSubject,
    addBooking,
    removeBooking,
    lessonNo,
    toast,
  };

  const gmPending = tasks.filter((t) => t.approval?.type === 'GM' && t.approval.status === 'pending').length;
  const hqoPending = tasks.filter((t) => t.approval?.type === 'HQO' && t.approval.status === 'pending').length;

  const TABS: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }> = [
    { key: 'dashboard', label: L('Dashboard', 'ダッシュボード'), icon: Building2 },
    {
      key: 'tasks',
      label: L('Tasks & Approval', 'タスク・承認'),
      icon: ClipboardList,
      badge: role === 'gm' ? gmPending : role === 'hqo' ? hqoPending : tasks.filter((t) => t.assigneeId === meId && isTaskDelayed(t)).length,
    },
    { key: 'transit', label: L('Transit & Visits', '外出・訪問'), icon: Car },
    { key: 'students', label: L('Students & Lessons', '生徒・レッスン'), icon: GraduationCap },
    { key: 'dtr', label: L('Work Log (DTR)', '勤怠ログ (DTR)'), icon: BarChart3 },
    // GM / HQO のみ
    ...(role !== 'staff' ? [{ key: 'settings' as TabKey, label: L('Staff Settings', 'スタッフ設定'), icon: Settings }] : []),
  ];

  return (
    <Ctx.Provider value={ctx}>
      <div className="min-h-screen bg-slate-100 text-slate-800 font-sans">
        {/* ---------- Header + Role bar + Language ---------- */}
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
                <div className="text-xs text-slate-400 leading-tight">{L('Cebu Office Remote Management', 'セブオフィス遠隔マネジメント')}</div>
              </div>
            </div>
            <div className="hidden lg:flex items-center gap-3 text-xs font-mono text-slate-300">
              <span>
                🇵🇭 {L('Cebu', 'セブ')} {tzClock('Asia/Manila', now)}
              </span>
              <span className="text-slate-600">|</span>
              <span>
                🇯🇵 {L('Tokyo', '東京')} {tzClock('Asia/Tokyo', now)}
              </span>
            </div>
            <div className="flex items-center gap-1 bg-slate-800 rounded-xl p-1" role="group" aria-label="Language / 言語">
              <Globe className="w-4 h-4 text-slate-400 mx-1" />
              {(['en', 'ja'] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  aria-pressed={lang === l}
                  className={cx(
                    'px-2.5 py-1.5 rounded-lg text-sm font-semibold transition',
                    lang === l ? 'bg-sky-500 text-white shadow' : 'text-slate-300 hover:bg-slate-700',
                  )}
                >
                  {l === 'en' ? 'EN' : '日本語'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 bg-slate-800 rounded-xl p-1">
              <div
                className={cx(
                  'flex items-center rounded-lg text-sm transition',
                  role === 'staff' ? 'bg-white text-slate-900 shadow' : 'text-slate-300 hover:bg-slate-700',
                )}
              >
                <button className="pl-3 pr-1 py-1 font-medium text-left" onClick={() => setRole('staff')}>
                  <span className="block leading-tight">
                    👤 {me.name} <span className="opacity-60">(Staff)</span>
                  </span>
                  <RoleBadges ids={me.roles} compact />
                </button>
                <select
                  aria-label={L('Switch staff', 'スタッフ切替')}
                  value={meId}
                  onChange={(e) => {
                    setMeId(e.target.value);
                    setRole('staff');
                  }}
                  className="bg-transparent text-xs pr-1 py-1.5 outline-none cursor-pointer w-5"
                >
                  {activeStaff.map((s) => (
                    <option key={s.id} value={s.id} className="text-slate-900">
                      {s.name}
                      {s.roles.length ? ` — ${roleNames(s.roles)}` : ''}
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
          {tab === 'tasks' && <TasksTab key={role} />}
          {tab === 'transit' && <TransitTab key={`${role}-${meId}`} />}
          {tab === 'students' && <StudentsTab />}
          {tab === 'dtr' && <DTRTab key={`${role}-${meId}`} />}
          {tab === 'settings' && role !== 'staff' && <StaffSettingsTab />}
        </main>

        <footer className="text-center text-xs text-slate-400 pb-8">
          {L(
            'Cebu Sync Phase 1 — mock data only · GPS / Teams / CSV are simulated',
            'Cebu Sync Phase 1 — モックデータのみ · GPS / Teams / CSV はシミュレーション',
          )}
        </footer>

        {showAddTask && (
          <AddTaskModal
            onClose={() => setShowAddTask(false)}
            onSubmit={(t) => {
              addTask(t);
              setShowAddTask(false);
            }}
          />
        )}

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
              <span>{T(t.text)}</span>
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

function Card({
  title,
  icon,
  right,
  children,
  className,
}: {
  title?: React.ReactNode;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
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
  const { T } = useApp();
  const m = STATUS_META[status];
  return <span className={cx('text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap', m.pill)}>{T(m.label)}</span>;
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ring-1 whitespace-nowrap', className)}>
      {children}
    </span>
  );
}

function CategoryBadge({ category }: { category: Category }) {
  const { T } = useApp();
  return <Badge className={CATEGORY_STYLE[category]}>{T(CATEGORY_LABEL[category])}</Badge>;
}

function ApprovalBadge({ approval }: { approval: Approval | null }) {
  const { L } = useApp();
  if (!approval) return null;
  const tray = approval.type === 'HQO' ? '🏦 HQO' : '👔 GM';
  if (approval.status === 'pending')
    return <Badge className="bg-yellow-50 text-yellow-800 ring-yellow-300">⏳ {L('Needs approval', '要承認')} · {tray}</Badge>;
  if (approval.status === 'approved')
    return <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">✅ {L('Approved', '承認済')} · {tray}</Badge>;
  if (approval.status === 'revision')
    return <Badge className="bg-orange-50 text-orange-700 ring-orange-300">✏️ {L('Revision requested', '修正依頼')} · {tray}</Badge>;
  return <Badge className="bg-red-50 text-red-700 ring-red-300">↩️ {L('Returned', '差戻し')} · {tray}</Badge>;
}

/** ROLE（担当）バッジ。compact = 2件 + 残り件数のみ。highlight に含まれる ROLE は緑枠で強調 */
function RoleBadges({ ids, compact, highlight }: { ids: string[]; compact?: boolean; highlight?: string[] }) {
  const { jobRoles, T, L } = useApp();
  const list = ids.map((id) => jobRoles.find((r) => r.id === id)).filter((r): r is JobRole => !!r);
  if (list.length === 0) return compact ? null : <span className="text-xs text-slate-400">{L('No role', 'ROLE 未設定')}</span>;
  const shown = compact ? list.slice(0, 2) : list;
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {shown.map((r) => (
        <span
          key={r.id}
          className={cx(
            'text-xs font-semibold px-1.5 py-0.5 rounded-md ring-1 whitespace-nowrap leading-tight',
            r.color,
            highlight?.includes(r.id) && 'ring-2 ring-emerald-500',
          )}
        >
          {T(r.label)}
        </span>
      ))}
      {compact && list.length > 2 && (
        <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-700 leading-tight">+{list.length - 2}</span>
      )}
    </span>
  );
}

/** 推奨 ROLE を持つスタッフを先頭に並べる */
const sortByRoles = (list: Staff[], roles: string[]) => [...list].sort((a, b) => Number(hasAnyRole(b, roles)) - Number(hasAnyRole(a, roles)));

/** 担当者選択（ROLE バッジ付き・推奨 ROLE を持つ人に ★） */
function AssigneePicker({
  label,
  value,
  onChange,
  staff,
  recommended,
  hint,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  staff: Staff[];
  recommended: string[];
  hint?: string;
}) {
  const { L } = useApp();
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2" role="radiogroup" aria-label={label}>
        {sortByRoles(staff, recommended).map((s) => {
          const rec = hasAnyRole(s, recommended);
          const selected = value === s.id;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(s.id)}
              className={cx(
                'text-left rounded-xl p-2 ring-1 transition space-y-1',
                selected ? 'ring-2 ring-sky-500 bg-sky-50' : 'ring-slate-200 hover:bg-slate-50',
              )}
            >
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <span>{s.avatar}</span>
                <span className="truncate">{s.name}</span>
                {rec && <span className="ml-auto text-xs font-semibold text-emerald-700 whitespace-nowrap">★ {L('Suggested', 'おすすめ')}</span>}
              </div>
              <RoleBadges ids={s.roles} highlight={recommended} />
            </button>
          );
        })}
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-slate-400 text-center py-6">{children}</div>;
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const { L } = useApp();
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className={cx('bg-white rounded-2xl shadow-2xl w-full my-8', wide ? 'max-w-3xl' : 'max-w-xl')} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-lg">{title}</h3>
          <button onClick={onClose} className="ml-auto p-1 rounded-lg hover:bg-slate-100" aria-label={L('Close', '閉じる')}>
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
const btnBase =
  'inline-flex items-center justify-center gap-1.5 rounded-lg text-sm px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed transition';
const btn = {
  primary: `${btnBase} bg-sky-600 hover:bg-sky-700 text-white font-semibold`,
  dark: `${btnBase} bg-slate-800 hover:bg-slate-900 text-white font-semibold`,
  ghost: `${btnBase} bg-white ring-1 ring-slate-300 hover:bg-slate-50 text-slate-700 font-medium`,
  green: `${btnBase} bg-emerald-600 hover:bg-emerald-700 text-white font-semibold`,
  yellow: `${btnBase} bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-semibold`,
  orange: `${btnBase} bg-orange-500 hover:bg-orange-600 text-white font-semibold`,
  red: `${btnBase} bg-red-600 hover:bg-red-700 text-white font-semibold`,
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
  const { tasks, attendance, role, me, now, activeStaff, staffName } = useApp();
  return useMemo(() => {
    const items: Array<{ id: string; tone: Tone; text: Bi }> = [];
    const mine = (t: Task) => role !== 'staff' || t.assigneeId === me.id;
    for (const t of tasks) {
      const title = { en: tx('en', t.title), ja: tx('ja', t.title) };
      const who = staffName(t.assigneeId);
      if (isTaskDelayed(t) && mine(t))
        items.push({ id: `d_${t.id}`, tone: 'danger', text: bi(`⚠️ Delayed: "${title.en}" (${who})`, `⚠️ Delayed:「${title.ja}」（${who}）`) });
      if (t.blocker && t.status !== 'done')
        items.push({
          id: `b_${t.id}`,
          tone: 'warn',
          text: bi(
            `${BLOCKERS[t.blocker.reason].en}: "${title.en}" — reported by ${t.blocker.by}`,
            `${BLOCKERS[t.blocker.reason].ja}:「${title.ja}」— ${t.blocker.by} が申告`,
          ),
        });
      if (t.approval?.status === 'pending') {
        if ((role === 'gm' && t.approval.type === 'GM') || (role === 'hqo' && t.approval.type === 'HQO')) {
          const amt = t.requiresExpense ? ` ${fmtPhp(t.amount)}` : '';
          items.push({ id: `a_${t.id}`, tone: 'info', text: bi(`📝 Awaiting approval: "${title.en}"${amt}`, `📝 承認待ち:「${title.ja}」${amt}`) });
        }
      }
      if (role === 'staff' && t.assigneeId === me.id && t.approval && (t.approval.status === 'revision' || t.approval.status === 'rejected')) {
        const isRev = t.approval.status === 'revision';
        const note = t.approval.note ? ` — ${t.approval.note}` : '';
        items.push({
          id: `r_${t.id}`,
          tone: 'warn',
          text: bi(
            `${isRev ? '✏️ Revision requested' : '↩️ Returned'} (${t.approval.decidedBy}): "${title.en}"${note}`,
            `${isRev ? '✏️ 修正依頼' : '↩️ 差戻し'}（${t.approval.decidedBy}）:「${title.ja}」${note}`,
          ),
        });
      }
    }
    if (role !== 'staff') {
      const d = new Date(now);
      if (d.getHours() * 60 + d.getMinutes() > 8 * 60 + 15) {
        for (const s of activeStaff)
          if (attendance[s.id]?.status === 'off')
            items.push({ id: `late_${s.id}`, tone: 'warn', text: bi(`⏰ ${s.name} has not clocked in (past 8:15)`, `⏰ ${s.name} が未出勤（8:15超過）`) });
      }
      for (const s of activeStaff) {
        const b = attendance[s.id]?.breaks.find((x) => !x.end);
        if (b && now - b.start > 75 * 60000)
          items.push({ id: `brk_${s.id}`, tone: 'warn', text: bi(`☕ ${s.name}’s break is over 75 min`, `☕ ${s.name} の休憩が75分を超過`) });
      }
    }
    const order: Record<Tone, number> = { danger: 0, warn: 1, info: 2, ok: 3 };
    return items.sort((a, b) => order[a.tone] - order[b.tone]);
  }, [tasks, attendance, role, me.id, now, activeStaff, staffName]);
}

function DashboardTab() {
  const { role, attendance, tasks, activeStaff, L } = useApp();
  const alerts = useAlerts();
  const working = activeStaff.filter((s) => ['working', 'transit', 'visiting', 'break'].includes(attendance[s.id]?.status)).length;
  const delayed = tasks.filter(isTaskDelayed).length;
  const blockers = tasks.filter((t) => t.blocker && t.status !== 'done').length;
  const pending = tasks.filter(
    (t) => t.approval?.status === 'pending' && (role === 'staff' || t.approval.type === (role === 'gm' ? 'GM' : 'HQO')),
  ).length;

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
            <Kpi label={L('Present', '出勤中')} value={`${working} / ${activeStaff.length}`} tone="green" icon={<Users className="w-5 h-5" />} />
            <Kpi label={L('Delayed tasks', '遅延タスク')} value={delayed} tone="red" icon={<AlertTriangle className="w-5 h-5" />} />
            <Kpi label={L('Active blockers', 'Blocker 申告中')} value={blockers} tone="orange" icon={<Radio className="w-5 h-5" />} />
            <Kpi
              label={role === 'gm' ? L('Awaiting GM approval', 'GM統括承認 待ち') : L('Awaiting HQO approval', 'HQO出金承認 待ち')}
              value={pending}
              tone="yellow"
              icon={<Shield className="w-5 h-5" />}
            />
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
  const { me, attendance, now, clockIn, clockOut, breakStart, breakEnd, gpsBusy, gpsMode, setGpsMode, setTab, L } = useApp();
  const a = attendance[me.id];
  const tracking = a.status === 'working' || a.status === 'transit' || a.status === 'visiting';
  const breakMin = a.breaks.reduce((s, b) => s + ((b.end ?? now) - b.start) / 60000, 0);
  const workMin = a.clockIn ? Math.max(0, ((a.clockOut ?? now) - a.clockIn) / 60000 - breakMin) : 0;
  const onBreak = a.breaks.find((b) => !b.end);
  const trackingLabel = tracking
    ? 'ON'
    : a.status === 'break'
      ? L('PAUSED (on break)', 'PAUSED（休憩中）')
      : a.status === 'out'
        ? L('OFF (fully stopped after clock-out)', 'OFF（退勤後は完全停止）')
        : 'OFF';

  return (
    <Card title={L('Attendance · Work Log', '勤怠 · Work Log Record')} icon={<Clock className="w-5 h-5 text-sky-600" />} right={<StatusPill status={a.status} />}>
      <div className="flex items-center gap-3 mb-4">
        <div className="text-4xl">{me.avatar}</div>
        <div>
          <div className="font-bold text-lg leading-tight">{me.name}</div>
          <RoleBadges ids={me.roles} />
        </div>
        <div className="ml-auto text-right">
          <div className="text-xs text-slate-400">{L('Worked', '実働')}</div>
          <div className="font-mono font-bold text-xl whitespace-nowrap">{fmtDuration(workMin)}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs mb-4">
        <div className="bg-slate-50 rounded-lg py-2">
          <div className="text-slate-400">Clock-In</div>
          <div className="font-mono font-semibold text-sm">{fmtHM(a.clockIn)}</div>
        </div>
        <div className="bg-slate-50 rounded-lg py-2">
          <div className="text-slate-400">{L('Break', '休憩')}</div>
          <div className="font-mono font-semibold text-sm">
            {Math.round(breakMin)}
            {L(' min', '分')}
          </div>
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
                <Navigation className="w-5 h-5 animate-pulse" /> {L('Getting GPS location…', 'GPS測位中…')}
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" /> {L('Clock-In (GPS)', 'Clock-In（GPS出勤打刻）')}
              </>
            )}
          </button>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{L('Mock GPS location:', '擬似GPS位置:')}</span>
            <button
              onClick={() => setGpsMode('office')}
              className={cx(
                'px-2 py-1 rounded-md ring-1',
                gpsMode === 'office' ? 'bg-emerald-50 ring-emerald-300 text-emerald-700 font-semibold' : 'ring-slate-200',
              )}
            >
              🏢 {L('In office', '事務所内')}
            </button>
            <button
              onClick={() => setGpsMode('outside')}
              className={cx('px-2 py-1 rounded-md ring-1', gpsMode === 'outside' ? 'bg-red-50 ring-red-300 text-red-700 font-semibold' : 'ring-slate-200')}
            >
              🌴 {L('Outside', '事務所外')}
            </button>
          </div>
        </>
      )}

      {a.status === 'working' && (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={breakStart} className={btn.yellow}>
            <Coffee className="w-4 h-4" /> {L('Start Break', '休憩開始')}
          </button>
          <button onClick={clockOut} className={btn.dark}>
            <LogOut className="w-4 h-4" /> Clock-Out
          </button>
        </div>
      )}

      {a.status === 'break' && (
        <div className="space-y-2">
          <div className="rounded-xl bg-yellow-50 ring-1 ring-yellow-200 p-3 text-sm text-yellow-800 text-center">
            {onBreak ? L(`☕ On break — ${fmtDuration((now - onBreak.start) / 60000)}`, `☕ 休憩中 — ${fmtDuration((now - onBreak.start) / 60000)} 経過`) : ''}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={breakEnd} className={btn.green}>
              <RotateCcw className="w-4 h-4" /> {L('End Break', '休憩終了')}
            </button>
            <button onClick={clockOut} className={btn.dark}>
              <LogOut className="w-4 h-4" /> Clock-Out
            </button>
          </div>
        </div>
      )}

      {(a.status === 'transit' || a.status === 'visiting') && (
        <button onClick={() => setTab('transit')} className={cx(btn.orange, 'w-full')}>
          <Car className="w-4 h-4" /> {L('On an outing — open Transit', '外出中 — Transit 画面を開く')}
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
            📡 {L('Location tracking', '位置情報トラッキング')}: {trackingLabel}
          </div>
          {a.lastFix && (
            <div className="mt-0.5 font-mono">
              {a.lastFix.lat.toFixed(5)}, {a.lastFix.lng.toFixed(5)} · {L(`${a.lastFix.distance}m from office`, `事務所から ${a.lastFix.distance}m`)}
              {a.lastFix.distance > GEOFENCE_M && a.status === 'off' && (
                <span className="text-red-600 font-semibold"> {L('(out of range)', '（範囲外）')}</span>
              )}
            </div>
          )}
          {tracking && <div className="font-mono">last ping {fmtHMS(a.lastPing)}</div>}
          <div className="opacity-70">
            {L(`Geofence: ${OFFICE.name}, ${GEOFENCE_M}m radius`, `ジオフェンス: ${OFFICE.name} 半径 ${GEOFENCE_M}m`)}
          </div>
        </div>
      </div>
    </Card>
  );
}

function MyTodayCard() {
  const { me, tasks, lessons, bookings, students, now, lessonNo, subjectName, setTab, toggleMilestone, L, T, lang } = useApp();
  const today = todayStr();
  const myTasks = tasks.filter((t) => t.assigneeId === me.id && t.status !== 'done');
  const msItems = myTasks.flatMap((t) => t.milestones.filter((m) => !m.done && m.due <= today).map((m) => ({ t, m })));
  const mySlots = lessons.filter((l) => l.date === today && l.teacherId === me.id).sort((a, b) => a.slotNo - b.slotNo);
  const myOnline = bookings
    .filter((b) => b.teacherId === me.id && b.datetime.startsWith(today))
    .sort((a, b) => a.datetime.localeCompare(b.datetime));
  const total = msItems.length + mySlots.length + myOnline.length;

  return (
    <Card
      title={L('Today’s Milestones', '本日のマイルストーン')}
      icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
      right={<span className="text-xs text-slate-400">{L(`${total} items`, `${total}件`)}</span>}
    >
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {mySlots.map((l) => {
          const slot = slotOf(l.slotNo);
          const isNew = !!l.assignedAt && now - l.assignedAt < 60000;
          const subj = subjectName(l.subjectId);
          return (
            <div
              key={l.id}
              className={cx('rounded-xl p-3 ring-1 flex gap-3 items-start', isNew ? 'bg-pink-50 ring-pink-300 animate-pulse' : 'bg-pink-50 ring-pink-100')}
            >
              <GraduationCap className="w-5 h-5 text-pink-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-sm font-semibold">
                  🎓 {L(`In-person · Slot ${l.slotNo}`, `対面授業 Slot ${l.slotNo}`)} {slot?.start}–{slot?.end}
                  {isNew && <span className="ml-2 text-xs bg-pink-600 text-white rounded px-1.5 py-0.5">{L('NEW · auto-added', 'NEW 自動追加')}</span>}
                </div>
                <div className="text-xs text-slate-600 truncate">
                  {students.find((x) => x.id === l.studentId)?.name ?? '—'}
                  {subj ? ` · ${subj}` : ` · ${L('subject not set', '科目未設定')}`}
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
                  💻 {L('Online', 'オンライン')} {b.datetime.slice(11)} · {st?.name}{' '}
                  <span className="text-violet-700">{L(`Lesson #${lessonNo(b)}`, `第${lessonNo(b)}回`)}</span>
                </div>
                <div className="text-xs text-slate-500 truncate">{b.teamsUrl}</div>
              </div>
              <a
                href={b.teamsUrl}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-2.5 py-1.5"
              >
                {L('Join Teams', 'Teams会議に参加')}
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
                aria-label={L('Mark as done', '完了にする')}
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold">
                  {T(m.label)}{' '}
                  {late && (
                    <span className="text-xs text-red-600 font-bold ml-1">
                      ⚠️ Delayed（{L('due', '期日')} {fmtDate(lang, m.due)}）
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 truncate">{T(t.title)}</div>
              </div>
            </div>
          );
        })}
        {total === 0 && <EmptyState>{L('Nothing scheduled for today 🎉', '本日の予定はありません 🎉')}</EmptyState>}
      </div>
      <button onClick={() => setTab('tasks')} className={cx(btn.ghost, 'w-full mt-3')}>
        <ClipboardList className="w-4 h-4" /> {L('View all tasks', 'すべてのタスクを見る')}
      </button>
    </Card>
  );
}

function AlertsCard({ alerts }: { alerts: Array<{ id: string; tone: Tone; text: Bi }> }) {
  const { L, T } = useApp();
  return (
    <Card
      title={L('Alerts', 'アラート一覧')}
      icon={<AlertTriangle className="w-5 h-5 text-orange-500" />}
      right={<span className="text-xs text-slate-400">{L(`${alerts.length} items`, `${alerts.length}件`)}</span>}
    >
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
            {T(a.text)}
          </div>
        ))}
        {alerts.length === 0 && <EmptyState>{L('No alerts ✅', 'アラートはありません ✅')}</EmptyState>}
      </div>
    </Card>
  );
}

function FeedCard() {
  const { feed, L, T } = useApp();
  return (
    <Card title={L('Team Feed', 'チーム共有フィード')} icon={<Send className="w-5 h-5 text-sky-600" />}>
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
              {T(f.text)}
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function TeamBoard() {
  const { attendance, visits, tasks, now, activeStaff, L } = useApp();
  return (
    <Card title={L('Live Attendance (Cebu Office)', 'リアルタイム勤怠ステータス（Cebu Office）')} icon={<Users className="w-5 h-5 text-slate-600" />}>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {activeStaff.map((s) => {
          const a = attendance[s.id] ?? { status: 'off' as AttStatus, breaks: [] };
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
                </div>
              </div>
              <div className="mt-1.5">
                <RoleBadges ids={s.roles} />
              </div>
              <div className="mt-2">
                <StatusPill status={a.status} />
              </div>
              <div className="mt-2 text-xs text-slate-500 space-y-0.5">
                <div>
                  IN {fmtHM(a.clockIn)} · OUT {fmtHM(a.clockOut)}
                </div>
                {onBreak && (
                  <div className="text-yellow-700">
                    ☕ {L(`${Math.round((now - onBreak.start) / 60000)} min`, `${Math.round((now - onBreak.start) / 60000)}分経過`)}
                  </div>
                )}
                {d && (
                  <div className="text-orange-700 truncate">
                    {d.emoji} {a.status === 'transit' ? `→ ${d.short}` : `@ ${d.short} (${fmtHM(v?.arriveAt)})`}
                  </div>
                )}
                <div className={cx('flex items-center gap-1', tracking ? 'text-emerald-600' : 'text-slate-400')}>
                  <Radio className="w-3 h-3" /> GPS {tracking ? 'ON' : 'OFF'}
                </div>
                <div>
                  {L(`${open.length} task(s)`, `タスク ${open.length}件`)}
                  {late > 0 && <span className="text-red-600 font-semibold"> · ⚠️ {L(`${late} delayed`, `遅延 ${late}`)}</span>}
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
  const { role, tasks, me, openAddTask, L, T } = useApp();
  const [view, setView] = useState<TaskView>(role === 'gm' ? 'gm' : role === 'hqo' ? 'hqo' : 'list');
  const [filter, setFilter] = useState<TaskFilter>(role === 'staff' ? 'mine' : 'all');
  const [expanded, setExpanded] = useState<string | null>(null);

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
        <div className="flex flex-wrap bg-white rounded-xl ring-1 ring-slate-200 p-1">
          {(
            [
              ['list', L('📋 Task List', '📋 タスク一覧'), 0],
              ['gm', T(trayName('GM')), gmTray.filter((t) => t.approval?.status === 'pending').length],
              ['hqo', T(trayName('HQO')), hqoTray.filter((t) => t.approval?.status === 'pending').length],
            ] as Array<[TaskView, string, number]>
          ).map(([k, l, n]) => (
            <button
              key={k}
              onClick={() => setView(k)}
              className={cx(
                'px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5',
                view === k ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {l}
              {n > 0 && <span className="text-xs bg-yellow-400 text-slate-900 rounded-full px-1.5 leading-tight">{n}</span>}
            </button>
          ))}
        </div>
        <button onClick={openAddTask} className={cx(btn.primary, 'ml-auto')}>
          <Plus className="w-4 h-4" /> {L('Add Task', 'タスク追加')}
        </button>
      </div>

      {view === 'list' && (
        <>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['mine', L(`👤 My tasks (${me.name})`, `👤 自分のタスク (${me.name})`)],
                ['all', L('All open', '全オープン')],
                ['delayed', '⚠️ Delayed'],
                ['approval', L('⏳ Needs approval', '⏳ 要承認')],
                ['done', L('✅ Done', '✅ 完了')],
              ] as Array<[TaskFilter, string]>
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={cx(
                  'text-xs px-3 py-1.5 rounded-full ring-1 font-medium',
                  filter === k ? 'bg-sky-600 text-white ring-sky-600' : 'bg-white ring-slate-300 text-slate-600 hover:bg-slate-50',
                )}
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
                <EmptyState>{L('No matching tasks', '該当するタスクはありません')}</EmptyState>
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
  const {
    role,
    me,
    toggleMilestone,
    reportBlocker,
    clearBlocker,
    attachEvidence,
    removeEvidence,
    completeTask,
    reopenTask,
    resubmit,
    setTab,
    staffOf,
    L,
    T,
    lang,
  } = useApp();
  const assignee = staffOf(t.assigneeId);
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
    <div
      className={cx('bg-white rounded-2xl ring-1 shadow-sm transition', delayed ? 'ring-red-300' : 'ring-slate-200', t.status === 'done' && 'opacity-75')}
    >
      <button onClick={onToggle} className="w-full text-left p-4 flex gap-3 items-start">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <CategoryBadge category={t.category} />
            <span className="text-xs text-slate-400">{T(t.subCategory)}</span>
            {delayed && <Badge className="bg-red-600 text-white ring-red-600">⚠️ Delayed</Badge>}
            <ApprovalBadge approval={t.approval} />
            {t.requiresOuting && <Badge className="bg-orange-50 text-orange-700 ring-orange-200">🚗 {L('Outing', '外出')}</Badge>}
            {t.requiresExpense && <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">💰 {fmtPhp(t.amount)}</Badge>}
            {t.blocker && t.status !== 'done' && <Badge className="bg-orange-500 text-white ring-orange-500">{T(BLOCKERS[t.blocker.reason])}</Badge>}
            {t.status === 'done' && <Badge className="bg-emerald-600 text-white ring-emerald-600">✅ {L('Done', '完了')}</Badge>}
          </div>
          <div className="font-semibold text-slate-800">{T(t.title)}</div>
          <div className="mt-1 text-xs text-slate-500 flex flex-wrap gap-x-3">
            <span className="inline-flex items-center gap-1.5">
              <User className="inline w-3 h-3" /> {assignee.name}
              {!assignee.active && <span className="text-red-600">({L('inactive', '無効')})</span>}
              <RoleBadges ids={assignee.roles} compact />
            </span>
            <span className={cx(t.dueDate < todayStr() && t.status !== 'done' && 'text-red-600 font-semibold')}>
              <Calendar className="inline w-3 h-3 -mt-0.5" /> {L('Due', '期日')} {fmtDate(lang, t.dueDate)}
            </span>
            {t.evidence.length > 0 && (
              <span>
                <Paperclip className="inline w-3 h-3 -mt-0.5" /> {L('Attachments', '証跡')} {t.evidence.length}
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cx('h-full rounded-full', delayed ? 'bg-red-500' : pct === 100 ? 'bg-emerald-500' : 'bg-sky-500')}
                style={{ width: `${pct}%` }}
              />
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
            <h4 className="text-xs font-bold text-slate-500 mb-2">🏁 {L('Milestones', 'マイルストーン')}</h4>
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
                        {T(m.label)}
                        <span className={cx('block text-xs', late ? 'text-red-600 font-semibold' : 'text-slate-400')}>
                          {fmtDate(lang, m.due)}
                          {late && ' ⚠️ Delayed'}
                          {m.done && m.doneAt && ` · ${L('done', '完了')} ${fmtHM(m.doneAt)}`}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ol>

            {t.approval && (
              <div className="mt-4 rounded-xl bg-slate-50 ring-1 ring-slate-200 p-3 text-xs space-y-1">
                <div className="font-semibold text-slate-600">
                  {L('Approval route', '承認ルート')}: {T(trayName(t.approval.type))}
                </div>
                <div className="text-slate-500">
                  {L('Auto-routed because', '自動振り分け理由')}: {T(t.approval.reason)}
                </div>
                {t.approval.decidedBy && (
                  <div className="text-slate-500">
                    {L('Decision', '判定')}: {t.approval.decidedBy} · {fmtHM(t.approval.decidedAt)}
                    {t.approval.note && <span className="block text-slate-700">💬 {t.approval.note}</span>}
                  </div>
                )}
                {isMine && (t.approval.status === 'revision' || t.approval.status === 'rejected') && (
                  <div className="flex items-center gap-2 pt-2">
                    {t.requiresExpense && (
                      <input
                        className={cx(inputCls, 'w-32 py-1')}
                        type="number"
                        value={newAmount}
                        onChange={(e) => setNewAmount(e.target.value)}
                        placeholder={L('Amount (PHP)', '金額 (Php)')}
                      />
                    )}
                    <button onClick={() => resubmit(t.id, t.requiresExpense ? Number(newAmount) || 0 : undefined)} className={cx(btn.primary, 'py-1')}>
                      <RotateCcw className="w-3.5 h-3.5" /> {L('Fix & resubmit', '修正して再申請')}
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
                <h4 className="text-xs font-bold text-slate-500 mb-2">🚧 {L('One-tap blocker report', '3秒ワンタップ Blocker 申告')}</h4>
                {t.blocker ? (
                  <div className="rounded-xl bg-orange-50 ring-1 ring-orange-200 p-3 text-sm flex items-center gap-2">
                    <span className="font-semibold text-orange-800">{T(BLOCKERS[t.blocker.reason])}</span>
                    <span className="text-xs text-orange-700">
                      {t.blocker.by} · {fmtHM(t.blocker.at)}
                    </span>
                    {canEdit && (
                      <button onClick={() => clearBlocker(t.id)} className="ml-auto text-xs underline text-orange-800">
                        {L('Clear', '解除')}
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
                        className="text-sm rounded-xl ring-1 ring-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-800 font-medium py-2 px-1 disabled:opacity-40"
                      >
                        {T(BLOCKERS[r])}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <h4 className="text-xs font-bold text-slate-500 mb-2">📎 {L('Proof (photo / document / link)', '証跡（写真・書類・リンク）')}</h4>
              <div className="flex flex-wrap gap-2 mb-2">
                {t.evidence.map((e) => (
                  <div key={e.id} className="group relative rounded-lg ring-1 ring-slate-200 p-1.5 flex items-center gap-2 text-xs bg-slate-50 max-w-full">
                    {e.kind === 'photo' ? (
                      e.url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- ローカルで選んだ写真の blob: プレビュー
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
                      <button onClick={() => removeEvidence(t.id, e.id)} className="text-slate-400 hover:text-red-600" aria-label={L('Remove', '削除')}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {t.evidence.length === 0 && <span className="text-xs text-slate-400">{L('No proof attached yet', 'まだ証跡はありません')}</span>}
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
                      <Camera className="w-4 h-4" /> {L('Take photo (mock)', '写真を撮る（モック）')}
                    </button>
                    <button onClick={() => fileRef.current?.click()} className={cx(btn.ghost, 'flex-1 py-1.5')}>
                      <Paperclip className="w-4 h-4" /> {L('Choose file', 'ファイル選択')}
                    </button>
                    <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onFile} />
                  </div>
                  <div className="flex gap-2">
                    <input
                      className={cx(inputCls, 'py-1.5')}
                      placeholder={L('https://drive.google.com/... (attach a link)', 'https://drive.google.com/... (リンク添付)')}
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                    />
                    <button
                      disabled={!link.trim()}
                      onClick={() => {
                        attachEvidence(t.id, { name: link.trim(), kind: 'link', url: link.trim() });
                        setLink('');
                      }}
                      className={cx(btn.ghost, 'py-1.5')}
                    >
                      {L('Add', '追加')}
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
                      <Check className="w-4 h-4" /> {L('Attach proof & complete', '証跡を添付して完了')}
                    </button>
                    {t.requiresOuting && isMine && (
                      <button onClick={() => setTab('transit')} className={btn.orange}>
                        <Car className="w-4 h-4" /> {L('Go out', '外出へ')}
                      </button>
                    )}
                  </>
                ) : (
                  <button onClick={() => reopenTask(t.id)} className={btn.ghost}>
                    <RotateCcw className="w-4 h-4" /> {L('Reopen', '再オープン')}
                  </button>
                )}
              </div>
            )}
            {!canEdit && (
              <div className="text-xs text-slate-400">
                {L('GM / HQO view is read-only here (approve from the approval trays)', '※ GM / HQO ビューは閲覧のみ（承認操作は承認トレイから）')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ApprovalTray({ type, items }: { type: ApprovalType; items: Task[] }) {
  const { role, staffName, L, T } = useApp();
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
            <div className="font-bold">
              {T(trayName(type))} {L('Tray', 'トレイ')}
            </div>
            <div className="text-xs opacity-80">
              {type === 'HQO'
                ? L('Bank withdrawals, purchases of ₱15,000+, payroll, etc.', '口座出金・15,000 Php以上の備品調達・給与 など')
                : L('Visa, TESDA & other government procedures, employment contracts, outings, etc.', 'ビザ・TESDA等の公的手続き・雇用契約・外出訪問 など')}
            </div>
          </div>
        </div>
        <div className="ml-auto flex gap-6 text-right">
          <div>
            <div className="text-xs opacity-80">{L('Pending', '承認待ち')}</div>
            <div className="text-2xl font-black">{pending.length}</div>
          </div>
          {type === 'HQO' && (
            <div>
              <div className="text-xs opacity-80">{L('Total to pay out', '出金予定総額')}</div>
              <div className="text-2xl font-black">{fmtPhp(total)}</div>
            </div>
          )}
        </div>
      </div>
      {!canAct && (
        <div className="text-xs rounded-lg bg-yellow-50 ring-1 ring-yellow-200 text-yellow-800 px-3 py-2">
          {L(
            `👀 View only — switch to “${type === 'HQO' ? '🏦 HQO (Finance)' : '👔 GM (Japan)'}” in the top bar to approve`,
            `👀 閲覧モード — 承認操作は上部ロールバーで「${type === 'HQO' ? '🏦 HQO (Finance)' : '👔 GM (Japan)'}」に切り替えてください`,
          )}
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-3">
        {pending.map((t) => (
          <ApprovalCard key={t.id} task={t} canAct={canAct} />
        ))}
        {pending.length === 0 && (
          <Card className="md:col-span-2">
            <EmptyState>{L('Nothing awaiting approval ✅', '承認待ちはありません ✅')}</EmptyState>
          </Card>
        )}
      </div>
      {decided.length > 0 && (
        <Card title={L('History', '処理済み履歴')} icon={<FileText className="w-5 h-5 text-slate-500" />}>
          <div className="divide-y divide-slate-100">
            {decided.map((t) => (
              <div key={t.id} className="py-2 flex flex-wrap items-center gap-2 text-sm">
                <ApprovalBadge approval={t.approval} />
                <span className="font-medium">{T(t.title)}</span>
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
  const { decide, staffName, staffOf, L, T, lang } = useApp();
  const [mode, setMode] = useState<null | 'revision' | 'rejected'>(null);
  const [note, setNote] = useState('');
  const delayed = isTaskDelayed(t);
  return (
    <div className="bg-white rounded-2xl ring-1 ring-yellow-300 shadow-sm p-4 flex flex-col">
      <div className="flex flex-wrap items-center gap-1.5 mb-1">
        <CategoryBadge category={t.category} />
        <span className="text-xs text-slate-400">{T(t.subCategory)}</span>
        {delayed && <Badge className="bg-red-600 text-white ring-red-600">⚠️ Delayed</Badge>}
      </div>
      <div className="font-semibold">{T(t.title)}</div>
      <div className="text-xs text-slate-500 mt-1 space-y-0.5">
        <div>
          {L('Requested by', '申請')}: {staffName(t.createdBy)} → {L('assignee', '担当')} {staffName(t.assigneeId)} · {L('due', '期日')} {fmtDate(lang, t.dueDate)}
        </div>
        <div>
          {L('Routed because', '振り分け理由')}: {t.approval ? T(t.approval.reason) : ''}
        </div>
        <RoleBadges ids={staffOf(t.assigneeId).roles} />
        {t.requiresOuting && (
          <div>
            🚗 {L('Destination', '外出先')}: {destOf(t.destinationId)?.name ?? L('Not set', '未設定')}
          </div>
        )}
      </div>
      {t.requiresExpense && <div className="mt-2 text-2xl font-black text-emerald-700">{fmtPhp(t.amount)}</div>}
      <div className="mt-2 flex flex-wrap gap-1">
        {t.milestones.map((m) => (
          <span key={m.id} className={cx('text-xs px-2 py-0.5 rounded-full', m.done ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
            {m.done ? '✓' : '○'} {T(m.label)}
          </span>
        ))}
      </div>
      <div className="mt-auto pt-3">
        {mode ? (
          <div className="space-y-2">
            <textarea
              className={cx(inputCls, 'h-16')}
              placeholder={
                mode === 'revision'
                  ? L('What should be fixed? (e.g. Please add one more quote)', '修正してほしい点（例: 見積をもう1社追加してください）')
                  : L('Reason for returning (e.g. Not in this month’s budget)', '差戻し理由（例: 今月は予算外のため見送り）')
              }
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
                <Send className="w-4 h-4" /> {mode === 'revision' ? L('Send revision request', '修正依頼を送信') : L('Send return', '差戻しを送信')}
              </button>
              <button className={btn.ghost} onClick={() => setMode(null)}>
                {L('Cancel', 'キャンセル')}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <button disabled={!canAct} onClick={() => decide(t.id, 'approved')} className={btn.green}>
              <Check className="w-4 h-4" /> {L('Approve', '承認')}
            </button>
            <button disabled={!canAct} onClick={() => setMode('revision')} className={btn.yellow}>
              <Pencil className="w-4 h-4" /> {L('Revise', '修正')}
            </button>
            <button disabled={!canAct} onClick={() => setMode('rejected')} className={btn.red}>
              <RotateCcw className="w-4 h-4" /> {L('Return', '差戻し')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Add Task modal ---------- */

function AddTaskModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (t: Task) => void }) {
  const { role, me, activeStaff, jobRoles, L, T } = useApp();
  const [category, setCategory] = useState<Category>('docs');
  const [subCategory, setSubCategory] = useState(T(SUBCATEGORIES.docs[0]));
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState(role === 'staff' ? me.id : activeStaff[0]?.id ?? '');
  const [dueDate, setDueDate] = useState(dayRel(3));
  const [milestones, setMilestones] = useState<Array<{ id: string; label: string; due: string }>>([{ id: uid('m'), label: '', due: dayRel(1) }]);
  const [requiresOuting, setOuting] = useState(false);
  const [destinationId, setDestinationId] = useState(DESTINATIONS[0].id);
  const [requiresExpense, setExpense] = useState(false);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  // 候補から選んだ中分類は 2言語のまま保存（どちらの言語でも表示できるように）
  const subValue: Text = SUBCATEGORIES[category].find((s) => s.en === subCategory || s.ja === subCategory) ?? subCategory;
  const amt = Number(amount) || 0;
  const route = routeApproval({ category, subCategory: subValue, title, requiresOuting, requiresExpense, amount: amt });

  const submit = () => {
    if (!title.trim()) return setError(L('Enter a task name', 'タスク名を入力してください'));
    if (requiresExpense && amt <= 0) return setError(L('Enter the amount when the expense flag is on', '費用フラグONの場合は金額を入力してください'));
    const filled = milestones.filter((m) => m.label.trim());
    const task: Task = {
      id: uid('task'),
      category,
      subCategory: subValue,
      title: title.trim(),
      assigneeId,
      createdBy: role === 'staff' ? me.id : role.toUpperCase(),
      dueDate,
      milestones: filled.length
        ? filled.map((m) => ({ id: uid('ms'), label: m.label.trim(), due: m.due || dueDate, done: false }))
        : [{ id: uid('ms'), label: bi('Complete', '完了'), due: dueDate, done: false }],
      requiresOuting,
      requiresExpense,
      amount: requiresExpense ? amt : 0,
      approval: route ? { ...route, status: 'pending' } : null,
      status: 'todo',
      evidence: [],
      destinationId: requiresOuting ? destinationId : undefined,
      transitPhase: 'none',
      createdAt: nowTs(),
    };
    onSubmit(task);
  };

  return (
    <Modal title={L('+ Add Task', '＋ Add Task（新規タスク起票）')} onClose={onClose} wide>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>{L('Category', '大分類')}</label>
          <select
            className={inputCls}
            value={category}
            onChange={(e) => {
              const c = e.target.value as Category;
              setCategory(c);
              setSubCategory(T(SUBCATEGORIES[c][0]));
            }}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {T(CATEGORY_LABEL[c])}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>{L('Sub-category', '中分類')}</label>
          <input className={inputCls} list="cebu-subcats" value={subCategory} onChange={(e) => setSubCategory(e.target.value)} />
          <datalist id="cebu-subcats">
            {SUBCATEGORIES[category].map((s) => (
              <option key={s.en} value={T(s)} />
            ))}
          </datalist>
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>{L('Task name *', 'タスク名 *')}</label>
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={L('e.g. 9G visa extension / Payroll transfer / Buy a printer', '例: BI Visa 9G 延長申請 / 給与振込 / プリンター購入')}
          />
        </div>
        <div>
          <label className={labelCls}>{L('Due date', '期日')}</label>
          <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <AssigneePicker
            label={L('Assignee (one person)', '担当者（単一選択）')}
            value={assigneeId}
            onChange={setAssigneeId}
            staff={activeStaff}
            recommended={CATEGORY_ROLES[category] ?? []}
            hint={
              (CATEGORY_ROLES[category] ?? []).length
                ? L(
                    `★ = has the ${(CATEGORY_ROLES[category] ?? []).map((id) => T(jobRoles.find((r) => r.id === id)?.label ?? id)).join(' / ')} role, suited to "${T(CATEGORY_LABEL[category])}"`,
                    `★ =「${T(CATEGORY_LABEL[category])}」に向いた ROLE（${(CATEGORY_ROLES[category] ?? []).map((id) => T(jobRoles.find((r) => r.id === id)?.label ?? id)).join(' / ')}）を持つスタッフ`,
                  )
                : undefined
            }
          />
        </div>

        <div className="md:col-span-2">
          <label className={labelCls}>{L('Milestones (multiple steps)', 'マイルストーン（複数ステップ）')}</label>
          <div className="space-y-2">
            {milestones.map((m, i) => (
              <div key={m.id} className="flex gap-2 items-center">
                <span className="text-xs font-mono text-slate-400 w-5">{i + 1}.</span>
                <input
                  className={inputCls}
                  placeholder={L(`Step ${i + 1} (e.g. Prepare docs → Submit → Receive)`, `ステップ ${i + 1}（例: 書類準備 → 窓口提出 → 受領）`)}
                  value={m.label}
                  onChange={(e) => setMilestones((list) => list.map((x) => (x.id === m.id ? { ...x, label: e.target.value } : x)))}
                />
                <input
                  type="date"
                  className={cx(inputCls, 'w-44')}
                  value={m.due}
                  onChange={(e) => setMilestones((list) => list.map((x) => (x.id === m.id ? { ...x, due: e.target.value } : x)))}
                />
                <button
                  disabled={milestones.length === 1}
                  onClick={() => setMilestones((list) => list.filter((x) => x.id !== m.id))}
                  className="p-2 text-slate-400 hover:text-red-600 disabled:opacity-30"
                  aria-label={L('Remove', '削除')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button onClick={() => setMilestones((list) => [...list, { id: uid('m'), label: '', due: dueDate }])} className={cx(btn.ghost, 'py-1.5')}>
              <Plus className="w-4 h-4" /> {L('Add step', 'ステップを追加')}
            </button>
          </div>
        </div>

        <div className="rounded-xl ring-1 ring-slate-200 p-3 space-y-2">
          <Toggle checked={requiresOuting} onChange={setOuting} label={L('🚗 Outing (external visit)', '🚗 外出フラグ（対外訪問あり）')} />
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
          <Toggle checked={requiresExpense} onChange={setExpense} label={L('💰 Expense (spending money)', '💰 費用フラグ（支出あり）')} />
          {requiresExpense && (
            <input
              type="number"
              min={0}
              className={inputCls}
              placeholder={L('Amount (PHP)', '金額 (Php)')}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          )}
        </div>

        <div
          className={cx(
            'md:col-span-2 rounded-xl p-3 text-sm flex items-center gap-2',
            !route
              ? 'bg-slate-50 text-slate-500'
              : route.type === 'HQO'
                ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                : 'bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200',
          )}
        >
          <Shield className="w-4 h-4 shrink-0" />
          {route ? (
            <span>
              <b>⏳ {L('Needs approval', '要承認')}</b>{' '}
              {L(
                `→ automatically sent to the ${T(trayName(route.type))} tray (reason: ${T(route.reason)})`,
                `→ 「${T(trayName(route.type))}」トレイへ自動振り分け（理由: ${T(route.reason)}）`,
              )}
            </span>
          ) : (
            <span>{L('No approval needed — you can start right after saving', '承認不要 — 登録後すぐに着手できます')}</span>
          )}
        </div>
      </div>
      {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className={btn.ghost}>
          {L('Cancel', 'キャンセル')}
        </button>
        <button onClick={submit} className={btn.primary}>
          <Plus className="w-4 h-4" /> {L('Create task', 'タスクを登録')}
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
  const { role, me, tasks, attendance, visits, depart, arrive, finishVisit, now, staffName, staffOf, L, T, lang } = useApp();
  const myOutings = tasks.filter((t) => t.assigneeId === me.id && t.requiresOuting && (t.status !== 'done' || t.transitPhase === 'done'));
  const active = myOutings.find((t) => t.transitPhase === 'transit' || t.transitPhase === 'arrived');
  const [selected, setSelected] = useState<string>(active?.id ?? myOutings.find((t) => t.status !== 'done')?.id ?? '');
  const sel = tasks.find((t) => t.id === selected);
  const [destId, setDestId] = useState<string>(sel?.destinationId ?? DESTINATIONS[0].id);
  const fileRef = useRef<HTMLInputElement>(null);

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
    { key: 'none', label: L('🏢 Office', '🏢 事務所') },
    { key: 'transit', label: L('🚗 In transit', '🚗 移動中') },
    { key: 'arrived', label: L('📍 Arrived', '📍 到着') },
    { key: 'done', label: L('📸 Done · back', '📸 完了・帰社') },
  ];
  const phaseIdx = sel ? steps.findIndex((s) => s.key === sel.transitPhase) : 0;
  const approvalState = (a: Approval | null) =>
    a?.status === 'pending' ? L('pending', '承認待ち') : a?.status === 'revision' ? L('revision requested', '修正依頼中') : L('returned', '差戻し');

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-5 gap-6">
        {role === 'staff' ? (
          <Card
            title={L(`Outing tasks (${me.name})`, `外出タスク（${me.name}）`)}
            icon={<Car className="w-5 h-5 text-orange-500" />}
            className="lg:col-span-2"
            right={<StatusPill status={onField} />}
          >
            {myOutings.length === 0 ? (
              <EmptyState>
                {L(
                  'No tasks with the outing flag. Create one in Tasks with “🚗 Outing” turned on.',
                  '外出フラグ付きのタスクはありません。Tasks タブで「🚗 外出フラグ」をONにして起票してください。',
                )}
              </EmptyState>
            ) : (
              <>
                <label className={labelCls}>{L('Choose an outing task', '外出タスクを選択')}</label>
                <select
                  className={inputCls}
                  value={selected}
                  onChange={(e) => {
                    setSelected(e.target.value);
                    const t = tasks.find((x) => x.id === e.target.value);
                    if (t?.destinationId) setDestId(t.destinationId);
                  }}
                >
                  <option value="">{L('— Select —', '— 選択してください —')}</option>
                  {myOutings.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.transitPhase === 'done' ? '✅ ' : ''}
                      {T(t.title)}
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
                          <label className={labelCls}>{L('Destination', '目的地')}</label>
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
                            {L(
                              `⏳ Can’t leave yet: ${sel.approval?.type} approval is ${approvalState(sel.approval)}. Switch to ${sel.approval?.type} in the top bar to test approving.`,
                              `⏳ ${sel.approval?.type}承認待ちのため出発できません（${approvalState(sel.approval)}）。ロールバーで ${sel.approval?.type} に切り替えて承認をテストできます。`,
                            )}
                          </div>
                        )}
                        {onField !== 'working' && (
                          <div className="text-xs rounded-lg bg-slate-50 ring-1 ring-slate-200 text-slate-600 px-3 py-2">
                            {L('ℹ️ You must be working (clocked in, not on break) to leave.', 'ℹ️ 出発するには勤務中（Clock-In済・休憩外）である必要があります。')}
                          </div>
                        )}
                        {busyElsewhere && (
                          <div className="text-xs rounded-lg bg-orange-50 ring-1 ring-orange-200 text-orange-800 px-3 py-2">
                            {L(`🚗 Another outing is in progress (${active ? T(active.title) : ''}).`, `🚗 別の外出（${active ? T(active.title) : ''}）が進行中です。`)}
                          </div>
                        )}
                        <button
                          onClick={() => depart(sel.id, destId)}
                          disabled={!canStartOuting(sel) || onField !== 'working' || busyElsewhere}
                          className={cx(btn.orange, 'w-full py-3 text-base')}
                        >
                          <Car className="w-5 h-5" /> {L('🚗 Depart (Transit)', '🚗 出発 (Transit)')}
                        </button>
                      </>
                    )}

                    {sel.transitPhase === 'transit' && (
                      <>
                        <div className="rounded-xl bg-orange-50 ring-1 ring-orange-200 p-3 text-sm text-orange-800">
                          {L(
                            `🚗 On the way to ${destOf(sel.destinationId)?.name} — left ${fmtHM(curVisit?.departAt)} (${curVisit ? Math.round((now - curVisit.departAt) / 60000) : 0} min ago)`,
                            `🚗 ${destOf(sel.destinationId)?.name} へ移動中 — 出発 ${fmtHM(curVisit?.departAt)}（${curVisit ? Math.round((now - curVisit.departAt) / 60000) : 0}分経過）`,
                          )}
                        </div>
                        <button onClick={() => arrive(sel.id)} className={cx(btn.primary, 'w-full py-3 text-base')}>
                          <MapPin className="w-5 h-5" /> {L('📍 Check in on arrival', '📍 到着チェックイン')}
                        </button>
                      </>
                    )}

                    {sel.transitPhase === 'arrived' && (
                      <>
                        <div className="rounded-xl bg-sky-50 ring-1 ring-sky-200 p-3 text-sm text-sky-800">
                          {L(
                            `📍 Arrived at ${destOf(sel.destinationId)?.name} ${fmtHM(curVisit?.arriveAt)}`,
                            `📍 ${destOf(sel.destinationId)?.name} 到着 ${fmtHM(curVisit?.arriveAt)}`,
                          )}
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
                            <Camera className="w-5 h-5" /> {L('📸 Photo receipt & finish', '📸 領収書撮影 & 完了')}
                          </button>
                          <button onClick={() => fileRef.current?.click()} className={cx(btn.ghost, 'py-3')}>
                            <Paperclip className="w-5 h-5" /> {L('Attach file & finish', 'ファイルで添付 & 完了')}
                          </button>
                          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onReceiptFile} />
                        </div>
                      </>
                    )}

                    {sel.transitPhase === 'done' && (
                      <div className="rounded-xl bg-emerald-50 ring-1 ring-emerald-200 p-3 text-sm text-emerald-800">
                        {L('✅ Visit done, back at the office — proof:', '✅ 訪問完了・帰社済み — 証跡:')} {sel.evidence.map((e) => e.name).join(', ') || L('none', 'なし')}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </Card>
        ) : (
          <Card title={L('Staff out of the office', '外出中のスタッフ')} icon={<Car className="w-5 h-5 text-orange-500" />} className="lg:col-span-2">
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
                        {d?.emoji} {d?.name} · {L('left', '出発')} {fmtHM(v.departAt)}
                        {v.arriveAt
                          ? ` · ${L('arrived', '到着')} ${fmtHM(v.arriveAt)}`
                          : ` · ${L(`${Math.round((now - v.departAt) / 60000)} min ago`, `${Math.round((now - v.departAt) / 60000)}分経過`)}`}
                      </div>
                      {t && <div className="text-xs text-slate-500 truncate">📌 {T(t.title)}</div>}
                    </div>
                  );
                })}
              {visits.filter((v) => !v.returnAt).length === 0 && <EmptyState>{L('Nobody is out right now', '現在外出中のスタッフはいません')}</EmptyState>}
            </div>
          </Card>
        )}

        <Card title={L('Check-in Map (mock)', 'チェックイン履歴マップ（モック）')} icon={<MapPin className="w-5 h-5 text-red-500" />} className="lg:col-span-3">
          <MockMap />
        </Card>
      </div>

      <Card title={L('Outing & Check-in History', '外出・チェックイン履歴')} icon={<Navigation className="w-5 h-5 text-slate-600" />}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-3">{L('Date', '日付')}</th>
                <th className="py-2 pr-3">{L('Staff', 'スタッフ')}</th>
                <th className="py-2 pr-3">{L('Destination', '目的地')}</th>
                <th className="py-2 pr-3">{L('Task', 'タスク')}</th>
                <th className="py-2 pr-3">🚗 {L('Left', '出発')}</th>
                <th className="py-2 pr-3">📍 {L('Arrived', '到着')}</th>
                <th className="py-2 pr-3">🏢 {L('Back', '帰社')}</th>
                <th className="py-2 pr-3">{L('Pin', 'ピン')}</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => {
                const d = destOf(v.destinationId);
                const t = tasks.find((x) => x.id === v.taskId);
                return (
                  <tr key={v.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(lang, ymd(new Date(v.departAt)))}</td>
                    <td className="py-2 pr-3">{staffName(v.staffId)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {d?.emoji} {d?.short}
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-500">{t ? T(t.title) : '—'}</td>
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
  const { visits, now, staffName, L } = useApp();
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
              <line key={v.id} x1={officePos.left} y1={officePos.top} x2={p.left} y2={p.top} stroke="#f97316" strokeWidth="2.5" strokeDasharray="6 5" />
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
          <span>🟠 {L('In transit', '移動中')}</span>
          <span>🔵 {L('On site', '訪問中')}</span>
          <span>📍 {L('Check-in', 'チェックイン')}</span>
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
      {/* 生徒登録 → 科目設定 → 講師アサイン の順（セブオフィスのスタッフが日常的に使う） */}
      <SubjectMasterCard />
      <Timetable />
      <OnlineLessons />
    </div>
  );
}

function StudentForm() {
  const { addStudent, L, lang } = useApp();
  const [name, setName] = useState('');
  const [ageGroup, setAgeGroup] = useState<'Kids' | 'Adult'>('Adult');
  const [levelSystem, setLevelSystem] = useState<Student['levelSystem']>('CEFR');
  const [level, setLevel] = useState('A1');
  const [mode, setMode] = useState<'face' | 'online'>('face');
  const [past, setPast] = useState('0');
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(dayRel(27));
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [error, setError] = useState('');

  const slots = slotsInWindow(startTime, endTime);
  const faceError =
    mode !== 'face'
      ? ''
      : !startDate || !endDate
        ? L('Enter the start and end dates', '受講期間（開始日・終了日）を入力してください')
        : endDate < startDate
          ? L('End date must be on or after the start date', '終了日は開始日以降にしてください')
          : endTime <= startTime
            ? L('End time must be after the start time', '終了時刻は開始時刻より後にしてください')
            : slots.length === 0
              ? L('No standard slot fits in this time window', 'この時間帯に入る標準コマがありません')
              : '';

  const submit = () => {
    if (!name.trim()) return setError(L('Enter the student’s name', '氏名を入力してください'));
    if (faceError) return setError(faceError);
    addStudent({
      name: name.trim(),
      ageGroup,
      levelSystem,
      level,
      mode,
      pastLessons: Math.max(0, Number(past) || 0),
      ...(mode === 'face' ? { startDate, endDate, startTime, endTime } : {}),
    });
    setName('');
    setPast('0');
    setError('');
  };

  return (
    <Card title={L('Register Student', '学生登録')} icon={<Plus className="w-5 h-5 text-sky-600" />}>
      <div className="space-y-3">
        <div>
          <label className={labelCls} htmlFor="cebu-st-name">
            {L('Name *', '氏名 *')}
          </label>
          <input
            id="cebu-st-name"
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={L('e.g. Suzuki Ichiro', '例: Suzuki Ichiro')}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>{L('Age group', '年齢区分')}</label>
            <Segmented value={ageGroup} onChange={setAgeGroup} options={[['Kids', '🧒 Kids'], ['Adult', '🧑 Adult']]} />
          </div>
          <div>
            <label className={labelCls}>{L('Lesson type', '受講タイプ')}</label>
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                ['face', L('🏫 In person', '🏫 対面')],
                ['online', L('💻 Online', '💻 オンライン')],
              ]}
            />
          </div>
        </div>

        {mode === 'face' && (
          <div className="rounded-xl bg-pink-50 ring-1 ring-pink-200 p-3 space-y-2">
            <div className="text-xs font-bold text-pink-800">🏫 {L('In-person schedule (required)', '対面授業の受講条件（必須）')}</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls} htmlFor="cebu-st-start">
                  {L('Start date *', '開始日 *')}
                </label>
                <input id="cebu-st-start" type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className={labelCls} htmlFor="cebu-st-end">
                  {L('End date *', '終了日 *')}
                </label>
                <input id="cebu-st-end" type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div>
                <label className={labelCls} htmlFor="cebu-st-stime">
                  {L('Daily start *', '開始時刻 *')}
                </label>
                <select id="cebu-st-stime" className={inputCls} value={startTime} onChange={(e) => setStartTime(e.target.value)}>
                  {START_TIMES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="cebu-st-etime">
                  {L('Daily end *', '終了時刻 *')}
                </label>
                <select id="cebu-st-etime" className={inputCls} value={endTime} onChange={(e) => setEndTime(e.target.value)}>
                  {END_TIMES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className={cx('text-xs', faceError ? 'text-red-600' : 'text-pink-800')}>
              {faceError ||
                L(
                  `${slots.length} slot(s) a day: Slot ${slots[0]?.no}–${slots[slots.length - 1]?.no} (${slots[0]?.start}–${slots[slots.length - 1]?.end}, lunch 12:00–13:00)`,
                  `1日 ${slots.length}コマ: Slot ${slots[0]?.no}〜${slots[slots.length - 1]?.no}（${slots[0]?.start}〜${slots[slots.length - 1]?.end}、昼休憩 12:00〜13:00）`,
                )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>{L('Level scale', 'レベル指標')}</label>
            <Segmented
              value={levelSystem}
              onChange={(v) => {
                setLevelSystem(v);
                setLevel(v === 'CEFR' ? 'A1' : '5級');
              }}
              options={[
                ['CEFR', 'CEFR'],
                ['EIKEN', L('EIKEN', '英検')],
              ]}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="cebu-st-level">
              {L('English level', '英語レベル')}
            </label>
            <select id="cebu-st-level" className={inputCls} value={level} onChange={(e) => setLevel(e.target.value)}>
              {(levelSystem === 'CEFR' ? CEFR_LEVELS : EIKEN_LEVELS).map((l) => (
                <option key={l} value={l}>
                  {levelName(lang, levelSystem, l)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls} htmlFor="cebu-st-past">
            {L('Past lessons (carried over)', '過去の受講回数（移行データ）')}
          </label>
          <input id="cebu-st-past" type="number" min={0} className={inputCls} value={past} onChange={(e) => setPast(e.target.value)} />
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button disabled={!name.trim() || !!faceError} onClick={submit} className={cx(btn.primary, 'w-full')}>
          <Plus className="w-4 h-4" /> {L('Register', '登録する')}
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
          className={cx(
            'flex-1 text-xs py-1.5 px-2 whitespace-nowrap rounded-md font-medium',
            value === v ? 'bg-white shadow text-slate-900' : 'text-slate-500',
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function StudentList() {
  const { students, removeStudent, bookings, role, L, lang } = useApp();
  const [filter, setFilter] = useState<'all' | 'face' | 'online'>('all');
  const list = students.filter((s) => filter === 'all' || s.mode === filter);
  return (
    <Card
      title={L(`Students (${students.length})`, `学生リスト（${students.length}名）`)}
      icon={<Users className="w-5 h-5 text-pink-600" />}
      className="lg:col-span-2"
      right={
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            ['all', L('All', 'すべて')],
            ['face', L('In person', '対面')],
            ['online', L('Online', 'オンライン')],
          ]}
        />
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-3">{L('Name', '氏名')}</th>
              <th className="py-2 pr-3">{L('Age group', '年齢区分')}</th>
              <th className="py-2 pr-3">{L('Level', 'レベル')}</th>
              <th className="py-2 pr-3">{L('Type', '受講タイプ')}</th>
              <th className="py-2 pr-3">{L('In-person period / hours', '対面 受講期間・時間帯')}</th>
              <th className="py-2 pr-3">{L('Lessons', '受講回数')}</th>
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
                    <Badge className="bg-sky-50 text-sky-700 ring-sky-200">{levelText(lang, s)}</Badge>
                  </td>
                  <td className="py-2 pr-3">{s.mode === 'face' ? L('🏫 In person', '🏫 対面') : L('💻 Online', '💻 オンライン')}</td>
                  <td className="py-2 pr-3 text-xs text-slate-600 whitespace-nowrap">
                    {s.mode === 'face' && s.startDate && s.endDate ? (
                      <>
                        {fmtDate(lang, s.startDate)} 〜 {fmtDate(lang, s.endDate)}
                        <span className="block font-mono">
                          {s.startTime}–{s.endTime} · {L(`${slotsInWindow(s.startTime, s.endTime).length} slots/day`, `1日${slotsInWindow(s.startTime, s.endTime).length}コマ`)}
                        </span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2 pr-3 font-mono">{L(`${done}`, `${done}回`)}</td>
                  <td className="py-2 text-right">
                    {role === 'staff' && (
                      <button onClick={() => removeStudent(s.id)} className="text-slate-300 hover:text-red-600" aria-label={L('Remove', '削除')}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 && <EmptyState>{L('No students', '学生がいません')}</EmptyState>}
      </div>
    </Card>
  );
}

function Timetable() {
  const { students, lessons, subjects, setLesson, busyWith, subjectName, activeStaff, staffName, staffOf, roleNames, now, L, T, lang } = useApp();
  const faceStudents = students.filter((s) => s.mode === 'face');
  const [date, setDate] = useState(todayStr());
  const [studentId, setStudentId] = useState(faceStudents[0]?.id ?? '');
  const st = students.find((s) => s.id === studentId);
  const enrolled = st ? isEnrolledOn(st, date) : false;
  const rows = st && enrolled ? slotsInWindow(st.startTime, st.endTime) : [];
  const teachers = sortByRoles(activeStaff, LESSON_ROLES);
  const d = new Date(now);
  const cur = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const dayLessons = lessons.filter((l) => l.date === date && l.teacherId);

  return (
    <Card
      title={L('In-person Timetable', '対面授業 タイムテーブル')}
      icon={<Calendar className="w-5 h-5 text-pink-600" />}
      right={
        <span className="text-xs text-slate-400">
          {L('Standard slots: 50 min · lunch 12:00–13:00 · ★ = Academic / Teacher role', '標準コマ: 各50分・昼休憩 12:00〜13:00 · ★ = 教務・講師管理 ROLE')}
        </span>
      }
    >
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className={labelCls} htmlFor="cebu-tt-date">
            {L('Date', '日付')}
          </label>
          <input id="cebu-tt-date" type="date" className={cx(inputCls, 'py-1.5')} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="min-w-0 flex-1 sm:flex-none sm:w-80">
          <label className={labelCls} htmlFor="cebu-tt-student">
            {L('Student', '生徒')}
          </label>
          <select id="cebu-tt-student" className={cx(inputCls, 'py-1.5')} value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            {faceStudents.length === 0 && <option value="">{L('No in-person students', '対面の生徒がいません')}</option>}
            {faceStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {isEnrolledOn(s, date) ? '' : '— '}
                {s.name}（{s.startTime}–{s.endTime}）{isEnrolledOn(s, date) ? '' : L(' · not enrolled on this date', ' · この日は受講期間外')}
              </option>
            ))}
          </select>
        </div>
        {st && st.mode === 'face' && (
          <div className="text-xs text-slate-500 pb-2">
            {L('Period', '受講期間')}: {st.startDate ? fmtDate(lang, st.startDate) : '—'} 〜 {st.endDate ? fmtDate(lang, st.endDate) : '—'} · {levelText(lang, st)}
          </div>
        )}
      </div>

      {!st ? (
        <EmptyState>{L('Register an in-person student first.', '先に対面の生徒を登録してください。')}</EmptyState>
      ) : !enrolled ? (
        <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-4 text-sm text-slate-600 text-center">
          {L(
            `${st.name} is not enrolled on ${fmtDate(lang, date)}. Pick a date between ${st.startDate ? fmtDate(lang, st.startDate) : '—'} and ${st.endDate ? fmtDate(lang, st.endDate) : '—'}.`,
            `${fmtDate(lang, date)} は ${st.name} の受講期間外です。${st.startDate ? fmtDate(lang, st.startDate) : '—'} 〜 ${st.endDate ? fmtDate(lang, st.endDate) : '—'} の日付を選んでください。`,
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-3 w-36">{L('Slot', 'コマ')}</th>
                <th className="py-2 pr-3">{L('Subject', '科目')}</th>
                <th className="py-2 pr-3">{L('Teacher', '担当講師')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((slot) => {
                const lesson = lessons.find((l) => l.date === date && l.studentId === st.id && l.slotNo === slot.no);
                const live = date === todayStr() && cur >= slot.start && cur < slot.end;
                const assigned = lesson?.teacherId ? staffOf(lesson.teacherId) : undefined;
                return (
                  <tr key={slot.no} className={cx('border-b border-slate-100 align-top', live && 'bg-emerald-50')}>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-slate-800 text-white text-xs font-bold flex items-center justify-center shrink-0">{slot.no}</span>
                        <span className="font-mono font-semibold whitespace-nowrap">
                          {slot.start}–{slot.end}
                        </span>
                        {live && <span className="text-xs bg-emerald-600 text-white rounded px-1.5 py-0.5">NOW</span>}
                      </div>
                    </td>
                    <td className="py-2 pr-3 min-w-0">
                      <select
                        aria-label={L(`Subject for slot ${slot.no}`, `Slot ${slot.no} の科目`)}
                        className={cx(inputCls, 'py-1.5', !lesson?.subjectId && 'text-slate-400')}
                        value={lesson?.subjectId ?? ''}
                        onChange={(e) => setLesson(date, st.id, slot.no, { subjectId: e.target.value || null })}
                      >
                        <option value="">{L('— Subject —', '— 科目を選択 —')}</option>
                        {subjects.map((sb) => (
                          <option key={sb.id} value={sb.id}>
                            {T(sb.name)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-3 min-w-0">
                      <select
                        aria-label={L(`Teacher for slot ${slot.no}`, `Slot ${slot.no} の担当講師`)}
                        className={cx(inputCls, 'py-1.5', !lesson?.teacherId && 'text-slate-400')}
                        value={lesson?.teacherId ?? ''}
                        onChange={(e) => {
                          // 選び直しが拒否されたら select を元の値に戻す（React が value を再適用）
                          setLesson(date, st.id, slot.no, { teacherId: e.target.value || null });
                        }}
                      >
                        <option value="">{L('— Teacher —', '— 講師を選択 —')}</option>
                        {assigned && !assigned.active && (
                          <option value={assigned.id}>
                            {assigned.name} {L('(inactive)', '（無効）')}
                          </option>
                        )}
                        {teachers.map((t) => {
                          const other = busyWith(date, slot.no, t.id, st.id);
                          return (
                            <option key={t.id} value={t.id} disabled={!!other}>
                              {hasAnyRole(t, LESSON_ROLES) ? '★ ' : ''}
                              {t.name}
                              {other ? L(` (Busy · with ${other})`, `（Busy · ${other} を担当中）`) : t.roles.length ? ` — ${roleNames(t.roles)}` : ''}
                            </option>
                          );
                        })}
                      </select>
                      {assigned && (
                        <div className="mt-1">
                          <RoleBadges ids={assigned.roles} highlight={LESSON_ROLES} />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-5">
        <h4 className="text-xs font-bold text-slate-500 mb-2">
          👩‍🏫 {L(`Teacher assignments on ${fmtDate(lang, date)}`, `${fmtDate(lang, date)} の講師アサイン状況`)}
        </h4>
        {dayLessons.length === 0 ? (
          <div className="text-xs text-slate-400">{L('No teachers assigned on this date yet.', 'この日はまだ講師がアサインされていません。')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1 pr-3">{L('Teacher', '講師')}</th>
                  {STD_SLOTS.map((x) => (
                    <th key={x.no} className="py-1 px-1 text-center font-mono">
                      {x.no}
                      <span className="block font-normal text-slate-400">{x.start}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from(new Set(dayLessons.map((l) => l.teacherId as string))).map((tid) => (
                  <tr key={tid} className="border-t border-slate-100">
                    <td className="py-1 pr-3 font-semibold whitespace-nowrap">{staffName(tid)}</td>
                    {STD_SLOTS.map((x) => {
                      const l = dayLessons.find((y) => y.teacherId === tid && y.slotNo === x.no);
                      const stName = l ? students.find((y) => y.id === l.studentId)?.name : '';
                      return (
                        <td key={x.no} className="py-1 px-1 text-center">
                          {l ? (
                            <span
                              title={`${stName}${l.subjectId ? ` · ${subjectName(l.subjectId)}` : ''}`}
                              className="inline-block rounded bg-pink-100 text-pink-800 px-1.5 py-0.5 whitespace-nowrap"
                            >
                              {stName?.split(' ')[0]}
                            </span>
                          ) : (
                            <span className="text-slate-200">·</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

function OnlineLessons() {
  const { students, bookings, addBooking, removeBooking, lessonNo, me, role, activeStaff, staffName, staffOf, roleNames, L, lang } = useApp();
  const teachers = sortByRoles(activeStaff, LESSON_ROLES);
  const [studentId, setStudentId] = useState(students.find((s) => s.mode === 'online')?.id ?? students[0]?.id ?? '');
  const [datetime, setDatetime] = useState(`${dayRel(1)}T16:00`);
  const [teamsUrl, setTeamsUrl] = useState('');
  const [teacherId, setTeacherId] = useState(role === 'staff' ? me.id : teachers[0]?.id ?? '');
  const [mineOnly, setMineOnly] = useState(false);

  const st = students.find((s) => s.id === studentId);
  const previewNo = st ? st.pastLessons + bookings.filter((b) => b.studentId === studentId && b.datetime < datetime).length + 1 : 0;
  const sorted = [...bookings].filter((b) => !mineOnly || b.teacherId === me.id).sort((a, b) => a.datetime.localeCompare(b.datetime));
  const nowStr = `${todayStr()}T00:00`;

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card title={L('Book Online Lesson (Teams)', 'オンラインレッスン予約（Teams）')} icon={<Video className="w-5 h-5 text-violet-600" />}>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>{L('Student', '生徒')}</label>
            <select className={inputCls} value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.mode === 'online' ? '💻' : '🏫'} {s.name}（{levelText(lang, s)}）
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{L('Date & time', '日時')}</label>
            <input type="datetime-local" className={inputCls} value={datetime} onChange={(e) => setDatetime(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>{L('Teams meeting URL', 'Teams 会議URL')}</label>
            <input className={inputCls} value={teamsUrl} onChange={(e) => setTeamsUrl(e.target.value)} placeholder="https://teams.microsoft.com/l/meetup-join/..." />
          </div>
          <div>
            <label className={labelCls}>{L('Teacher', '担当講師')}</label>
            <select className={inputCls} value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              {teachers.map((s) => (
                <option key={s.id} value={s.id}>
                  {hasAnyRole(s, LESSON_ROLES) ? '★ ' : ''}
                  {s.name}
                  {s.roles.length ? ` — ${roleNames(s.roles)}` : ''}
                </option>
              ))}
            </select>
            {teacherId && (
              <div className="mt-1">
                <RoleBadges ids={staffOf(teacherId).roles} highlight={LESSON_ROLES} />
              </div>
            )}
          </div>
          {st && (
            <div className="rounded-lg bg-violet-50 ring-1 ring-violet-200 px-3 py-2 text-sm text-violet-800">
              🔢 {L('Auto lesson count:', '回数自動カウント:')} <b>{L(`${st.name} — lesson #${previewNo}`, `${st.name} 第${previewNo}回`)}</b>
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
            <Calendar className="w-4 h-4" /> {L('Book lesson', '予約を登録')}
          </button>
          <p className="text-xs text-slate-400">
            {L('If you leave the URL empty, a mock Teams link is created.', 'URL未入力の場合はモックのTeamsリンクを自動発行します。')}
          </p>
        </div>
      </Card>

      <Card
        title={L('Bookings', '予約一覧')}
        icon={<Video className="w-5 h-5 text-violet-600" />}
        className="lg:col-span-2"
        right={
          role === 'staff' ? (
            <label className="text-xs flex items-center gap-1.5 text-slate-500">
              <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} className="accent-violet-600" />
              {L('Only mine', '自分の担当のみ')}
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
                className={cx(
                  'rounded-xl ring-1 p-3 flex flex-wrap items-center gap-3',
                  past ? 'bg-slate-50 ring-slate-200 opacity-60' : isToday ? 'bg-violet-50 ring-violet-300' : 'bg-white ring-slate-200',
                )}
              >
                <div className="w-20 text-center">
                  <div className="text-xs text-slate-500">{fmtDate(lang, b.datetime.slice(0, 10))}</div>
                  <div className="font-mono font-bold">{b.datetime.slice(11)}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">
                    {s?.name ?? L('(removed)', '(削除済)')} <span className="text-violet-700">{L(`Lesson #${lessonNo(b)}`, `第${lessonNo(b)}回`)}</span>
                    {isToday && <span className="ml-2 text-xs bg-violet-600 text-white rounded px-1.5 py-0.5">TODAY</span>}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {L('Teacher', '講師')} {staffName(b.teacherId)} · {b.teamsUrl}
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
                    {L('Join Teams', 'Teams会議に参加')}
                  </a>
                )}
                {past && <span className="text-xs text-slate-500">✓ {L('Done', '受講済')}</span>}
                <button onClick={() => removeBooking(b.id)} className="text-slate-300 hover:text-red-600" aria-label={L('Remove', '削除')}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
          {sorted.length === 0 && <EmptyState>{L('No bookings', '予約はありません')}</EmptyState>}
        </div>
      </Card>
    </div>
  );
}

/* ============================================================================
 * Tab 5: Work Log (DTR)
 * ==========================================================================*/

function DTRTab() {
  const { role, me, history, attendance, visits, now, toast, staff, activeStaff, staffName, L, T, lang } = useApp();
  const [period, setPeriod] = useState<Period>('week');
  const [staffFilter, setStaffFilter] = useState<string>(role === 'staff' ? me.id : 'all');
  const [csv, setCsv] = useState<string | null>(null);

  const today = todayStr();
  const statusText = (s: DTRStatus) => (s in DTR_STATUS_LABEL ? T(DTR_STATUS_LABEL[s as keyof typeof DTR_STATUS_LABEL]) : T(STATUS_META[s as AttStatus].label));
  const liveRows: DTRRow[] = activeStaff.map((s) => {
    const a = attendance[s.id] ?? { status: 'off' as AttStatus, breaks: [] };
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
      status: !a.clockIn ? 'notyet' : a.clockOut ? (late ? 'late' : 'present') : a.status,
      live: true,
    };
  });

  const from = (() => {
    const d = new Date();
    if (period === 'today') return today;
    if (period === 'week') {
      const dow = (d.getDay() + 6) % 7; // Monday start
      return ymd(addDays(d, -dow));
    }
    return ymd(new Date(d.getFullYear(), d.getMonth(), 1));
  })();

  const rows = [...history, ...liveRows]
    .filter((r) => r.date >= from && r.date <= today)
    .filter((r) => staffFilter === 'all' || r.staffId === staffFilter)
    .sort((a, b) => b.date.localeCompare(a.date) || staff.findIndex((s) => s.id === a.staffId) - staff.findIndex((s) => s.id === b.staffId));

  const summary = activeStaff.filter((s) => staffFilter === 'all' || s.id === staffFilter).map((s) => {
    const rs = rows.filter((r) => r.staffId === s.id);
    return {
      s,
      days: rs.filter((r) => r.clockIn).length,
      late: rs.filter((r) => r.status === 'late').length,
      absent: rs.filter((r) => r.status === 'absent').length,
      work: rs.reduce((x, r) => x + r.workMin, 0),
      brk: rs.reduce((x, r) => x + r.breakMin, 0),
      out: rs.reduce((x, r) => x + r.outingMin, 0),
    };
  });

  const exportCsv = () => {
    const header = [
      L('Date', '日付'),
      L('Staff', 'スタッフ'),
      'Clock-In',
      'Clock-Out',
      L('Break (min)', '休憩(分)'),
      L('Outing (min)', '外出(分)'),
      L('Work Hours', '実働(時間)'),
      L('Status', 'ステータス'),
    ];
    const lines = rows
      .slice()
      .reverse()
      .map((r) =>
        [
          r.date,
          staffName(r.staffId),
          fmtHM(r.clockIn),
          r.clockOut ? fmtHM(r.clockOut) : r.live && r.clockIn ? L('(working)', '(勤務中)') : '--:--',
          r.breakMin,
          r.outingMin,
          (r.workMin / 60).toFixed(2),
          // CSV には絵文字を含めない（STATUS_META のラベルは「絵文字 + 空白 + 文言」）
          r.status in DTR_STATUS_LABEL ? statusText(r.status) : statusText(r.status).replace(/^\S+\s/, ''),
        ]
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
      toast(bi(`📊 DTR CSV exported (${rows.length} rows)`, `📊 DTR CSV を出力しました（${rows.length}行）`), 'ok');
    } catch {
      toast(bi('The download was blocked. Copy the CSV from the preview instead.', 'ダウンロードがブロックされました。プレビューからコピーしてください'), 'warn');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className={labelCls}>{L('Period', '期間')}</label>
            <Segmented
              value={period}
              onChange={setPeriod}
              options={[
                ['today', L('Today', '今日')],
                ['week', L('This week', '今週')],
                ['month', L('This month', '今月')],
              ]}
            />
          </div>
          <div>
            <label className={labelCls}>{L('Staff', 'スタッフ')}</label>
            <select className={cx(inputCls, 'py-1.5 w-44')} value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} disabled={role === 'staff'}>
              {role !== 'staff' && <option value="all">{L(`All (${activeStaff.length})`, `全員 (${activeStaff.length}名)`)}</option>}
              {activeStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="text-xs text-slate-500 pb-2">
            {fmtDate(lang, from)} 〜 {fmtDate(lang, today)} · {L(`${rows.length} rows`, `${rows.length}件`)}
          </div>
          <button onClick={exportCsv} className={cx(btn.green, 'ml-auto')}>
            <Download className="w-4 h-4" /> {L('Export DTR CSV', 'DTR CSVエクスポート')}
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
            <div className="text-xs text-slate-500">{L('Total hours worked', '実働合計')}</div>
            <div className="grid grid-cols-3 gap-1 mt-2 text-center text-xs">
              <div className="bg-slate-50 rounded py-1">
                <div className="font-bold">{days}</div>
                {L('Days', '出勤日')}
              </div>
              <div className="bg-yellow-50 rounded py-1">
                <div className="font-bold text-yellow-700">{late}</div>
                {L('Late', '遅刻')}
              </div>
              <div className="bg-red-50 rounded py-1">
                <div className="font-bold text-red-600">{absent}</div>
                {L('Absent', '欠勤')}
              </div>
            </div>
            <div className="text-xs text-slate-500 mt-2">
              ☕ {L('Break', '休憩')} {fmtDuration(brk)} · 🚗 {L('Outing', '外出')} {fmtDuration(out)}
            </div>
          </div>
        ))}
      </div>

      <Card title={L('Attendance & Break Summary (DTR)', '出退勤・休憩 集計表（DTR）')} icon={<FileText className="w-5 h-5 text-slate-600" />}>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-3">{L('Date', '日付')}</th>
                <th className="py-2 pr-3">{L('Staff', 'スタッフ')}</th>
                <th className="py-2 pr-3">Clock-In</th>
                <th className="py-2 pr-3">Clock-Out</th>
                <th className="py-2 pr-3 text-right">{L('Break', '休憩')}</th>
                <th className="py-2 pr-3 text-right">{L('Outing', '外出')}</th>
                <th className="py-2 pr-3 text-right">{L('Worked', '実働')}</th>
                <th className="py-2">{L('Status', 'ステータス')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.date}_${r.staffId}`} className={cx('border-b border-slate-100', r.live && 'bg-sky-50')}>
                  <td className="py-1.5 pr-3 whitespace-nowrap">
                    {fmtDate(lang, r.date)} {r.live && <span className="text-xs text-sky-600 font-semibold">LIVE</span>}
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
                        'text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap',
                        r.status === 'present' && 'bg-emerald-100 text-emerald-800',
                        r.status === 'late' && 'bg-yellow-100 text-yellow-800',
                        r.status === 'absent' && 'bg-red-100 text-red-700',
                        r.live && r.status !== 'present' && r.status !== 'late' && 'bg-sky-100 text-sky-800',
                      )}
                    >
                      {statusText(r.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <EmptyState>{L('No data for this period', '該当期間のデータはありません')}</EmptyState>}
        </div>
      </Card>

      {csv !== null && (
        <Modal title={L('📊 CSV Preview (paste into Excel / Google Sheets)', '📊 CSV プレビュー（Excel / Google Sheets に貼り付け可）')} onClose={() => setCsv(null)} wide>
          <textarea readOnly className={cx(inputCls, 'h-72 font-mono text-xs')} value={csv} onFocus={(e) => e.currentTarget.select()} />
          <div className="mt-3 flex justify-end gap-2">
            <button
              className={btn.ghost}
              onClick={() => {
                navigator.clipboard?.writeText(csv).then(
                  () => toast(bi('Copied to clipboard', 'クリップボードにコピーしました'), 'ok'),
                  () => toast(bi('Couldn’t copy. Select the text and copy it manually.', 'コピーできませんでした。テキストを選択してコピーしてください'), 'warn'),
                );
              }}
            >
              {L('Copy', 'コピー')}
            </button>
            <button className={btn.dark} onClick={() => setCsv(null)}>
              {L('Close', '閉じる')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ============================================================================
 * Tab 6: Staff Settings (GM / HQO only)
 * ==========================================================================*/

function StaffSettingsTab() {
  const { staff, activeStaff, jobRoles, addJobRole, removeJobRole, L, T } = useApp();
  const [newRole, setNewRole] = useState('');
  const inactive = staff.filter((s) => !s.active);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-4 text-white bg-gradient-to-r from-slate-800 to-slate-700 flex flex-wrap items-center gap-4">
        <Settings className="w-6 h-6" />
        <div>
          <div className="font-bold">{L('Staff Settings', 'スタッフ設定')}</div>
          <div className="text-xs opacity-80">
            {L(
              'GM / HQO only. Names and roles you save here update the top bar, dashboard, tasks and timetable immediately.',
              'GM / HQO 専用。ここで保存した名前と ROLE は、上部バー・ダッシュボード・タスク・時間割に即座に反映されます。',
            )}
          </div>
        </div>
        <div className="ml-auto flex gap-6 text-right">
          <div>
            <div className="text-xs opacity-80">{L('Active', '有効')}</div>
            <div className="text-2xl font-black">{activeStaff.length}</div>
          </div>
          <div>
            <div className="text-xs opacity-80">{L('Inactive', '無効')}</div>
            <div className="text-2xl font-black">{inactive.length}</div>
          </div>
          <div>
            <div className="text-xs opacity-80">ROLE</div>
            <div className="text-2xl font-black">{jobRoles.length}</div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card title={L('Role tags', 'ROLE タグ')} icon={<Shield className="w-5 h-5 text-indigo-600" />}>
          <p className="text-xs text-slate-500 mb-3">
            {L(
              'One person can hold any number of roles, and several people can share the same role.',
              '1人が何個でも ROLE を兼任でき、同じ ROLE を複数人で持つこともできます。',
            )}
          </p>
          <div className="space-y-1.5">
            {jobRoles.map((r) => {
              const holders = activeStaff.filter((s) => s.roles.includes(r.id));
              return (
                <div key={r.id} className="flex items-center gap-2 text-sm">
                  <span className={cx('text-xs font-semibold px-1.5 py-0.5 rounded-md ring-1 whitespace-nowrap', r.color)}>{T(r.label)}</span>
                  <span className="text-xs text-slate-500 truncate">
                    {holders.length ? holders.map((h) => h.name).join(', ') : L('nobody yet', 'まだ誰もいません')}
                  </span>
                  {r.custom ? (
                    <button
                      onClick={() => removeJobRole(r.id)}
                      className="ml-auto text-slate-300 hover:text-red-600"
                      aria-label={L(`Delete role ${T(r.label)}`, `ROLE「${T(r.label)}」を削除`)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <span className="ml-auto text-xs text-slate-300">{L('default', '既定')}</span>
                  )}
                </div>
              );
            })}
          </div>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (addJobRole(newRole)) setNewRole('');
            }}
          >
            <input
              id="cebu-new-role"
              className={cx(inputCls, 'py-1.5')}
              placeholder={L('New role, e.g. Marketing', '新しい ROLE（例: Marketing）')}
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
            />
            <button type="submit" disabled={!newRole.trim()} className={cx(btn.primary, 'py-1.5 whitespace-nowrap')}>
              <Plus className="w-4 h-4" /> {L('Add role', 'ROLE 追加')}
            </button>
          </form>
        </Card>

        <AddStaffCard />
      </div>

      <SubjectMasterCard />

      <Card title={L('Staff', 'スタッフ一覧')} icon={<Users className="w-5 h-5 text-slate-600" />}>
        <div className="grid md:grid-cols-2 gap-3">
          {[...activeStaff, ...inactive].map((s) => (
            <StaffEditor key={s.id} member={s} />
          ))}
        </div>
      </Card>
    </div>
  );
}

/** ROLE をタップで付け外しするチップ群 */
function RolePicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { jobRoles, T } = useApp();
  return (
    <div className="flex flex-wrap gap-1.5">
      {jobRoles.map((r) => {
        const on = value.includes(r.id);
        return (
          <button
            key={r.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== r.id) : [...value, r.id])}
            className={cx(
              'text-xs font-semibold px-2 py-1 rounded-md ring-1 whitespace-nowrap transition',
              on ? r.color : 'bg-white text-slate-400 ring-slate-200 hover:text-slate-600',
            )}
          >
            {on ? '✓ ' : '+ '}
            {T(r.label)}
          </button>
        );
      })}
    </div>
  );
}

function AddStaffCard() {
  const { addStaff, L } = useApp();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[6]);
  const [roles, setRoles] = useState<string[]>([]);

  return (
    <Card title={L('Add Staff', 'スタッフ追加')} icon={<Plus className="w-5 h-5 text-sky-600" />} className="lg:col-span-2">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          addStaff({ name: name.trim(), avatar, roles });
          setName('');
          setRoles([]);
        }}
      >
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="cebu-new-staff-name">
              {L('Name *', '名前 *')}
            </label>
            <input
              id="cebu-new-staff-name"
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={L('e.g. Joy', '例: Joy')}
            />
          </div>
          <div>
            <label className={labelCls}>{L('Icon', 'アイコン')}</label>
            <div className="flex flex-wrap gap-1">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAvatar(a)}
                  aria-pressed={avatar === a}
                  className={cx('w-8 h-8 rounded-lg text-lg', avatar === a ? 'bg-sky-100 ring-2 ring-sky-500' : 'hover:bg-slate-100')}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <label className={labelCls}>{L('Roles (tap to add or remove)', 'ROLE（タップで付け外し）')}</label>
          <RolePicker value={roles} onChange={setRoles} />
        </div>
        <button type="submit" disabled={!name.trim()} className={btn.primary}>
          <Plus className="w-4 h-4" /> {L('Add staff', 'スタッフを追加')}
        </button>
      </form>
    </Card>
  );
}

function StaffEditor({ member }: { member: Staff }) {
  const { saveStaff, setStaffActive, tasks, activeStaff, L } = useApp();
  const [name, setName] = useState(member.name);
  const [roles, setRoles] = useState<string[]>(member.roles);
  const [confirmOff, setConfirmOff] = useState(false);
  const openTasks = tasks.filter((t) => t.assigneeId === member.id && t.status !== 'done').length;
  const dirty = name.trim() !== member.name || roles.length !== member.roles.length || roles.some((r) => !member.roles.includes(r));
  const lastActive = member.active && activeStaff.length <= 1;

  return (
    <div className={cx('rounded-xl ring-1 p-3 space-y-3', member.active ? 'ring-slate-200 bg-white' : 'ring-slate-200 bg-slate-50 opacity-75')}>
      <div className="flex items-center gap-2">
        <span className="text-2xl">{member.avatar}</span>
        <input
          id={`cebu-staff-name-${member.id}`}
          aria-label={L('Name', '名前')}
          className={cx(inputCls, 'py-1.5 font-semibold')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!member.active}
        />
        {!member.active && <Badge className="bg-slate-200 text-slate-700 ring-slate-300">{L('Inactive', '無効')}</Badge>}
      </div>
      <div>
        <div className="text-xs font-semibold text-slate-500 mb-1">
          ROLE <span className="font-normal text-slate-400">({roles.length})</span>
        </div>
        {member.active ? <RolePicker value={roles} onChange={setRoles} /> : <RoleBadges ids={member.roles} />}
      </div>
      <div className="text-xs text-slate-500">{L(`${openTasks} open task(s) assigned`, `担当中のタスク ${openTasks}件`)}</div>

      {confirmOff ? (
        <div className="rounded-lg bg-orange-50 ring-1 ring-orange-200 p-2 text-xs text-orange-800 space-y-2">
          <div>
            {openTasks > 0
              ? L(
                  `${member.name} still has ${openTasks} open task(s). They stay assigned and keep showing the name. Deactivate anyway?`,
                  `${member.name} には未完了タスクが ${openTasks}件 残っています（担当者名はそのまま表示されます）。無効化しますか？`,
                )
              : L(`Deactivate ${member.name}? You can reactivate later.`, `${member.name} を無効化しますか？ あとで再有効化できます。`)}
          </div>
          <div className="flex gap-2">
            <button
              className={cx(btn.orange, 'py-1')}
              onClick={() => {
                setStaffActive(member.id, false);
                setConfirmOff(false);
              }}
            >
              {L('Deactivate', '無効化する')}
            </button>
            <button className={cx(btn.ghost, 'py-1')} onClick={() => setConfirmOff(false)}>
              {L('Cancel', 'キャンセル')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {member.active ? (
            <>
              <button
                disabled={!dirty || !name.trim()}
                onClick={() => saveStaff(member.id, { name: name.trim(), roles })}
                className={cx(btn.green, 'py-1.5')}
              >
                <Check className="w-4 h-4" /> {L('Save', '保存')}
              </button>
              {dirty && (
                <button
                  onClick={() => {
                    setName(member.name);
                    setRoles(member.roles);
                  }}
                  className={cx(btn.ghost, 'py-1.5')}
                >
                  <RotateCcw className="w-4 h-4" /> {L('Undo changes', '変更を戻す')}
                </button>
              )}
              <button
                disabled={lastActive}
                title={lastActive ? L('At least one active staff member is required', '有効なスタッフが最低1名必要です') : undefined}
                onClick={() => setConfirmOff(true)}
                className={cx(btn.ghost, 'py-1.5 ml-auto text-red-600')}
              >
                {L('Deactivate', '無効化')}
              </button>
            </>
          ) : (
            <button onClick={() => setStaffActive(member.id, true)} className={cx(btn.primary, 'py-1.5')}>
              <RotateCcw className="w-4 h-4" /> {L('Reactivate', '再有効化')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SubjectMasterCard() {
  const { subjects, lessons, addSubject, removeSubject, L, T } = useApp();
  const [name, setName] = useState('');
  return (
    <Card title={L('📚 Subject Master', '📚 科目マスター')} icon={<GraduationCap className="w-5 h-5 text-pink-600" />}>
      <p className="text-xs text-slate-500 mb-3">
        {L(
          'Anyone (Staff, GM, HQO) can add or remove subjects. They appear right away in the in-person timetable.',
          'スタッフ・GM・HQO の誰でも科目を追加・削除できます。追加した科目はすぐに対面授業タイムテーブルで選べます。',
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        {subjects.map((sb) => {
          const used = lessons.filter((l) => l.subjectId === sb.id).length;
          return (
            <span key={sb.id} className="inline-flex items-center gap-1.5 text-sm rounded-lg ring-1 ring-pink-200 bg-pink-50 text-pink-800 pl-2.5 pr-1.5 py-1">
              {T(sb.name)}
              <span className="text-xs text-pink-500">{L(`${used} lesson(s)`, `${used}コマ`)}</span>
              <button
                onClick={() => removeSubject(sb.id)}
                className="text-pink-300 hover:text-red-600"
                aria-label={L(`Delete subject ${T(sb.name)}`, `科目「${T(sb.name)}」を削除`)}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          );
        })}
      </div>
      <form
        className="mt-4 flex gap-2 max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (addSubject(name)) setName('');
        }}
      >
        <input
          id="cebu-new-subject"
          className={cx(inputCls, 'py-1.5')}
          placeholder={L('New subject, e.g. TOEIC Prep', '新しい科目（例: TOEIC対策）')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" disabled={!name.trim()} className={cx(btn.primary, 'py-1.5 whitespace-nowrap')}>
          <Plus className="w-4 h-4" /> {L('Add subject', '科目を追加')}
        </button>
      </form>
    </Card>
  );
}
