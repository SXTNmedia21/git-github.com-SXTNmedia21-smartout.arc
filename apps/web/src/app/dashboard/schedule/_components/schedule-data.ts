// Shared dummy data and types for the schedule module.
// Will be replaced by real Supabase queries when we build out Module 3.

export type DragPreviewData = {
  title?: string;
  role?: string;
  time?: string;
};

export type Employee = {
  id: string;
  name: string;
  role: string;
  team: string;
  hours: string;
  shifts: string;
  avatarColor: string;
  initials: string;
};

export type DayColumn = {
  id: string;
  label: string;
  staff: number;
  shifts: number;
  cost: string;
  isToday?: boolean;
  isHoliday?: boolean;
  coverageAlert?: string;
  messages?: number;
  tasks?: { done: number; total: number };
  situation: string;
};

export type Shift = {
  id: string;
  employeeId: string;
  dateId: string;
  role?: string;
  time?: string;
  status?: string;
  indicator?: string;
  zone?: string;
  type?: string;
  absenceType?: string;
  reason?: string;
};

export const dummyEmployees: Employee[] = [
  {
    id: "e1",
    name: "Lars Erik Johansen",
    role: "Sous Chef",
    team: "Kjøkken",
    hours: "38.5",
    shifts: "5",
    avatarColor: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    initials: "LJ",
  },
  {
    id: "e2",
    name: "Ahmad Reza",
    role: "Kokk",
    team: "Kjøkken",
    hours: "30",
    shifts: "4",
    avatarColor: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    initials: "AR",
  },
  {
    id: "e3",
    name: "Ingrid Haugen",
    role: "Manager",
    team: "Sal & Service",
    hours: "40",
    shifts: "5",
    avatarColor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    initials: "IH",
  },
  {
    id: "e4",
    name: "Fatima Abdi",
    role: "Housekeeping",
    team: "Drift",
    hours: "24",
    shifts: "4",
    avatarColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    initials: "FA",
  },
  {
    id: "e5",
    name: "Karoline Smith",
    role: "Servitør",
    team: "Sal & Service",
    hours: "20",
    shifts: "3",
    avatarColor: "bg-pink-500/20 text-pink-400 border-pink-500/30",
    initials: "KS",
  },
  {
    id: "e6",
    name: "Bjørn Isaksen",
    role: "Oppvask",
    team: "Kjøkken",
    hours: "15",
    shifts: "3",
    avatarColor: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
    initials: "BI",
  },
];

/** Unique roles derived from employee data, for dropdown selects */
export const AVAILABLE_ROLES = [...new Set(dummyEmployees.map((e) => e.role))];

/** Unique teams derived from employee data, for dropdown selects */
export const AVAILABLE_TEAMS = [...new Set(dummyEmployees.map((e) => e.team))];

/** Physical zones within the venue, for shift assignment dropdowns */
export const AVAILABLE_ZONES = [
  "Hovedkjøkken",
  "Kaldt kjøkken",
  "Bar",
  "Sal 1",
  "Sal 2",
  "Uteservering",
  "Resepsjon",
];

export const openShiftItems = [
  { id: "open-1", title: "Ekstra Servitør", time: "17:00-23:00" },
  { id: "open-2", title: "Vaskevakt", time: "22:00-02:00" },
];

export const dummyDays: DayColumn[] = [
  {
    id: "d1",
    label: "Man 22/12",
    staff: 4,
    shifts: 4,
    cost: "5,264",
    messages: 2,
    tasks: { done: 3, total: 5 },
    situation: "Normal",
  },
  {
    id: "d2",
    label: "Tir 23/12",
    staff: 3,
    shifts: 4,
    cost: "4,100",
    isToday: true,
    coverageAlert: "⚠️ Mangler Housekeeping",
    messages: 5,
    tasks: { done: 1, total: 6 },
    situation: "Krise",
  },
  {
    id: "d3",
    label: "Ons 24/12",
    staff: 5,
    shifts: 5,
    cost: "9,681",
    isHoliday: true,
    messages: 0,
    tasks: { done: 0, total: 2 },
    situation: "Normal",
  },
  {
    id: "d4",
    label: "Tor 25/12",
    staff: 0,
    shifts: 0,
    cost: "0",
    isHoliday: true,
    messages: 0,
    tasks: { done: 0, total: 0 },
    situation: "Normal",
  },
  {
    id: "d5",
    label: "Fre 26/12",
    staff: 4,
    shifts: 4,
    cost: "6,200",
    messages: 1,
    tasks: { done: 4, total: 8 },
    situation: "Normal",
  },
  {
    id: "d6",
    label: "Lør 27/12",
    staff: 6,
    shifts: 8,
    cost: "12,400",
    messages: 8,
    tasks: { done: 2, total: 10 },
    situation: "Selskap",
  },
  {
    id: "d7",
    label: "Søn 28/12",
    staff: 4,
    shifts: 4,
    cost: "7,100",
    messages: 1,
    tasks: { done: 0, total: 4 },
    situation: "Normal",
  },
];

export const dailyShifts: Shift[] = [
  // MONDAY
  {
    id: "s1",
    employeeId: "e1",
    dateId: "d1",
    role: "Sous Chef",
    time: "15:00-23:00",
    status: "completed",
    indicator: "blue",
    zone: "Hovedkjøkken",
  },
  {
    id: "s2",
    employeeId: "e3",
    dateId: "d1",
    role: "Manager",
    time: "08:00-16:00",
    status: "completed",
    indicator: "purple",
    zone: "Kontor / Floor",
  },
  {
    id: "s3",
    employeeId: "e2",
    dateId: "d1",
    type: "absence",
    absenceType: "Sykdom",
    reason: "Sluttet 12:00",
  },
  {
    id: "s4",
    employeeId: "e4",
    dateId: "d1",
    role: "Housekeeping",
    time: "22:00-02:00",
    status: "published",
    indicator: "emerald",
  },

  // TUESDAY
  {
    id: "s5",
    employeeId: "e1",
    dateId: "d2",
    role: "Sous Chef",
    time: "10:00-14:00",
    status: "published",
    indicator: "blue",
    zone: "Prep",
  },
  {
    id: "s6",
    employeeId: "e1",
    dateId: "d2",
    role: "Sous Chef",
    time: "18:00-22:00",
    status: "draft",
    indicator: "blue",
    zone: "Varmmat",
  },
  {
    id: "s7",
    employeeId: "e3",
    dateId: "d2",
    role: "Manager",
    time: "10:00-18:00",
    status: "active",
    indicator: "purple",
    zone: "Floor",
  },
  {
    id: "s8",
    employeeId: "e2",
    dateId: "d2",
    role: "Kokk",
    time: "16:00-23:00",
    status: "published",
    indicator: "orange",
    zone: "Kaldmat",
  },

  // WEDNESDAY
  {
    id: "s9",
    employeeId: "e1",
    dateId: "d3",
    role: "Sous Chef",
    time: "08:00-16:00",
    status: "published",
    indicator: "blue",
    zone: "Hovedkjøkken",
  },
  {
    id: "s10",
    employeeId: "e3",
    dateId: "d3",
    type: "absence",
    absenceType: "Ferie",
    reason: "Julaften",
  },
  {
    id: "s11",
    employeeId: "e2",
    dateId: "d3",
    role: "Kokk",
    time: "08:00-16:00",
    status: "published",
    indicator: "orange",
  },
  {
    id: "s12",
    employeeId: "e4",
    dateId: "d3",
    role: "Housekeeping",
    time: "06:00-12:00",
    status: "draft",
    indicator: "emerald",
  },
];
