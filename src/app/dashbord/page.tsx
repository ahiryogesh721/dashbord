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
};

type ManualLeadFieldErrors = Partial<Record<keyof ManualLeadFormState, string>>;

const PAGE_SIZE = 25;

const INITIAL_FORM: ManualLeadFormState = {
  customer_name: "",
  countryCode: "+91",
  phone: "",
};

const COUNTRY_OPTIONS = [
  { name: "India", dialCode: "+91" },
  { name: "United States", dialCode: "+1" },
  { name: "United Kingdom", dialCode: "+44" },
  { name: "UAE", dialCode: "+971" },
  { name: "Singapore", dialCode: "+65" },
  { name: "Australia", dialCode: "+61" },
] as const;

const SIDEBAR_ITEMS = ["Dashboard", "Checklist", "Time off", "Attendance", "Payroll", "Performance", "Requirement"];

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
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);

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
          return [lead.customerName ?? "", lead.phone ?? "", lead.source].join(" ").toLowerCase().includes(query);
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

  const chartBars = useMemo(() => {
    return stageBreakdownEntries.map((entry) => ({
      label: formatLabel(entry.stage),
      value: entry.count,
      height: `${Math.max(16, Math.round((entry.count / topStageCount) * 100))}%`,
    }));
  }, [stageBreakdownEntries, topStageCount]);

  const donutSegments = useMemo(() => {
    const values = INTEREST_LABELS.map((interest) => metrics?.interestBreakdown[interest] ?? 0);
    const total = values.reduce((sum, value) => sum + value, 0) || 1;

    const colors = ["#5a2ca7", "#7b53d8", "#b39cf6"];
    let progress = 0;

    const parts = values.map((value, index) => {
      const pct = (value / total) * 100;
      const start = progress;
      progress += pct;
      return `${colors[index % colors.length]} ${start}% ${progress}%`;
    });

    return `conic-gradient(${parts.join(",")})`;
  }, [metrics]);

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
        }),
      });

      const json = (await response.json()) as {
        ok: boolean;
        error?: string;
        dispatch?: {
          ok: boolean;
          error: string | null;
        };
      };
      if (!response.ok || !json.ok) {
        throw new Error(json.error ?? "Unable to add manual lead");
      }

      const successMessage = json.dispatch?.ok
        ? "Lead created successfully and dispatch triggered."
        : `Lead created successfully, but dispatch trigger failed${json.dispatch?.error ? `: ${json.dispatch.error}` : "."}`;

      setManualLeadSuccess(successMessage);
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

  async function handleDeleteLead(leadId: string) {
    setDeletingLeadId(leadId);
    setManualLeadError(null);
    setManualLeadSuccess(null);

    try {
      const response = await fetch(`/api/dashboard/leads/${leadId}`, {
        method: "DELETE",
      });

      const json = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !json.ok) {
        throw new Error(json.error ?? "Unable to delete lead");
      }

      setRefreshTick((value) => value + 1);
    } catch (deleteError) {
      setManualLeadError(deleteError instanceof Error ? deleteError.message : "Unable to delete lead");
    } finally {
      setDeletingLeadId(null);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <aside className={styles.sidebar}>
          <div className={styles.logo}>Career Coaches</div>
          <ul className={styles.menuList}>
            {SIDEBAR_ITEMS.map((item, index) => (
              <li key={item} className={index === 0 ? styles.menuActive : ""}>
                {item}
              </li>
            ))}
          </ul>
          <div className={styles.sidebarFooter}>
            <p>Help Center</p>
            <p>Settings</p>
            <p>Logout</p>
          </div>
        </aside>

        <section className={styles.content}>
          <div className={styles.topRow}>
            <input
              className={styles.searchInput}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search anything"
            />
            <div className={styles.topActions}>
              <button type="button" onClick={() => setRefreshTick((value) => value + 1)}>
                Refresh
              </button>
              <button type="button" onClick={resetFilters}>
                Reset
              </button>
            </div>
          </div>

          <header className={styles.greeting}>
            <h1>Hi, Founder Team</h1>
            <p>This is your CRM report so far.</p>
          </header>

          <section className={styles.statsAndChart}>
            <div className={styles.statsGrid}>
              <KpiCard label="Total Leads" value={metrics?.totalLeads ?? 0} subtitle="All employees" />
              <KpiCard label="Job Applicants" value={leadData?.total ?? 0} subtitle="in this pipeline" />
              <KpiCard label="Follow-ups" value={metrics?.followUpsDueToday ?? 0} subtitle="due today" />
              <KpiCard label="Avg Score" value={visibleAvgScore} subtitle="current list" />
            </div>

            <article className={styles.performanceCard}>
              <div className={styles.sectionHead}>
                <h2>Team Performance</h2>
                <span>Last 5 months</span>
              </div>
              <div className={styles.barChart}>
                {chartBars.map((bar) => (
                  <div key={bar.label}>
                    <span style={{ height: bar.height }} />
                    <small>{bar.label}</small>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className={styles.controlsPanel}>
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
              <button type="button" className={styles.smallButton} onClick={() => setShowManualForm((prev) => !prev)}>
                {showManualForm ? "Hide Add Lead" : "Add Manual Lead"}
              </button>
            </div>

            {showManualForm && (
              <form className={styles.manualLeadForm} onSubmit={handleManualLeadSubmit} noValidate>
                <input
                  value={manualLeadForm.customer_name}
                  onChange={(event) => setManualLeadForm((state) => ({ ...state, customer_name: event.target.value }))}
                  placeholder="Lead full name"
                  className={manualLeadFieldErrors.customer_name ? styles.inputError : ""}
                />
                <select
                  value={manualLeadForm.countryCode}
                  onChange={(event) => setManualLeadForm((state) => ({ ...state, countryCode: event.target.value }))}
                  className={manualLeadFieldErrors.phone ? styles.inputError : ""}
                  aria-label="Country code"
                >
                  {COUNTRY_OPTIONS.map((country) => (
                    <option key={country.dialCode} value={country.dialCode}>
                      {country.name} ({country.dialCode})
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
                <button type="submit" className={styles.smallButton} disabled={manualLeadLoading}>
                  {manualLeadLoading ? "Saving..." : "Create"}
                </button>
              </form>
            )}
          </section>

          {degraded && <p className={styles.notice}>Limited data mode enabled.</p>}
          {loading && <p className={styles.notice}>Loading dashboard…</p>}
          {error && <p className={styles.error}>{error}</p>}
          {manualLeadError && <p className={styles.error}>{manualLeadError}</p>}
          {manualLeadSuccess && <p className={styles.success}>{manualLeadSuccess}</p>}

          {!loading && !error && (
            <section className={styles.lowerGrid}>
              <article className={styles.tableCard}>
                <div className={styles.sectionHead}>
                  <h2>Employees</h2>
                  <div className={styles.sortButtons}>
                    <button type="button" onClick={() => toggleSort("createdAt")}>Date</button>
                    <button type="button" onClick={() => toggleSort("score")}>Score</button>
                    <button type="button" onClick={() => toggleSort("customerName")}>Name</button>
                  </div>
                </div>
                <div className={styles.tableWrap}>
                  <table>
                    <thead>
                      <tr>
                        <th>Employee Name</th>
                        <th>Source</th>
                        <th>Stage</th>
                        <th>Interest</th>
                        <th>Score</th>
                        <th>Office</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeads.length === 0 && (
                        <tr>
                          <td colSpan={7} className={styles.emptyRow}>
                            No leads found for current filters.
                          </td>
                        </tr>
                      )}
                      {filteredLeads.slice(0, 7).map((lead) => (
                        <tr key={lead.id}>
                          <td>{lead.customerName ?? "Unknown"}</td>
                          <td>{lead.source}</td>
                          <td>{formatLabel(lead.stage)}</td>
                          <td>{lead.interestLabel ? formatLabel(lead.interestLabel) : "-"}</td>
                          <td>{lead.score ?? "-"}</td>
                          <td>{new Date(lead.createdAt).toLocaleDateString()}</td>
                          <td>
                            <button
                              type="button"
                              className={styles.deleteButton}
                              onClick={() => {
                                void handleDeleteLead(lead.id);
                              }}
                              disabled={deletingLeadId === lead.id}
                            >
                              {deletingLeadId === lead.id ? "Deleting" : "Delete"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className={styles.pagination}>
                  <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>
                    Prev
                  </button>
                  <span>
                    Page {leadData?.page ?? 1} / {Math.max(1, leadData?.totalPages ?? 1)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.min(leadData?.totalPages || 1, current + 1))}
                    disabled={page >= (leadData?.totalPages || 1)}
                  >
                    Next
                  </button>
                </div>
              </article>

              <article className={styles.donutCard}>
                <div className={styles.sectionHead}>
                  <h2>Total Employees</h2>
                </div>
                <div className={styles.donut} style={{ backgroundImage: donutSegments }}>
                  <div>
                    <strong>{metrics?.totalLeads ?? 0}</strong>
                    <span>Total Emp.</span>
                  </div>
                </div>
                <ul className={styles.legend}>
                  {INTEREST_LABELS.map((interest) => (
                    <li key={interest}>
                      <span /> {formatLabel(interest)} ({metrics?.interestBreakdown[interest] ?? 0})
                    </li>
                  ))}
                </ul>
              </article>
            </section>
          )}
        </section>
      </section>
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
