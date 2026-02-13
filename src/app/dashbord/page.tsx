"use client";

import { useEffect, useMemo, useState } from "react";
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

export default function DashbordPage() {
  const [metrics, setMetrics] = useState<FounderMetrics | null>(null);
  const [leadData, setLeadData] = useState<LeadListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [metricsRes, leadsRes] = await Promise.all([
          fetch("/api/dashboard/founder-metrics", { cache: "no-store" }),
          fetch("/api/dashboard/leads?page=1&page_size=50", { cache: "no-store" }),
        ]);

        if (!metricsRes.ok) {
          throw new Error(`Failed to load metrics (${metricsRes.status})`);
        }

        if (!leadsRes.ok) {
          throw new Error(`Failed to load leads (${leadsRes.status})`);
        }

        const metricsJson = await metricsRes.json();
        const leadsJson = await leadsRes.json();

        if (!isMounted) return;

        setMetrics(metricsJson.data as FounderMetrics);
        setLeadData(leadsJson.data as LeadListData);
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard data");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  const stageEntries = useMemo(() => Object.entries(metrics?.stageBreakdown ?? {}), [metrics?.stageBreakdown]);
  const interestEntries = useMemo(() => Object.entries(metrics?.interestBreakdown ?? {}), [metrics?.interestBreakdown]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Leads Dashbord</h1>
        <p>
          This page gives a full picture of every lead, project source, ownership, and where each lead currently is in the
          pipeline.
        </p>
      </header>

      {loading && <p className={styles.status}>Loading dashboard data...</p>}
      {error && <p className={styles.error}>{error}</p>}

      {!loading && !error && metrics && leadData && (
        <>
          <section className={styles.metricsGrid}>
            <MetricCard label="Total Leads" value={metrics.totalLeads.toString()} />
            <MetricCard label="Average Score" value={metrics.avgScore.toString()} />
            <MetricCard label="Conversion Rate" value={`${metrics.conversionRate}%`} />
            <MetricCard label="Follow-ups Due Today" value={metrics.followUpsDueToday.toString()} />
            <MetricCard label="Visits Scheduled" value={metrics.visits.scheduled.toString()} />
            <MetricCard label="Visits Completed" value={metrics.visits.completed.toString()} />
          </section>

          <section className={styles.breakdownSection}>
            <div className={styles.breakdownCard}>
              <h2>Stage Breakdown</h2>
              <ul>
                {stageEntries.map(([stage, count]) => (
                  <li key={stage}>
                    <span>{formatLabel(stage)}</span>
                    <strong>{count}</strong>
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.breakdownCard}>
              <h2>Interest Breakdown</h2>
              <ul>
                {interestEntries.map(([label, count]) => (
                  <li key={label}>
                    <span>{formatLabel(label)}</span>
                    <strong>{count}</strong>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className={styles.tableSection}>
            <h2>Lead Details ({leadData.total})</h2>
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>Project / Source</th>
                    <th>Stage</th>
                    <th>Interest</th>
                    <th>Score</th>
                    <th>Assigned Rep</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {leadData.leads.map((lead) => (
                    <tr key={lead.id}>
                      <td>{lead.customerName ?? "Unknown"}</td>
                      <td>{lead.phone ?? "—"}</td>
                      <td>{lead.source}</td>
                      <td>{formatLabel(lead.stage)}</td>
                      <td>{lead.interestLabel ? formatLabel(lead.interestLabel) : "—"}</td>
                      <td>{lead.score ?? "—"}</td>
                      <td>{lead.salesRep?.name ?? "Unassigned"}</td>
                      <td>{new Date(lead.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className={styles.metricCard}>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}

function formatLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
