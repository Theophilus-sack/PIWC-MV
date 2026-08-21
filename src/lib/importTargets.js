// One config per importable/exportable table — this is what lets the
// import/export UI in MessagesPage.jsx be one generic engine instead of a
// parallel component per table. Columns/validation here are generated
// from the real schema (0002_core_data.sql + 0003_member_profile_fields.sql
// for members, 0010_messaging_extended.sql for manual_contacts) — not an
// invented column list.
import { normalizeGhanaPhone } from "./sms.js";
import { ageBracketLabel } from "./ageBracket.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeGender(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "male" || s === "m") return "Male";
  if (s === "female" || s === "f") return "Female";
  return null;
}

const STATUS_VALUES = ["first-timer", "stay", "visit"];
function normalizeStatus(v) {
  const s = String(v ?? "").trim().toLowerCase();
  return STATUS_VALUES.includes(s) ? s : null;
}

const MARITAL_STATUS_VALUES = ["Single", "Married", "Divorced", "Widowed", "Engaged", "Separated"];
function normalizeMaritalStatus(v) {
  const s = String(v ?? "").trim().toLowerCase();
  return MARITAL_STATUS_VALUES.find((m) => m.toLowerCase() === s) ?? null;
}

// PIWC-{4-digit year}-{4-or-more-digit sequence} — matches exactly what
// 0020/0021's set_member_id() trigger generates, so a pre-assigned id
// from the one-time historical import round-trips as-is.
const MEMBER_ID_RE = /^PIWC-\d{4}-\d{4,}$/;

export const IMPORT_TARGETS = {
  manualContacts: {
    key: "manualContacts",
    label: "Manual Contacts",
    table: "manual_contacts",
    templateColumns: ["full_name", "phone", "email", "group_label", "notes"],
    templateExample: {
      full_name: "Kwame Mensah", phone: "0241234567", email: "kwame@example.com",
      group_label: "Youth Ministry", notes: "",
    },
    exportColumns: [
      { key: "full_name", label: "Full Name" },
      { key: "phone", label: "Phone", isPhone: true },
      { key: "email", label: "Email" },
      { key: "group_label", label: "Group / Label" },
      { key: "notes", label: "Notes" },
    ],
    // Purely structural/format validation — duplicate detection against
    // existing records happens one layer up (CsvImportModal), since that
    // needs a fetched existing-records set this function doesn't have.
    validateRow(raw) {
      const errors = [];
      const fullName = (raw.full_name ?? "").trim();
      if (!fullName) errors.push("Missing full name");

      const phoneRaw = (raw.phone ?? "").trim();
      let phone = null;
      if (!phoneRaw) errors.push("Missing phone number");
      else {
        phone = normalizeGhanaPhone(phoneRaw);
        if (!phone) errors.push("Invalid phone number");
      }

      const email = (raw.email ?? "").trim();
      if (email && !EMAIL_RE.test(email)) errors.push("Invalid email address");

      if (errors.length) return { ok: false, errors };
      return {
        ok: true,
        errors: [],
        warnings: [],
        row: { fullName, phone, email, groupLabel: (raw.group_label ?? "").trim(), notes: (raw.notes ?? "").trim() },
        duplicateValue: phone,
      };
    },
  },

  members: {
    key: "members",
    label: "Members",
    table: "members",
    templateColumns: [
      "name", "gender", "contact", "email", "residence", "preferred_assembly",
      "status", "date_of_birth", "date_joined", "visiting_from",
      "nationality", "marital_status", "whatsapp_number", "skills_talents",
      "educational_professional_background", "educational_institution",
      "workplace_name", "ministry", "department", "member_id",
    ],
    templateExample: {
      name: "Ama Boateng", gender: "Female", contact: "0551234567", email: "ama@example.com",
      residence: "Adenta", preferred_assembly: "English", status: "stay", date_of_birth: "",
      date_joined: "2026-01-15", visiting_from: "", nationality: "Ghana", marital_status: "Single",
      whatsapp_number: "0551234567", skills_talents: "Graphic design, singing",
      educational_professional_background: "Accountant",
      educational_institution: "University of Ghana", workplace_name: "Ghana Revenue Authority",
      ministry: "Women's Ministry", department: "", member_id: "",
    },
    // age_bracket is server-computed — never in the import template,
    // always in the export. member_id is normally server-generated too,
    // but the import template DOES accept it (left blank in the normal
    // case) — see validateRow's memberId handling below, for the
    // one-time historical backfill of members who already have a
    // church-assigned id.
    exportColumns: [
      { key: "member_id", label: "Member ID" },
      { key: "name", label: "Name" },
      { key: "gender", label: "Gender" },
      { key: "contact", label: "Phone", isPhone: true },
      { key: "email", label: "Email" },
      { key: "whatsapp_number", label: "WhatsApp Number", isPhone: true },
      { key: "residence", label: "Residence" },
      { key: "preferred_assembly", label: "Preferred Assembly" },
      { key: "status", label: "Status" },
      { key: "nationality", label: "Nationality" },
      { key: "marital_status", label: "Marital Status" },
      { key: "date_of_birth", label: "Date of Birth" },
      { key: "age_bracket", label: "Age Bracket" },
      { key: "date_joined", label: "Date Joined" },
      { key: "visiting_from", label: "Visiting From" },
      { key: "skills_talents", label: "Skills/Talents" },
      { key: "educational_professional_background", label: "Educational/Professional Background" },
      { key: "educational_institution", label: "Educational Institution" },
      { key: "workplace_name", label: "Workplace Name" },
    ],
    // Applied to every record right before export — age_bracket is never
    // stored, so it's computed fresh at export time from date_of_birth.
    deriveExportRow: (row) => ({ ...row, age_bracket: ageBracketLabel(row.date_of_birth) }),
    // ctx.ministries: [{id, name, assembly}] — used to map the free-text
    // "ministry" (English/Twi) and "department" (assembly='Both', same
    // table the Groups/Leadership pages already label "Departments")
    // columns to existing ministries. An unmatched name is a warning
    // (row still imports), never a hard error and never a silently-
    // created new ministry/department.
    validateRow(raw, ctx = {}) {
      const errors = [];
      const warnings = [];

      const name = (raw.name ?? "").trim();
      if (!name) errors.push("Missing name");

      let gender = null;
      const genderRaw = (raw.gender ?? "").trim();
      if (genderRaw) {
        gender = normalizeGender(genderRaw);
        if (!gender) errors.push("Invalid gender (expected Male/Female)");
      }

      let contact = null;
      const contactRaw = (raw.contact ?? "").trim();
      if (contactRaw) {
        contact = normalizeGhanaPhone(contactRaw);
        if (!contact) errors.push("Invalid phone number");
      }

      let whatsappNumber = null;
      const whatsappRaw = (raw.whatsapp_number ?? "").trim();
      if (whatsappRaw) {
        whatsappNumber = normalizeGhanaPhone(whatsappRaw);
        if (!whatsappNumber) errors.push("Invalid WhatsApp number");
      }

      const email = (raw.email ?? "").trim();
      if (email && !EMAIL_RE.test(email)) errors.push("Invalid email address");

      // Normally absent (server-generated by the BEFORE INSERT trigger).
      // Only meaningful for the one-time historical backfill of members
      // who already have a church-assigned id — if supplied it must match
      // the exact format the trigger itself produces; the trigger only
      // generates a fresh one when member_id is null, so a valid supplied
      // id is used as-is and never overwritten.
      let memberId = undefined;
      const memberIdRaw = (raw.member_id ?? "").trim();
      if (memberIdRaw) {
        if (!MEMBER_ID_RE.test(memberIdRaw)) errors.push("Invalid Member ID format (expected PIWC-YYYY-NNNN)");
        else memberId = memberIdRaw;
      }

      let status = "stay";
      const statusRaw = (raw.status ?? "").trim();
      if (statusRaw) {
        status = normalizeStatus(statusRaw);
        if (!status) errors.push("Invalid status (expected first-timer/stay/visit)");
      }

      let assembly = null;
      const assemblyRaw = (raw.preferred_assembly ?? "").trim();
      if (assemblyRaw) {
        const match = ["English", "Twi"].find((a) => a.toLowerCase() === assemblyRaw.toLowerCase());
        if (!match) errors.push("Invalid preferred assembly (expected English/Twi)");
        assembly = match ?? null;
      }

      let maritalStatus = null;
      const maritalRaw = (raw.marital_status ?? "").trim();
      if (maritalRaw) {
        maritalStatus = normalizeMaritalStatus(maritalRaw);
        if (!maritalStatus) errors.push("Invalid marital status (expected Single/Married/Divorced/Widowed/Engaged/Separated)");
      }

      const ministryIds = [];
      const ministryRaw = (raw.ministry ?? "").trim();
      if (ministryRaw) {
        const match = (ctx.ministries ?? []).find((m) =>
          m.name.toLowerCase() === ministryRaw.toLowerCase() && m.assembly !== "Both"
        );
        if (match) ministryIds.push(match.id);
        else warnings.push(`Ministry "${ministryRaw}" not found — member will still be imported, just without that ministry link.`);
      }
      const departmentRaw = (raw.department ?? "").trim();
      if (departmentRaw) {
        const match = (ctx.ministries ?? []).find((m) =>
          m.name.toLowerCase() === departmentRaw.toLowerCase() && m.assembly === "Both"
        );
        if (match) ministryIds.push(match.id);
        else warnings.push(`Department "${departmentRaw}" not found — member will still be imported, just without that department link.`);
      }

      if (errors.length) return { ok: false, errors };
      return {
        ok: true,
        errors: [],
        warnings,
        row: {
          name, gender, contact, email: email || null,
          residence: (raw.residence ?? "").trim() || null,
          preferred_assembly: assembly, status,
          date_of_birth: (raw.date_of_birth ?? "").trim() || null,
          date_joined: (raw.date_joined ?? "").trim() || undefined, // undefined -> DB default (today)
          visiting_from: (raw.visiting_from ?? "").trim() || null,
          nationality: (raw.nationality ?? "").trim() || undefined, // undefined -> DB default ('Ghana')
          marital_status: maritalStatus,
          whatsapp_number: whatsappNumber,
          skills_talents: (raw.skills_talents ?? "").trim() || null,
          educational_professional_background: (raw.educational_professional_background ?? "").trim() || null,
          educational_institution: (raw.educational_institution ?? "").trim() || null,
          workplace_name: (raw.workplace_name ?? "").trim() || null,
          member_id: memberId, // undefined unless a valid pre-assigned id was supplied
          ministryIds,
        },
        duplicateValue: contact,
      };
    },
  },
};
