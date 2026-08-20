// One config per importable/exportable table — this is what lets the
// import/export UI in MessagesPage.jsx be one generic engine instead of a
// parallel component per table. Columns/validation here are generated
// from the real schema (0002_core_data.sql + 0003_member_profile_fields.sql
// for members, 0010_messaging_extended.sql for manual_contacts) — not an
// invented column list.
import { normalizeGhanaPhone } from "./sms.js";

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
      "name", "gender", "contact", "residence", "preferred_assembly",
      "status", "date_of_birth", "date_joined", "visiting_from", "ministry",
    ],
    templateExample: {
      name: "Ama Boateng", gender: "Female", contact: "0551234567", residence: "Adenta",
      preferred_assembly: "English", status: "stay", date_of_birth: "", date_joined: "2026-01-15",
      visiting_from: "", ministry: "Women's Ministry",
    },
    exportColumns: [
      { key: "name", label: "Name" },
      { key: "gender", label: "Gender" },
      { key: "contact", label: "Phone", isPhone: true },
      { key: "residence", label: "Residence" },
      { key: "preferred_assembly", label: "Preferred Assembly" },
      { key: "status", label: "Status" },
      { key: "date_of_birth", label: "Date of Birth" },
      { key: "date_joined", label: "Date Joined" },
      { key: "visiting_from", label: "Visiting From" },
    ],
    // ctx.ministries: [{id, name}] — used to map a free-text "ministry"
    // column value to an existing ministry, per spec §21. An unmatched
    // name is a warning (row still imports), never a hard error and
    // never a silently-created new ministry.
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

      let ministryId = null;
      const ministryRaw = (raw.ministry ?? "").trim();
      if (ministryRaw) {
        const match = (ctx.ministries ?? []).find((m) => m.name.toLowerCase() === ministryRaw.toLowerCase());
        if (match) ministryId = match.id;
        else warnings.push(`Ministry "${ministryRaw}" not found — member will still be imported, just without that ministry link.`);
      }

      if (errors.length) return { ok: false, errors };
      return {
        ok: true,
        errors: [],
        warnings,
        row: {
          name, gender, contact, residence: (raw.residence ?? "").trim() || null,
          preferred_assembly: assembly, status,
          date_of_birth: (raw.date_of_birth ?? "").trim() || null,
          date_joined: (raw.date_joined ?? "").trim() || undefined, // undefined -> DB default (today)
          visiting_from: (raw.visiting_from ?? "").trim() || null,
          ministryId,
        },
        duplicateValue: contact,
      };
    },
  },
};
