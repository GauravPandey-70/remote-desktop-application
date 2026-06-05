// ============================================
// DeskLink — API Types
// REST API request/response shapes
// ============================================

// --- Auth ---

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  orgId: string | null;
  createdAt: string;
}

// --- Devices ---

export interface DeviceListResponse {
  devices: import('./device').DeviceSummary[];
  total: number;
}

export interface DeviceDetailResponse {
  device: import('./device').Device;
  activeSessions: import('./session').Session[];
}

// --- Sessions ---

export interface SessionListResponse {
  sessions: import('./session').Session[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SessionDetailResponse {
  session: import('./session').Session;
  events: import('./session').SessionEvent[];
}

// --- Organizations ---

export interface CreateOrgRequest {
  name: string;
  slug: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  settings: OrgSettings;
  createdAt: string;
}

export interface OrgSettings {
  maxSessionDurationMinutes: number;
  allowUnattendedAccess: boolean;
  requirePasscode: boolean;
  passcodeExpiryMinutes: number;
}

export interface OrgMember {
  userId: string;
  displayName: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
}

// --- Access Rules ---

export type AccessRuleType = 'allow_list' | 'time_window' | 'require_approval';

export interface AccessRule {
  id: string;
  orgId: string;
  ruleType: AccessRuleType;
  config: AllowListConfig | TimeWindowConfig | RequireApprovalConfig;
  isActive: boolean;
  createdAt: string;
}

export interface AllowListConfig {
  allowedUserIds?: string[];
  allowedIpRanges?: string[];
  allowedDeviceIds?: string[];
}

export interface TimeWindowConfig {
  timezone: string;
  windows: Array<{
    dayOfWeek: number[];
    startTime: string; // HH:mm
    endTime: string;   // HH:mm
  }>;
}

export interface RequireApprovalConfig {
  approverUserIds: string[];
  timeoutMinutes: number;
}

// --- Pagination ---

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// --- API Error ---

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
