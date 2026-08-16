// Client-side mirror of the permission matrix for UI gating only (hide/
// disable controls, route redirects). It is NOT the source of authority —
// every table in Supabase has its own Row Level Security policy built from
// the same rules, and that's what actually blocks an unauthorized request.
// A role denied here must also be denied by RLS; see supabase/migrations.

export const ROLES = /** @type {const} */ ([
  "super_admin",
  "pastor",
  "finance",
  "ministry_leader",
  "comms_media",
  "secretary",
]);

export const ROLE_LABELS = {
  super_admin: "Super Admin",
  pastor: "Pastor",
  finance: "Finance",
  ministry_leader: "Ministry Leader",
  comms_media: "Communications/Media",
  secretary: "Secretary",
};

// "full" = create/read/update/delete
// "own"  = scoped to the caller's own ministry (Ministry Leader) or own
//          records (Pastor's dashboard layout, per-role dashboard stats)
// "view" = read-only
// "send" = Messages-specific: can compose/send, scope may be limited
// "log"  = Attendance-specific: can record but not necessarily edit history
// null   = no access at all
export const MODULES = [
  "dashboard",
  "members",
  "attendance",
  "pastoral_care",
  "finance",
  "messages",
  "events",
  "groups",
  "leadership",
  "inventory",
  "reports",
  "sermon_prep",
  "audit_logs",
  "admin",
];

export const MODULE_LABELS = {
  dashboard: "Dashboard",
  members: "Members",
  attendance: "Attendance",
  pastoral_care: "Pastoral Care",
  finance: "Finance",
  messages: "Messages",
  events: "Events",
  groups: "Groups/Ministries",
  leadership: "Leadership",
  inventory: "Inventory",
  reports: "Reports",
  sermon_prep: "Sermon/Word Prep",
  audit_logs: "Audit Logs",
  admin: "Admin",
};

// Derived directly from the spec's permission matrix. Kept literal —
// e.g. sermon_prep has NO super_admin access, by design (not an omission).
const MATRIX = {
  dashboard:      { super_admin: "full", pastor: "own",  finance: "own",  ministry_leader: "own",  comms_media: "own",  secretary: "full" },
  members:        { super_admin: "full", pastor: "view", finance: null,   ministry_leader: "own",  comms_media: null,   secretary: "full" },
  attendance:     { super_admin: "full", pastor: "view", finance: null,   ministry_leader: "log",   comms_media: null,   secretary: "log" },
  pastoral_care:  { super_admin: "full", pastor: "full", finance: null,   ministry_leader: null,    comms_media: null,   secretary: "view" },
  finance:        { super_admin: "full", pastor: "view", finance: "full", ministry_leader: null,    comms_media: null,   secretary: null },
  messages:       { super_admin: "full", pastor: "view", finance: null,   ministry_leader: "own",   comms_media: "full", secretary: "send" },
  events:         { super_admin: "full", pastor: "full", finance: null,   ministry_leader: "own",   comms_media: "full", secretary: "log" },
  groups:         { super_admin: "full", pastor: "view", finance: null,   ministry_leader: "own",   comms_media: null,   secretary: "view" },
  leadership:     { super_admin: "full", pastor: "full", finance: null,   ministry_leader: "view",  comms_media: "view", secretary: "full" },
  inventory:      { super_admin: "full", pastor: "view", finance: null,   ministry_leader: null,    comms_media: null,   secretary: "full" },
  reports:        { super_admin: "full", pastor: "full", finance: "own",  ministry_leader: "own",   comms_media: "own",  secretary: "log" },
  sermon_prep:    { super_admin: null,   pastor: "full", finance: null,   ministry_leader: null,    comms_media: null,   secretary: null },
  audit_logs:     { super_admin: "full", pastor: "full", finance: null,   ministry_leader: null,    comms_media: null,   secretary: null },
  admin:          { super_admin: "full", pastor: "full", finance: null,   ministry_leader: null,    comms_media: null,   secretary: null },
};

/** What access level (or null) a role has for a module. */
export function accessLevel(role, module) {
  return MATRIX[module]?.[role] ?? null;
}

/** Whether a role has any access at all to a module (nav visibility / route guard). */
export function can(role, module) {
  return accessLevel(role, module) !== null;
}

/** Whether a role has unrestricted (create/update/delete) access to a module. */
export function canManage(role, module) {
  return accessLevel(role, module) === "full";
}

/** Only Super Admin and Pastor may create/assign roles — spec-literal rule. */
export function canManageRoles(role) {
  return role === "super_admin" || role === "pastor";
}

export const NAV_ITEMS = [
  { key: "dashboard", module: "dashboard", label: "Dashboard", icon: "dashboard", path: "/" },
  { key: "members", module: "members", label: "Members", icon: "members", path: "/members" },
  { key: "attendance", module: "attendance", label: "Attendance", icon: "attendance", path: "/attendance" },
  { key: "pastoral_care", module: "pastoral_care", label: "Pastoral Care", icon: "heart", path: "/pastoral-care" },
  { key: "finance", module: "finance", label: "Finance", icon: "reports", path: "/finance" },
  { key: "messages", module: "messages", label: "Messages", icon: "bell", path: "/messages" },
  { key: "events", module: "events", label: "Events", icon: "calendar", path: "/events" },
  { key: "groups", module: "groups", label: "Groups/Ministries", icon: "church", path: "/groups" },
  { key: "leadership", module: "leadership", label: "Leadership", icon: "user", path: "/leadership" },
  { key: "inventory", module: "inventory", label: "Inventory", icon: "box", path: "/inventory" },
  { key: "reports", module: "reports", label: "Reports", icon: "reports", path: "/reports" },
  { key: "sermon_prep", module: "sermon_prep", label: "Sermon/Word Prep", icon: "mic", path: "/sermon-prep" },
  { key: "audit_logs", module: "audit_logs", label: "Audit Logs", icon: "shield", path: "/audit-logs" },
  { key: "admin", module: "admin", label: "Admin", icon: "settings", path: "/admin" },
];

export function navForRole(role) {
  return NAV_ITEMS.filter((item) => can(role, item.module));
}
