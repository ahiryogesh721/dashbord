"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { INTEREST_LABELS, LEAD_STAGES } from "@/lib/domain";

import styles from "./page.module.css";

type FounderMetrics = {
  totalLeads: number;
  avgScore: number;
  conversionRate: number;
  stageBreakdown: Record<string, number>;
  interestBreakdown: Record<string, number>;
  visits: {
    scheduled: number;
    completed: number;
  };
  followUpsDueToday: number;
};

type Lead = {
  id: string;
  createdAt: string;
  customerName: string | null;
  phone: string | null;
  score: number | null;
  interestLabel: string | null;
  stage: string;
  source: string;
  assignedTo: string | null;
  salesRep: {
    name: string;
    email: string | null;
  } | null;
};

type LeadListData = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  leads: Lead[];
};

type SortField = "createdAt" | "score" | "customerName";

type ManualLeadFormState = {
  customer_name: string;
  countryCode: string;
  phone: string;
  source: string;
  goal: string;
  preference: string;
  interest_label: string;
};

type ManualLeadFieldErrors = Partial<Record<keyof ManualLeadFormState, string>>;

const PAGE_SIZE = 25;

const INITIAL_FORM: ManualLeadFormState = {
  customer_name: "",
  countryCode: "+91",
  phone: "",
  source: "manual",
  goal: "",
  preference: "",
  interest_label: "",
};

const COUNTRY_OPTIONS = [
  { flag: "🇮🇳", name: "India", dialCode: "+91" },
  { flag: "🇺🇸", name: "United States", dialCode: "+1" },
  { flag: "🇬🇧", name: "United Kingdom", dialCode: "+44" },
  { flag: "🇦🇪", name: "UAE", dialCode: "+971" },
  { flag: "🇸🇬", name: "Singapore", dialCode: "+65" },
  { flag: "🇦🇺", name: "Australia", dialCode: "+61" },
] as const;

export default function DashbordPage() {
  const [metrics, setMetrics] = useState<FounderMetrics | null>(null);
  const [leadData, setLeadData] = useState<LeadListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);

  const [stageFilter, setStageFilter] = useState<string>("");
  const [interestFilter, setInterestFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [refreshTick, setRefreshTick] = useState(0);

  const [showManualForm, setShowManualForm] = useState(false);
  const [manualLeadForm, setManualLeadForm] = useState<ManualLeadFormState>(INITIAL_FORM);
  const [manualLeadFieldErrors, setManualLeadFieldErrors] = useState<ManualLeadFieldErrors>({});
  const [manualLeadLoading, setManualLeadLoading] = useState(false);
  const [manualLeadError, setManualLeadError] = useState<string | null>(null);
  const [manualLeadSuccess, setManualLeadSuccess] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoading(true);
      setError(null);
      setDegraded(false);

      const query = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
      if (stageFilter) query.set("stage", stageFilter);
      if (interestFilter) query.set("interest_label", interestFilter);

      try {
        const [metricsRes, leadsRes] = await Promise.all([
          fetch("/api/dashboard/founder-metrics", { cache: "no-store" }),
          fetch(`/api/dashboard/leads?${query.toString()}`, { cache: "no-store" }),
        ]);

        if (!metricsRes.ok || !leadsRes.ok) {
          throw new Error("Unable to load dashboard data. Please verify server configuration.");
        }

        const metricsJson = (await metricsRes.json()) as { data: FounderMetrics; degraded?: boolean };
        const leadsJson = (await leadsRes.json()) as { data: LeadListData; degraded?: boolean };

        if (!mounted) return;
        setMetrics(metricsJson.data);
        setLeadData(leadsJson.data);
        setDegraded(Boolean(metricsJson.degraded || leadsJson.degraded));
      } catch (loadErr) {
        if (!mounted) return;
        setError(loadErr instanceof Error ? loadErr.message : "Unknown error");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadData();
    return () => {
      mounted = false;
    };
  }, [page, stageFilter, interestFilter, refreshTick]);

  const stageBreakdownEntries = useMemo(
    () =>
      LEAD_STAGES.map((stage) => ({
        stage,
        count: metrics?.stageBreakdown[stage] ?? 0,
      })),
    [metrics],
  );

  const topStageCount = useMemo(() => Math.max(1, ...stageBreakdownEntries.map((entry) => entry.count)), [stageBreakdownEntries]);

  const filteredLeads = useMemo(() => {
    const leads = leadData?.leads ?? [];
    const query = search.trim().toLowerCase();

    const searched = query
      ? leads.filter((lead) => {
          const repName = lead.salesRep?.name ?? "";
          return [lead.customerName ?? "", lead.phone ?? "", lead.source, repName].join(" ").toLowerCase().includes(query);
        })
      : leads;

    return [...searched].sort((a, b) => {
      if (sortField === "score") {
        const left = a.score ?? -1;
        const right = b.score ?? -1;
        return sortDir === "asc" ? left - right : right - left;
      }

      if (sortField === "customerName") {
        const left = (a.customerName ?? "").toLowerCase();
        const right = (b.customerName ?? "").toLowerCase();
        return sortDir === "asc" ? left.localeCompare(right) : right.localeCompare(left);
      }

      const left = new Date(a.createdAt).getTime();
      const right = new Date(b.createdAt).getTime();
      return sortDir === "asc" ? left - right : right - left;
    });
  }, [leadData?.leads, search, sortField, sortDir]);

  const visibleAvgScore = useMemo(() => {
    const scores = filteredLeads.map((lead) => lead.score).filter((score): score is number => typeof score === "number");
    if (scores.length === 0) return "-";

    const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    return avg.toFixed(1);
  }, [filteredLeads]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDir(field === "customerName" ? "asc" : "desc");
  }

  function resetFilters() {
    setStageFilter("");
    setInterestFilter("");
    setSearch("");
    setPage(1);
  }

  function validateManualLeadForm(form: ManualLeadFormState): ManualLeadFieldErrors {
    const fieldErrors: ManualLeadFieldErrors = {};

    if (!form.customer_name.trim()) {
      fieldErrors.customer_name = "Name is required.";
    } else if (form.customer_name.trim().length < 2) {
      fieldErrors.customer_name = "Name should be at least 2 characters.";
    }

    const cleanedPhone = form.phone.replace(/\D/g, "");
    const dialCodeDigits = form.countryCode.replace(/\D/g, "");
    const fullNumberDigits = `${dialCodeDigits}${cleanedPhone}`;

    if (!cleanedPhone) {
      fieldErrors.phone = "Phone number is required.";
    } else if (!/^\d{6,14}$/.test(cleanedPhone)) {
      fieldErrors.phone = "Enter a valid phone number.";
    } else if (!/^\d{7,15}$/.test(fullNumberDigits)) {
      fieldErrors.phone = "Selected country code + phone must be between 7 and 15 digits.";
    }

    if (!form.source.trim()) {
      fieldErrors.source = "Source is required.";
    }

    if (!form.goal.trim()) {
      fieldErrors.goal = "Goal is required.";
    }

    if (!form.preference.trim()) {
      fieldErrors.preference = "Preference is required.";
    }

    if (!form.interest_label.trim()) {
      fieldErrors.interest_label = "Please select interest level.";
    }

    return fieldErrors;
  }

  async function handleManualLeadSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setManualLeadLoading(true);
    setManualLeadError(null);
    setManualLeadSuccess(null);

    const fieldErrors = validateManualLeadForm(manualLeadForm);
    setManualLeadFieldErrors(fieldErrors);

    if (Object.keys(fieldErrors).length > 0) {
      setManualLeadLoading(false);
      setManualLeadError("Please fix highlighted fields before submitting.");
      return;
    }

    try {
      const response = await fetch("/api/leads/manual", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          customer_name: manualLeadForm.customer_name.trim(),
          phone: `${manualLeadForm.countryCode}${manualLeadForm.phone.replace(/\D/g, "")}`,
          source: manualLeadForm.source.trim(),
          goal: manualLeadForm.goal.trim(),
          preference: manualLeadForm.preference.trim(),
          interest_label: manualLeadForm.interest_label,
        }),
      });

      const json = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !json.ok) {
        throw new Error(json.error ?? "Unable to add manual lead");
      }

      setManualLeadSuccess("Lead created successfully.");
      setManualLeadFieldErrors({});
      setManualLeadForm(INITIAL_FORM);
      setShowManualForm(false);
      setPage(1);
      setRefreshTick((value) => value + 1);
    } catch (submitError) {
      setManualLeadError(submitError instanceof Error ? submitError.message : "Unable to create lead");
    } finally {
      setManualLeadLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroBackdrop} />
        <div className={styles.heroTopRow}>
          <div>
            <p className={styles.eyebrow}>Sales Command Center</p>
            <h1>Real-time Lead Intelligence Dashboard</h1>
            <p className={styles.heroSubtext}>
              A cleaner, faster dashboard with live pipeline visibility, smart filtering, action-first workflows, and instant
              manual lead capture.
            </p>
          </div>
          <div className={styles.heroActions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => {
                setPage(1);
                setRefreshTick((value) => value + 1);
              }}
            >
              Refresh Data
            </button>
            <button type="button" className={styles.ghostButton} onClick={resetFilters}>
              Reset
            </button>
          </div>
        </div>

        <div className={styles.kpiGrid}>
          <KpiCard label="Total Leads" value={metrics?.totalLeads ?? 0} subtitle="All captured leads" />
          <KpiCard label="Avg Lead Score" value={metrics?.avgScore ?? "—"} subtitle="Quality across funnel" />
          <KpiCard label="Conversion Rate" value={`${metrics?.conversionRate ?? 0}%`} subtitle="Closed / total" />
          <KpiCard label="Follow-ups Today" value={metrics?.followUpsDueToday ?? 0} subtitle="Pending callbacks" />
          <KpiCard label="Visible Leads" value={filteredLeads.length} subtitle="After search/filter" />
          <KpiCard label="Visible Avg Score" value={visibleAvgScore} subtitle="Current table view" />
        </div>
      </section>

      {degraded && (
        <section className={styles.noticeCard}>
          <strong>Limited data mode:</strong> Some backend metrics are temporarily unavailable, so fallback values are shown.
        </section>
      )}

      <section className={styles.controlRow}>
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Lead Intake</h2>
            <button
              type="button"
              className={styles.ghostButton}
              onClick={() => {
                setShowManualForm((prev) => !prev);
                setManualLeadError(null);
                setManualLeadSuccess(null);
              }}
              aria-expanded={showManualForm}
            >
              {showManualForm ? "Hide Form" : "Add Lead"}
            </button>
          </div>

          {showManualForm && (
            <form className={styles.manualLeadForm} onSubmit={handleManualLeadSubmit} noValidate>
              <label>
                Name
                <input
                  value={manualLeadForm.customer_name}
                  onChange={(event) => setManualLeadForm((state) => ({ ...state, customer_name: event.target.value }))}
                  placeholder="Lead full name"
                  className={manualLeadFieldErrors.customer_name ? styles.inputError : ""}
                />
                {manualLeadFieldErrors.customer_name && <span className={styles.fieldError}>{manualLeadFieldErrors.customer_name}</span>}
              </label>

              <label>
                Phone
                <div className={styles.phoneInputRow}>
                  <select
                    value={manualLeadForm.countryCode}
                    onChange={(event) => setManualLeadForm((state) => ({ ...state, countryCode: event.target.value }))}
                    className={manualLeadFieldErrors.phone ? styles.inputError : ""}
                    aria-label="Country code"
                  >
                    {COUNTRY_OPTIONS.map((country) => (
                      <option key={country.dialCode} value={country.dialCode}>
                        {country.flag} {country.name} ({country.dialCode})
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={manualLeadForm.phone}
                    onChange={(event) =>
                      setManualLeadForm((state) => ({ ...state, phone: event.target.value.replace(/[^0-9]/g, "") }))
                    }
                    placeholder="Phone number"
                    className={manualLeadFieldErrors.phone ? styles.inputError : ""}
                  />
                </div>
                {manualLeadFieldErrors.phone && <span className={styles.fieldError}>{manualLeadFieldErrors.phone}</span>}
              </label>

              <label>
                Source
                <input
                  value={manualLeadForm.source}
                  onChange={(event) => setManualLeadForm((state) => ({ ...state, source: event.target.value }))}
                  placeholder="manual / website / meta_ads"
                  className={manualLeadFieldErrors.source ? styles.inputError : ""}
                />
                {manualLeadFieldErrors.source && <span className={styles.fieldError}>{manualLeadFieldErrors.source}</span>}
              </label>

              <label>
                Goal
                <input
                  value={manualLeadForm.goal}
                  onChange={(event) => setManualLeadForm((state) => ({ ...state, goal: event.target.value }))}
                  placeholder="Need 3BHK in Gurugram"
                  className={manualLeadFieldErrors.goal ? styles.inputError : ""}
                />
                {manualLeadFieldErrors.goal && <span className={styles.fieldError}>{manualLeadFieldErrors.goal}</span>}
              </label>

              <label>
                Preference
                <input
                  value={manualLeadForm.preference}
                  onChange={(event) => setManualLeadForm((state) => ({ ...state, preference: event.target.value }))}
                  placeholder="Budget / location / timeline"
                  className={manualLeadFieldErrors.preference ? styles.inputError : ""}
                />
                {manualLeadFieldErrors.preference && <span className={styles.fieldError}>{manualLeadFieldErrors.preference}</span>}
              </label>

              <label>
                Interest
                <select
                  value={manualLeadForm.interest_label}
                  onChange={(event) => setManualLeadForm((state) => ({ ...state, interest_label: event.target.value }))}
                  className={manualLeadFieldErrors.interest_label ? styles.inputError : ""}
                >
                  <option value="">Select interest</option>
                  {INTEREST_LABELS.map((interest) => (
                    <option key={interest} value={interest}>
                      {formatLabel(interest)}
                    </option>
                  ))}
                </select>
                {manualLeadFieldErrors.interest_label && <span className={styles.fieldError}>{manualLeadFieldErrors.interest_label}</span>}
              </label>

              <button type="submit" className={styles.primaryButton} disabled={manualLeadLoading}>
                {manualLeadLoading ? "Adding Lead..." : "Create Lead"}
              </button>
            </form>
          )}

          {manualLeadError && <p className={styles.error}>{manualLeadError}</p>}
          {manualLeadSuccess && <p className={styles.success}>{manualLeadSuccess}</p>}
        </article>

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Live Filters</h2>
          </div>
          <div className={styles.filterGrid}>
            <label>
              Stage
              <select
                value={stageFilter}
                onChange={(event) => {
                  setPage(1);
                  setStageFilter(event.target.value);
                }}
              >
                <option value="">All stages</option>
                {LEAD_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {formatLabel(stage)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Interest
              <select
                value={interestFilter}
                onChange={(event) => {
                  setPage(1);
                  setInterestFilter(event.target.value);
                }}
              >
                <option value="">All interest levels</option>
                {INTEREST_LABELS.map((interest) => (
                  <option key={interest} value={interest}>
                    {formatLabel(interest)}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.searchField}>
              Search
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, phone, source, rep"
              />
            </label>
          </div>
        </article>
      </section>

      {loading && <p className={styles.status}>Loading dashboard…</p>}
      {error && <p className={styles.error}>{error}</p>}

      {!loading && !error && (
        <>
          <section className={styles.analyticsGrid}>
            <article className={styles.card}>
              <div className={styles.cardHeader}>
                <h2>Pipeline Distribution</h2>
              </div>
              <ul className={styles.progressList}>
                {stageBreakdownEntries.map((entry) => {
                  const pct = Math.round((entry.count / topStageCount) * 100);

                  return (
                    <li key={entry.stage}>
                      <button
                        type="button"
                        className={styles.stageButton}
                        onClick={() => {
                          setStageFilter(entry.stage);
                          setPage(1);
                        }}
                      >
                        {formatLabel(entry.stage)}
                      </button>
                      <div className={styles.progressTrack}>
                        <span style={{ width: `${Math.max(4, pct)}%` }} />
                      </div>
                      <strong>{entry.count}</strong>
                    </li>
                  );
                })}
              </ul>
            </article>

            <article className={styles.card}>
              <div className={styles.cardHeader}>
                <h2>Interest Breakdown</h2>
              </div>
              <ul className={styles.compactList}>
                {INTEREST_LABELS.map((interest) => (
                  <li key={interest}>
                    <span>{formatLabel(interest)}</span>
                    <strong>{metrics?.interestBreakdown[interest] ?? 0}</strong>
                  </li>
                ))}
              </ul>
              <div className={styles.visitStats}>
                <p>
                  <span>Site Visits Scheduled</span>
                  <strong>{metrics?.visits.scheduled ?? 0}</strong>
                </p>
                <p>
                  <span>Site Visits Completed</span>
                  <strong>{metrics?.visits.completed ?? 0}</strong>
                </p>
              </div>
            </article>
          </section>

          <section className={styles.tableSection}>
            <div className={styles.cardHeader}>
              <h2>Lead Pipeline Table</h2>
              <div className={styles.sortButtons}>
                <button type="button" onClick={() => toggleSort("createdAt")}>
                  Date {sortField === "createdAt" ? `(${sortDir})` : ""}
                </button>
                <button type="button" onClick={() => toggleSort("score")}>
                  Score {sortField === "score" ? `(${sortDir})` : ""}
                </button>
                <button type="button" onClick={() => toggleSort("customerName")}>
                  Name {sortField === "customerName" ? `(${sortDir})` : ""}
                </button>
              </div>
            </div>

            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>Source</th>
                    <th>Stage</th>
                    <th>Interest</th>
                    <th>Score</th>
                    <th>Rep</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.length === 0 && (
                    <tr>
                      <td colSpan={8} className={styles.emptyRow}>
                        No leads found for current filters.
                      </td>
                    </tr>
                  )}
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id}>
                      <td>{lead.customerName ?? "Unknown"}</td>
                      <td>{lead.phone ?? "-"}</td>
                      <td>{lead.source}</td>
                      <td>
                        <span className={styles.badge}>{formatLabel(lead.stage)}</span>
                      </td>
                      <td>{lead.interestLabel ? formatLabel(lead.interestLabel) : "-"}</td>
                      <td>{lead.score ?? "-"}</td>
                      <td>{lead.salesRep?.name ?? "Unassigned"}</td>
                      <td>{new Date(lead.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.pagination}>
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>
                Previous
              </button>
              <span>
                Page {leadData?.page ?? 1} of {Math.max(1, leadData?.totalPages ?? 1)}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(leadData?.totalPages || 1, current + 1))}
                disabled={page >= (leadData?.totalPages || 1)}
              >
                Next
              </button>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function KpiCard({ label, value, subtitle }: { label: string; value: string | number; subtitle: string }) {
  return (
    <article className={styles.kpiCard}>
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{subtitle}</small>
    </article>
  );
}

function formatLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
