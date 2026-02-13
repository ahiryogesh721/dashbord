"use client";

import { useEffect, useMemo, useState } from "react";

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

const PAGE_SIZE = 25;

export default function DashbordPage() {
  const [metrics, setMetrics] = useState<FounderMetrics | null>(null);
  const [leadData, setLeadData] = useState<LeadListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stageFilter, setStageFilter] = useState<string>("");
  const [interestFilter, setInterestFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoading(true);
      setError(null);

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

        const metricsJson = (await metricsRes.json()) as { data: FounderMetrics };
        const leadsJson = (await leadsRes.json()) as { data: LeadListData };

        if (!mounted) return;
        setMetrics(metricsJson.data);
        setLeadData(leadsJson.data);
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
  }, [page, stageFilter, interestFilter]);

  const stageBreakdownEntries = useMemo(
    () =>
      LEAD_STAGES.map((stage) => ({
        stage,
        count: metrics?.stageBreakdown[stage] ?? 0,
      })),
    [metrics],
  );

  const topStageCount = useMemo(
    () => Math.max(1, ...stageBreakdownEntries.map((entry) => entry.count)),
    [stageBreakdownEntries],
  );

  const filteredLeads = useMemo(() => {
    const leads = leadData?.leads ?? [];
    const query = search.trim().toLowerCase();

    const searched = query
      ? leads.filter((lead) => {
          const repName = lead.salesRep?.name ?? "";
          return [lead.customerName ?? "", lead.phone ?? "", lead.source, repName].join(" ").toLowerCase().includes(query);
        })
      : leads;

    const sorted = [...searched].sort((a, b) => {
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

    return sorted;
  }, [leadData?.leads, search, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDir(field === "customerName" ? "asc" : "desc");
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <h1>Smart Leads Dashbord</h1>
          <p>
            Interactive view of your lead funnel, conversion trends, sales ownership, and project sources so everyone knows
            exactly where we are right now.
          </p>
        </div>
        <button type="button" className={styles.refreshButton} onClick={() => setPage(1)}>
          Refresh Snapshot
        </button>
      </section>

      <section className={styles.filters}>
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

        <label>
          Search
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, phone, source, rep"
          />
        </label>
      </section>

      {loading && <p className={styles.status}>Loading dashboard...</p>}
      {error && <p className={styles.error}>{error}</p>}

      {!loading && !error && metrics && leadData && (
        <>
          <section className={styles.metricsGrid}>
            <MetricCard label="Total Leads" value={metrics.totalLeads} hint="All-time captured leads" />
            <MetricCard label="Avg Lead Score" value={metrics.avgScore} hint="Scoring quality signal" />
            <MetricCard label="Conversion Rate" value={`${metrics.conversionRate}%`} hint="Closed vs total" />
            <MetricCard label="Follow-ups Today" value={metrics.followUpsDueToday} hint="Pending actions" />
            <MetricCard label="Visits Scheduled" value={metrics.visits.scheduled} hint="Upcoming site visits" />
            <MetricCard label="Visits Completed" value={metrics.visits.completed} hint="Completed visits" />
          </section>

          <section className={styles.progressSection}>
            <article className={styles.panel}>
              <h2>Pipeline Stage Distribution</h2>
              <ul className={styles.progressList}>
                {stageBreakdownEntries.map((entry) => (
                  <li key={entry.stage}>
                    <button type="button" onClick={() => setStageFilter(entry.stage)} className={styles.stageButton}>
                      {formatLabel(entry.stage)}
                    </button>
                    <div className={styles.progressTrack}>
                      <span style={{ width: `${(entry.count / topStageCount) * 100}%` }} />
                    </div>
                    <strong>{entry.count}</strong>
                  </li>
                ))}
              </ul>
            </article>

            <article className={styles.panel}>
              <h2>Interest Mix</h2>
              <ul className={styles.compactList}>
                {INTEREST_LABELS.map((label) => (
                  <li key={label}>
                    <span>{formatLabel(label)}</span>
                    <strong>{metrics.interestBreakdown[label] ?? 0}</strong>
                  </li>
                ))}
              </ul>
            </article>
          </section>

          <section className={styles.tableSection}>
            <div className={styles.tableHeading}>
              <h2>Lead Details ({leadData.total})</h2>
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
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>Project/Source</th>
                    <th>Stage</th>
                    <th>Interest</th>
                    <th>Score</th>
                    <th>Sales Rep</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id}>
                      <td>{lead.customerName ?? "Unknown"}</td>
                      <td>{lead.phone ?? "—"}</td>
                      <td>{lead.source}</td>
                      <td>
                        <span className={styles.badge}>{formatLabel(lead.stage)}</span>
                      </td>
                      <td>{lead.interestLabel ? formatLabel(lead.interestLabel) : "—"}</td>
                      <td>{lead.score ?? "—"}</td>
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
                Page {leadData.page} of {Math.max(1, leadData.totalPages)}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(leadData.totalPages || 1, current + 1))}
                disabled={page >= (leadData.totalPages || 1)}
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

function MetricCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <article className={styles.metricCard}>
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

function formatLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
