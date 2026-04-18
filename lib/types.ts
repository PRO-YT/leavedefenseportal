export type UserRole = "soldier" | "supervisor" | "commander";

export type LeaveStatus = "pending" | "approved" | "denied";
export type PersonnelStatus = "available" | "on_leave" | "tdy" | "training";
export type Tone = "neutral" | "watch" | "elevated" | "critical";

export type LeaveType =
  | "Annual Leave"
  | "Sick Leave"
  | "Emergency Leave"
  | "Pass"
  | "Administrative Absence"
  | "Convalescent Leave";

export interface LeaveBalance {
  annual: number;
  sick: number;
  admin: number;
}

export interface SessionUser {
  id: string;
  name: string;
  rank: string;
  email: string;
  unit: string;
  role: UserRole;
  callsign: string;
  missionDesk: string;
  clearance: string;
  homeStation: string;
  leaveBalance: LeaveBalance;
}

export interface CredentialProfile extends SessionUser {
  password: string;
}

export interface ReadinessMetric {
  id: string;
  label: string;
  value: string;
  numericValue: number;
  target: number;
  delta: string;
  detail: string;
  tone: Tone;
}

export interface MissionAlert {
  id: string;
  label: string;
  title: string;
  summary: string;
  timestamp: string;
  tone: Tone;
  action: string;
}

export interface LeaveRequest {
  id: string;
  soldierName: string;
  soldierRank: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  status: LeaveStatus;
  submittedDate: string;
  supervisor: string;
  justification: string;
  risk: Tone;
  missionImpact: string;
  coveragePlan: string;
}

export interface PersonnelMember {
  id: string;
  name: string;
  rank: string;
  roleTitle: string;
  unit: string;
  squad: string;
  specialty: string;
  email: string;
  phone: string;
  location: string;
  readiness: number;
  status: PersonnelStatus;
  nextAvailability: string;
}

export interface SecurityControl {
  id: string;
  title: string;
  detail: string;
  status: "active" | "watching" | "planned";
  owner: string;
}

export interface AuditEvent {
  id: string;
  title: string;
  detail: string;
  actor: string;
  timestamp: string;
  severity: Tone;
}

export interface ReportSeries {
  label: string;
  value: number;
  target: number;
  summary: string;
}

export interface PolicyWindow {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  impact: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}
