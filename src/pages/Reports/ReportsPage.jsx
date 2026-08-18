import React, { useState } from "react";
import { Icon } from "../../components/Icon.jsx";
import { Modal } from "../../components/Modal.jsx";
import { ScrollX } from "../../components/ScrollX.jsx";
import { useAuth } from "../../lib/auth.jsx";
import { accessLevel } from "../../lib/rbac.js";
import { formatGHS } from "../../lib/finance.js";
import { useMemberStats } from "../../hooks/useMembers.js";
import { useLastServiceAttendance } from "../../hooks/useAttendance.js";
import { useCurrentMonthGiving } from "../../hooks/useFinance.js";
import { useSmsBatches } from "../../hooks/useMessages.js";
import { useComparativeStats, useCreateComparativeStat, useDeleteComparativeStat } from "../../hooks/useReports.js";

// Mostly a dashboard over data that already exists — each source hook is
// already correctly scoped by its own table's RLS (a Ministry Leader's
// useMemberStats() call, for instance, only ever counts members RLS lets
// them see), so sections here are gated on whether the role has *any*
// access to that underlying module, not re-implemented per-role logic.
export function ReportsPage() {
  const { role } = useAuth();
  const access = accessLevel(role, "reports"); // "full" | "own" | "log" (route already blocks null)
  const canEditStats = access === "full";

  const showMembersAttendance = Boolean(accessLevel(role, "members")) || Boolean(accessLevel(role, "attendance"));
  const showFinance = Boolean(accessLevel(role, "finance"));
  const showMessaging = Boolean(accessLevel(role, "messages"));

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Reports</div>
          <h1>Cross-module reports</h1>
          <p>A summary view drawn from Members, Attendance, Finance, and Messaging — scoped to what your role can see.</p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {showMembersAttendance && <MembersAttendanceSummary />}
        {showFinance && <FinanceSummary />}
        {showMessaging && <MessagingSummary />}
        <ComparativeStatsSection canEdit={canEditStats} />
      </div>
    </div>
  );
}

function MembersAttendanceSummary() {
  const { data: memberStats, isLoading: membersLoading } = useMemberStats();
  const { data: lastService, isLoading: attendanceLoading } = useLastServiceAttendance();

  return (
    <div className="glass card">
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Members & attendance</h3>
      <div className="grid cols-2" style={{ gap: 14 }}>
        <div>
          <div className="muted" style={{ fontSize: 12.5 }}>Total members</div>
          <div style={{ fontSize: 28, fontFamily: "var(--font-display)" }}>{membersLoading ? "—" : memberStats?.total ?? 0}</div>
          <div className="muted" style={{ fontSize: 12 }}>+{membersLoading ? "…" : memberStats?.newThisMonth ?? 0} this month</div>
        </div>
        <div>
          <div className="muted" style={{ fontSize: 12.5 }}>Last service attendance</div>
          <div style={{ fontSize: 28, fontFamily: "var(--font-display)" }}>{attendanceLoading ? "—" : lastService?.count ?? "—"}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {lastService?.delta == null ? "First recorded service" : `${lastService.delta >= 0 ? "+" : ""}${lastService.delta} vs previous`}
          </div>
        </div>
      </div>
    </div>
  );
}

function FinanceSummary() {
  const { data: giving, isLoading } = useCurrentMonthGiving();
  return (
    <div className="glass card">
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Finance</h3>
      <div className="muted" style={{ fontSize: 12.5 }}>This month's giving (tithes + missions offering)</div>
      <div style={{ fontSize: 28, fontFamily: "var(--font-display)", marginTop: 4 }}>{isLoading ? "—" : formatGHS(giving?.total)}</div>
      {!isLoading && !giving?.hasData && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>No figures entered yet this month.</div>}
    </div>
  );
}

function MessagingSummary() {
  const { data: batches, isLoading } = useSmsBatches();
  const totalSent = (batches ?? []).filter((b) => b.status === "sent" || b.status === "partially_failed").length;
  const totalRecipients = (batches ?? []).reduce((sum, b) => sum + (b.recipient_count ?? 0), 0);

  return (
    <div className="glass card">
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Messaging</h3>
      <div className="grid cols-2" style={{ gap: 14 }}>
        <div>
          <div className="muted" style={{ fontSize: 12.5 }}>Messages sent</div>
          <div style={{ fontSize: 28, fontFamily: "var(--font-display)" }}>{isLoading ? "—" : totalSent}</div>
        </div>
        <div>
          <div className="muted" style={{ fontSize: 12.5 }}>Total recipients reached</div>
          <div style={{ fontSize: 28, fontFamily: "var(--font-display)" }}>{isLoading ? "—" : totalRecipients}</div>
        </div>
      </div>
    </div>
  );
}

function ComparativeStatsSection({ canEdit }) {
  const { data: stats, isLoading, isError, error } = useComparativeStats();
  const deleteStat = useDeleteComparativeStat();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="glass card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="row between" style={{ padding: "16px 18px" }}>
        <div>
          <h3 style={{ fontSize: 16 }}>Comparative statistics</h3>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
            Minimal placeholder shape — will expand once the workbook's actual columns are shared.
          </p>
        </div>
        {canEdit && <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Icon name="plus" size={15} /> Add figure</button>}
      </div>
      {isError && <div className="badge badge-red" style={{ display: "block", margin: "0 18px 14px", padding: "8px 12px" }}>Couldn't load: {error.message}</div>}
      <ScrollX>
        <table className="table">
          <thead><tr><th>Label</th><th>Period</th><th>Prior</th><th>Current</th><th>Change</th><th></th></tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="muted" style={{ padding: 20, textAlign: "center" }}>Loading…</td></tr>}
            {!isLoading && (stats ?? []).length === 0 && (
              <tr><td colSpan={6} className="muted" style={{ padding: 20, textAlign: "center" }}>No comparative figures entered yet.</td></tr>
            )}
            {(stats ?? []).map((s) => {
              const prior = Number(s.prior_value ?? 0);
              const current = Number(s.current_value ?? 0);
              const change = prior === 0 ? null : Math.round(((current - prior) / prior) * 1000) / 10;
              return (
                <tr key={s.id}>
                  <td style={{ fontWeight: 500 }}>{s.label}</td>
                  <td className="muted">{s.period}</td>
                  <td>{s.prior_value ?? "—"}</td>
                  <td>{s.current_value ?? "—"}</td>
                  <td>
                    {change == null ? "—" : (
                      <span className={"badge " + (change >= 0 ? "badge-green" : "badge-red")}>
                        <Icon name={change >= 0 ? "arrowUp" : "arrowDown"} size={11} stroke={2.4} /> {Math.abs(change)}%
                      </span>
                    )}
                  </td>
                  <td>
                    {canEdit && <button className="btn btn-icon btn-ghost" onClick={() => { if (confirm("Delete this figure?")) deleteStat.mutate(s.id); }}><Icon name="trash" size={14} /></button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollX>
      {showAdd && <ComparativeStatFormModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function ComparativeStatFormModal({ onClose }) {
  const [label, setLabel] = useState("");
  const [period, setPeriod] = useState("");
  const [priorValue, setPriorValue] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [error, setError] = useState(null);
  const createStat = useCreateComparativeStat();

  const onSave = async () => {
    if (!label.trim()) return setError("Label is required.");
    if (!period.trim()) return setError("Period is required.");
    try {
      await createStat.mutateAsync({
        label: label.trim(), period: period.trim(),
        prior_value: priorValue === "" ? null : Number(priorValue),
        current_value: currentValue === "" ? null : Number(currentValue),
      });
      onClose();
    } catch (err) {
      setError(err.message || "Couldn't save this figure.");
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="glass modal-card" style={{ maxWidth: 420, padding: 26 }} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500 }}>Add comparative figure</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="field"><label>Label</label><input className="input" placeholder="e.g. Sunday attendance" value={label} onChange={(e) => setLabel(e.target.value)} /></div>
          <div className="field"><label>Period</label><input className="input" placeholder="e.g. Q1 2026 vs Q1 2025" value={period} onChange={(e) => setPeriod(e.target.value)} /></div>
          <div className="grid cols-2" style={{ gap: 12 }}>
            <div className="field"><label>Prior value</label><input type="number" step="0.01" className="input" value={priorValue} onChange={(e) => setPriorValue(e.target.value)} /></div>
            <div className="field"><label>Current value</label><input type="number" step="0.01" className="input" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} /></div>
          </div>
        </div>
        {error && <div className="badge badge-red" style={{ display: "block", marginTop: 14, padding: "8px 12px" }}>{error}</div>}
        <div className="row" style={{ gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave} disabled={createStat.isPending}>Save</button>
        </div>
      </div>
    </Modal>
  );
}
