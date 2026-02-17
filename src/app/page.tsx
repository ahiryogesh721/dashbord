import Link from "next/link";
import styles from "./page.module.css";

const platformHighlights = [
  {
    title: "Conversation Intelligence",
    description: "Every call is auto-analyzed for intent, urgency, and buying readiness with AI scoring.",
    stat: "96% intent detection",
  },
  {
    title: "Pipeline Visibility",
    description: "Track each lead stage in real time with beautiful, actionable cards and smart filters.",
    stat: "Live funnel analytics",
  },
  {
    title: "Action Automation",
    description: "Auto-dispatch follow-ups and site-visit workflows based on what happened in calls.",
    stat: "< 1 min response loop",
  },
];

const endpointList = [
  "POST /api/webhooks/call-ended",
  "POST /api/leads/[leadId]/site-visit",
  "GET /api/dashboard/founder-metrics",
  "GET /api/dashboard/leads",
  "POST /api/leads/manual",
  "POST /api/jobs/call-dispatch",
];

export default function HomePage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.orbOne} />
        <div className={styles.orbTwo} />
        <div className={styles.gridGlow} />

        <div className={styles.heroContent}>
          <div className={styles.heroText}>
            <p className={styles.kicker}>Next-gen Real Estate Growth Engine</p>
            <h1>Transform every call into your next closed deal.</h1>
            <p className={styles.heroSubtitle}>
              A premium AI-first command center that blends voice intelligence, lead orchestration, and high-converting
              workflows into one insanely fast experience.
            </p>
            <div className={styles.ctaButtons}>
              <Link href="/dashbord" className={styles.primaryCta}>
                Enter Dashboard
              </Link>
              <a href="#platform" className={styles.secondaryCta}>
                Explore Platform
              </a>
            </div>
          </div>

          <aside className={styles.heroPanel}>
            <h2>Live Performance Pulse</h2>
            <ul>
              <li>
                <span>Leads captured today</span>
                <strong>128</strong>
              </li>
              <li>
                <span>Qualified in under 5 min</span>
                <strong>84%</strong>
              </li>
              <li>
                <span>Follow-up automation success</span>
                <strong>99.2%</strong>
              </li>
            </ul>
          </aside>
        </div>
      </section>

      <section id="platform" className={styles.highlights}>
        {platformHighlights.map((item) => (
          <article key={item.title} className={styles.highlightCard}>
            <p>{item.stat}</p>
            <h3>{item.title}</h3>
            <span>{item.description}</span>
          </article>
        ))}
      </section>

      <section className={styles.apiSection}>
        <div>
          <p className={styles.kicker}>Developer-ready foundation</p>
          <h2>Production APIs with clear operational coverage.</h2>
          <p className={styles.apiSubtitle}>
            Built for speed and reliability—drop these endpoints into your workflow automation and sales stack.
          </p>
        </div>
        <div className={styles.endpointGrid}>
          {endpointList.map((endpoint) => (
            <code key={endpoint}>{endpoint}</code>
          ))}
        </div>
      </section>
    </main>
  );
}
