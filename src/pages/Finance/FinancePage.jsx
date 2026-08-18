import React, { useEffect, useState } from "react";
import { Icon } from "../../components/Icon.jsx";
import { Modal } from "../../components/Modal.jsx";
import { ScrollX } from "../../components/ScrollX.jsx";
import { useAuth } from "../../lib/auth.jsx";
import { accessLevel } from "../../lib/rbac.js";
import { formatGHS, computeVariance, sumByAssembly, ASSEMBLIES, MONTH_NAMES } from "../../lib/finance.js";
import {
  useTithesYear, useUpsertTithesMonth,
  useMissionsYear, useUpsertMissionsMonth,
  useDesignatedFunds, useCreateDesignatedFund, useUpdateDesignatedFund, useDeleteDesignatedFund,
  useDistrictAccounts, useCreateDistrictAccount, useDeleteDistrictAccount,
} from "../../hooks/useFinance.js";

const TABS = [
  { key: "tithes", label: "Tithes" },
  { key: "missions", label: "Missions Offering" },
  { key: "designated", label: "Designated Funds" },
  { key: "district", label: "District Accounts" },
];

export function FinancePage() {
  const { role } = useAuth();
  const access = accessLevel(role, "finance"); // "full" | "view" | null (route already blocks null)
  const canEdit = access === "full";
  const [tab, setTab] = useState("tithes");

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Finance</div>
          <h1>Tithes, offerings & designated funds</h1>
          <p>{canEdit ? "Enter and review budget vs. actual figures." : "View-only — Finance role can edit these figures."}</p>
        </div>
      </div>

      <ScrollX style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 6, width: "max-content" }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              className={"btn" + (tab === t.key ? " btn-primary" : " btn-ghost")}
              onClick={() => setTab(t.key)}
              style={{ flexShrink: 0 }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </ScrollX>

      {tab === "tithes" && (
        <MonthlyPerformanceSection
          title="Net tithes performance"
          useYearData={useTithesYear}
          useUpsert={useUpsertTithesMonth}
          canEdit={canEdit}
        />
      )}
      {tab === "missions" && (
        <MonthlyPerformanceSection
          title="Missions offering performance"
          useYearData={useMissionsYear}
          useUpsert={useUpsertMissionsMonth}
          canEdit={canEdit}
        />
      )}
      {tab === "designated" && <DesignatedFundsSection canEdit={canEdit} />}
      {tab === "district" && <DistrictAccountsSection canEdit={canEdit} />}
    </div>
  );
}

// ============== Tithes / Missions Offering (identical shape) ==============

function MonthlyPerformanceSection({ title, useYearData, useUpsert, canEdit }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [assembly, setAssembly] = useState("English");
  const { data, isLoading, isError, error } = useYearData(year); // both assemblies, 24 rows
  const upsert = useUpsert();

  // Merge the selected assembly's fetched rows onto a full Jan-Dec
  // skeleton so months with no entry yet still render as an editable
  // (empty) row instead of just vanishing from the table.
  const assemblyRows = (data ?? []).filter((r) => r.assembly === assembly);
  const byMonth = new Map(assemblyRows.map((r) => [r.month, r]));
  const rows = MONTH_NAMES.map((name, i) => {
    const month = i + 1;
    const existing = byMonth.get(month);
    return { month, name, budget_ghs: existing?.budget_ghs ?? 0, actual_ghs: existing?.actual_ghs ?? 0 };
  });

  const totals = rows.reduce((acc, r) => ({ budget: acc.budget + Number(r.budget_ghs), actual: acc.actual + Number(r.actual_ghs) }), { budget: 0, actual: 0 });
  const totalVariance = computeVariance(totals.actual, totals.budget);
  const summary = sumByAssembly(data);

  const onCommit = (month, patch) => {
    const row = rows.find((r) => r.month === month);
    upsert.mutate({ year, month, assembly, budget_ghs: row.budget_ghs, actual_ghs: row.actual_ghs, ...patch });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="glass card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="row between" style={{ padding: "16px 18px" }}>
          <h3 style={{ fontSize: 16 }}>{title}</h3>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-icon btn-ghost" onClick={() => setYear((y) => y - 1)}>
              <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}><Icon name="chevron" size={14} stroke={2} /></span>
            </button>
            <span className="badge">{year}</span>
            <button className="btn btn-icon btn-ghost" onClick={() => setYear((y) => y + 1)}><Icon name="chevron" size={14} stroke={2} /></button>
          </div>
        </div>
        <div className="row" style={{ gap: 6, padding: "0 18px 14px" }}>
          {ASSEMBLIES.map((a) => (
            <button key={a} className={"btn" + (assembly === a ? " btn-primary" : " btn-ghost")} onClick={() => setAssembly(a)}>
              {a} Service
            </button>
          ))}
        </div>
        {isError && (
          <div className="badge badge-red" style={{ display: "block", margin: "0 18px 14px", padding: "8px 12px" }}>
            Couldn't load figures: {error.message}
          </div>
        )}
        {upsert.isError && (
          <div className="badge badge-red" style={{ display: "block", margin: "0 18px 14px", padding: "8px 12px" }}>
            Couldn't save: {upsert.error.message}
          </div>
        )}
        <ScrollX>
        <table className="table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Budget (GHS)</th>
              <th>Actual (GHS)</th>
              <th>Variance</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={4} className="muted" style={{ padding: 20, textAlign: "center" }}>Loading…</td></tr>}
            {!isLoading && rows.map((r) => {
              const v = computeVariance(r.actual_ghs, r.budget_ghs);
              return (
                <tr key={r.month}>
                  <td>{r.name}</td>
                  <td>
                    {canEdit ? (
                      <EditableAmount value={r.budget_ghs} onCommit={(val) => onCommit(r.month, { budget_ghs: val })} />
                    ) : formatGHS(r.budget_ghs)}
                  </td>
                  <td>
                    {canEdit ? (
                      <EditableAmount value={r.actual_ghs} onCommit={(val) => onCommit(r.month, { actual_ghs: val })} />
                    ) : formatGHS(r.actual_ghs)}
                  </td>
                  <td>
                    <VarianceBadge amount={v.amount} percent={v.percent} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          {!isLoading && (
            <tfoot>
              <tr style={{ fontWeight: 600 }}>
                <td>{assembly} total</td>
                <td>{formatGHS(totals.budget)}</td>
                <td>{formatGHS(totals.actual)}</td>
                <td><VarianceBadge amount={totalVariance.amount} percent={totalVariance.percent} /></td>
              </tr>
            </tfoot>
          )}
        </table>
        </ScrollX>
      </div>

      <LocalAssembliesSummary summary={summary} />
      <VarianceAnalysisSummary summary={summary} />
    </div>
  );
}

// "Local Assemblies" — English/Twi/Total budget vs. actual for the whole
// selected year, derived from the same 24-row dataset as the monthly
// table above rather than entered separately, so the two can never drift
// apart.
function LocalAssembliesSummary({ summary }) {
  const rows = [
    { no: 1, label: "English Assembly", ...summary.byAssembly.English },
    { no: 2, label: "Twi Assembly", ...summary.byAssembly.Twi },
  ];
  return (
    <div className="glass card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "16px 18px" }}><h3 style={{ fontSize: 16 }}>Local assemblies</h3></div>
      <ScrollX>
      <table className="table">
        <thead><tr><th>S/No</th><th>Local</th><th>Budget (GHS)</th><th>Actual (GHS)</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="muted">{r.no}</td>
              <td style={{ fontWeight: 500 }}>{r.label}</td>
              <td>{formatGHS(r.budget)}</td>
              <td>{formatGHS(r.actual)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 600 }}>
            <td></td>
            <td>Total</td>
            <td>{formatGHS(summary.total.budget)}</td>
            <td>{formatGHS(summary.total.actual)}</td>
          </tr>
        </tfoot>
      </table>
      </ScrollX>
    </div>
  );
}

function VarianceAnalysisSummary({ summary }) {
  const rows = [
    { no: 1, label: "English Assembly", ...summary.byAssembly.English },
    { no: 2, label: "Twi Assembly", ...summary.byAssembly.Twi },
  ];
  return (
    <div className="glass card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "16px 18px" }}><h3 style={{ fontSize: 16 }}>Variance analysis</h3></div>
      <ScrollX>
      <table className="table">
        <thead><tr><th>S/No</th><th>Local</th><th>Variance</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const v = computeVariance(r.actual, r.budget);
            return (
              <tr key={r.label}>
                <td className="muted">{r.no}</td>
                <td style={{ fontWeight: 500 }}>{r.label}</td>
                <td><VarianceBadge amount={v.amount} percent={v.percent} /></td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          {(() => {
            const v = computeVariance(summary.total.actual, summary.total.budget);
            return (
              <tr style={{ fontWeight: 600 }}>
                <td></td>
                <td>Total</td>
                <td><VarianceBadge amount={v.amount} percent={v.percent} /></td>
              </tr>
            );
          })()}
        </tfoot>
      </table>
      </ScrollX>
    </div>
  );
}

function EditableAmount({ value, onCommit }) {
  const [local, setLocal] = useState(String(value ?? 0));
  useEffect(() => setLocal(String(value ?? 0)), [value]);

  return (
    <input
      type="number"
      step="0.01"
      className="input"
      style={{ height: 32, width: 130 }}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const num = Number(local);
        if (!Number.isNaN(num) && num !== value) onCommit(num);
      }}
    />
  );
}

function VarianceBadge({ amount, percent }) {
  if (amount === 0 && percent === 0) return <span className="badge">On budget</span>;
  const up = amount >= 0;
  return (
    <span className={"badge " + (up ? "badge-green" : "badge-red")}>
      <Icon name={up ? "arrowUp" : "arrowDown"} size={11} stroke={2.4} />
      {formatGHS(Math.abs(amount))} {percent != null && `(${Math.abs(percent)}%)`}
    </span>
  );
}

// ============== Designated funds ==============

function DesignatedFundsSection({ canEdit }) {
  const { data: funds, isLoading, isError, error } = useDesignatedFunds();
  const deleteFund = useDeleteDesignatedFund();
  const [showAdd, setShowAdd] = useState(false);
  const [editingFund, setEditingFund] = useState(null);

  return (
    <>
    <div className="glass card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="row between" style={{ padding: "16px 18px" }}>
        <h3 style={{ fontSize: 16 }}>Designated funds</h3>
        {canEdit && <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Icon name="plus" size={15} /> Add fund</button>}
      </div>
      {isError && (
        <div className="badge badge-red" style={{ display: "block", margin: "0 18px 14px", padding: "8px 12px" }}>
          Couldn't load designated funds: {error.message}
        </div>
      )}
      <ScrollX>
      <table className="table">
        <thead>
          <tr>
            <th>Fund</th>
            <th>Date Held</th>
            <th>Prior year actual</th>
            <th>Budget (this year)</th>
            <th>Actual (this year)</th>
            <th>Variance</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {isLoading && <tr><td colSpan={7} className="muted" style={{ padding: 20, textAlign: "center" }}>Loading…</td></tr>}
          {!isLoading && (funds ?? []).length === 0 && (
            <tr><td colSpan={7} className="muted" style={{ padding: 20, textAlign: "center" }}>No designated funds yet.</td></tr>
          )}
          {(funds ?? []).map((f) => (
            <tr key={f.id}>
              <td style={{ fontWeight: 500 }}>{f.fund_name}</td>
              <td className="muted">{f.district || "—"}</td>
              <td>{formatGHS(f.actual_prior_year_ghs)}</td>
              <td>{formatGHS(f.budget_current_year_ghs)}</td>
              <td>{formatGHS(f.actual_current_year_ghs)}</td>
              <td><VarianceBadge amount={Number(f.variance_amount_ghs)} percent={f.variance_percent == null ? null : Number(f.variance_percent)} /></td>
              <td>
                {canEdit && (
                  <div className="row" style={{ gap: 4 }}>
                    <button className="btn btn-icon btn-ghost" onClick={() => setEditingFund(f)}><Icon name="edit" size={14} /></button>
                    <button
                      className="btn btn-icon btn-ghost"
                      onClick={() => { if (confirm(`Delete "${f.fund_name}"?`)) deleteFund.mutate(f.id); }}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </ScrollX>

    </div>
      {(showAdd || editingFund) && (
        <DesignatedFundModal fund={editingFund} onClose={() => { setShowAdd(false); setEditingFund(null); }} />
      )}
    </>
  );
}

function DesignatedFundModal({ fund, onClose }) {
  const [form, setForm] = useState({
    fund_name: fund?.fund_name ?? "",
    district: fund?.district ?? "",
    actual_prior_year_ghs: fund?.actual_prior_year_ghs ?? 0,
    budget_current_year_ghs: fund?.budget_current_year_ghs ?? 0,
    actual_current_year_ghs: fund?.actual_current_year_ghs ?? 0,
  });
  const [error, setError] = useState(null);
  const create = useCreateDesignatedFund();
  const update = useUpdateDesignatedFund();
  const saving = create.isPending || update.isPending;

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const onSave = async () => {
    if (!form.fund_name.trim()) return setError("Fund name is required.");
    try {
      if (fund) await update.mutateAsync({ id: fund.id, ...form });
      else await create.mutateAsync(form);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="glass modal-card" style={{ maxWidth: 460, padding: 26 }} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500 }}>{fund ? "Edit fund" : "Add fund"}</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="field"><label>Fund name</label><input className="input" value={form.fund_name} onChange={(e) => set({ fund_name: e.target.value })} /></div>
          <div className="field"><label>District</label><input className="input" value={form.district} onChange={(e) => set({ district: e.target.value })} /></div>
          <div className="field"><label>Prior year actual (GHS)</label><input type="number" step="0.01" className="input" value={form.actual_prior_year_ghs} onChange={(e) => set({ actual_prior_year_ghs: Number(e.target.value) })} /></div>
          <div className="grid cols-2" style={{ gap: 12 }}>
            <div className="field"><label>Budget this year (GHS)</label><input type="number" step="0.01" className="input" value={form.budget_current_year_ghs} onChange={(e) => set({ budget_current_year_ghs: Number(e.target.value) })} /></div>
            <div className="field"><label>Actual this year (GHS)</label><input type="number" step="0.01" className="input" value={form.actual_current_year_ghs} onChange={(e) => set({ actual_current_year_ghs: Number(e.target.value) })} /></div>
          </div>
        </div>
        {error && <div className="badge badge-red" style={{ display: "block", marginTop: 14, padding: "8px 12px" }}>{error}</div>}
        <div className="row" style={{ gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave} disabled={saving}>Save</button>
        </div>
      </div>
    </Modal>
  );
}

// ============== District accounts (placeholder shape) ==============

function DistrictAccountsSection({ canEdit }) {
  const { data: entries, isLoading, isError, error } = useDistrictAccounts();
  const deleteEntry = useDeleteDistrictAccount();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <>
    <div className="glass card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="row between" style={{ padding: "16px 18px" }}>
        <div>
          <h3 style={{ fontSize: 16 }}>District accounts</h3>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
            Minimal placeholder shape — will expand once the workbook's actual columns are shared.
          </p>
        </div>
        {canEdit && <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Icon name="plus" size={15} /> Add entry</button>}
      </div>
      {isError && (
        <div className="badge badge-red" style={{ display: "block", margin: "0 18px 14px", padding: "8px 12px" }}>
          Couldn't load district accounts: {error.message}
        </div>
      )}
      <ScrollX>
      <table className="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>District</th>
            <th>Amount (GHS)</th>
            <th>Notes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {isLoading && <tr><td colSpan={5} className="muted" style={{ padding: 20, textAlign: "center" }}>Loading…</td></tr>}
          {!isLoading && (entries ?? []).length === 0 && (
            <tr><td colSpan={5} className="muted" style={{ padding: 20, textAlign: "center" }}>No entries yet.</td></tr>
          )}
          {(entries ?? []).map((e) => (
            <tr key={e.id}>
              <td className="muted">{new Date(e.entry_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
              <td>{e.district || "—"}</td>
              <td>{formatGHS(e.amount_ghs)}</td>
              <td className="muted" style={{ fontSize: 13 }}>{e.notes || "—"}</td>
              <td>
                {canEdit && (
                  <button className="btn btn-icon btn-ghost" onClick={() => { if (confirm("Delete this entry?")) deleteEntry.mutate(e.id); }}>
                    <Icon name="trash" size={14} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </ScrollX>

    </div>
      {showAdd && <DistrictAccountModal onClose={() => setShowAdd(false)} />}
    </>
  );
}

function DistrictAccountModal({ onClose }) {
  const [form, setForm] = useState({ district: "", entry_date: new Date().toISOString().slice(0, 10), amount_ghs: 0, notes: "" });
  const [error, setError] = useState(null);
  const create = useCreateDistrictAccount();

  const onSave = async () => {
    if (!form.district.trim()) return setError("District is required.");
    try {
      await create.mutateAsync(form);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="glass modal-card" style={{ maxWidth: 420, padding: 26 }} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500 }}>Add district account entry</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="field"><label>District</label><input className="input" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} /></div>
          <div className="field"><label>Date</label><input type="date" className="input" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} /></div>
          <div className="field"><label>Amount (GHS)</label><input type="number" step="0.01" className="input" value={form.amount_ghs} onChange={(e) => setForm({ ...form, amount_ghs: Number(e.target.value) })} /></div>
          <div className="field"><label>Notes <span className="faint">(optional)</span></label><input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        {error && <div className="badge badge-red" style={{ display: "block", marginTop: 14, padding: "8px 12px" }}>{error}</div>}
        <div className="row" style={{ gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave} disabled={create.isPending}>Save</button>
        </div>
      </div>
    </Modal>
  );
}
