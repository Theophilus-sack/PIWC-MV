import { describe, it, expect } from "vitest";
import { can, accessLevel, canManageRoles, navForRole, ROLES, MODULES } from "./rbac.js";

// Transcribed independently from the spec's permission matrix (not copied
// from rbac.js's internal MATRIX) so this test actually catches a
// transcription error in rbac.js, rather than just checking the module
// against itself. "—" cells (no access) are simply omitted per role/module.
const EXPECTED_ACCESS = {
  dashboard:     { super_admin: true,  pastor: true,  finance: true,  ministry_leader: true,  comms_media: true,  secretary: true },
  members:       { super_admin: true,  pastor: true,  finance: false, ministry_leader: true,  comms_media: false, secretary: true },
  attendance:    { super_admin: true,  pastor: true,  finance: false, ministry_leader: true,  comms_media: false, secretary: true },
  support_ordinance: { super_admin: true,  pastor: true,  finance: false, ministry_leader: false, comms_media: false, secretary: true },
  finance:       { super_admin: true,  pastor: true,  finance: true,  ministry_leader: false, comms_media: false, secretary: false },
  messages:      { super_admin: true,  pastor: true,  finance: false, ministry_leader: true,  comms_media: true,  secretary: true },
  events:        { super_admin: true,  pastor: true,  finance: false, ministry_leader: true,  comms_media: true,  secretary: true },
  groups:        { super_admin: true,  pastor: true,  finance: false, ministry_leader: true,  comms_media: false, secretary: true },
  leadership:    { super_admin: true,  pastor: true,  finance: false, ministry_leader: true,  comms_media: true,  secretary: true },
  inventory:     { super_admin: true,  pastor: true,  finance: false, ministry_leader: false, comms_media: false, secretary: true },
  reports:       { super_admin: true,  pastor: true,  finance: true,  ministry_leader: true,  comms_media: true,  secretary: true },
  sermon_prep:   { super_admin: false, pastor: true,  finance: false, ministry_leader: false, comms_media: false, secretary: false },
  audit_logs:    { super_admin: true,  pastor: true,  finance: false, ministry_leader: false, comms_media: false, secretary: false },
  admin:         { super_admin: true,  pastor: true,  finance: false, ministry_leader: false, comms_media: false, secretary: false },
};

describe("rbac permission matrix", () => {
  for (const module of MODULES) {
    for (const role of ROLES) {
      const expected = EXPECTED_ACCESS[module][role];
      it(`${role} ${expected ? "CAN" : "CANNOT"} access ${module}`, () => {
        expect(can(role, module)).toBe(expected);
      });
    }
  }

  it("Sermon/Word Prep excludes Super Admin explicitly (literal spec rule, not an omission)", () => {
    expect(can("super_admin", "sermon_prep")).toBe(false);
    expect(can("pastor", "sermon_prep")).toBe(true);
  });

  it("only Super Admin and Pastor can manage roles", () => {
    expect(canManageRoles("super_admin")).toBe(true);
    expect(canManageRoles("pastor")).toBe(true);
    for (const role of ROLES.filter((r) => r !== "super_admin" && r !== "pastor")) {
      expect(canManageRoles(role)).toBe(false);
    }
  });

  it("an unknown/unassigned role has no access to anything", () => {
    for (const module of MODULES) {
      expect(can(null, module)).toBe(false);
      expect(can(undefined, module)).toBe(false);
    }
  });

  it("navForRole never surfaces a module the role can't access", () => {
    for (const role of ROLES) {
      const nav = navForRole(role);
      for (const item of nav) {
        expect(accessLevel(role, item.module)).not.toBeNull();
      }
    }
  });

  it("Finance module: Finance role gets full access, everyone scoped/blocked correctly", () => {
    expect(accessLevel("finance", "finance")).toBe("full");
    expect(accessLevel("pastor", "finance")).toBe("view");
    expect(accessLevel("secretary", "finance")).toBeNull();
    expect(accessLevel("ministry_leader", "finance")).toBeNull();
  });
});
