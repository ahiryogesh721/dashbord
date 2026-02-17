import Link from "next/link";
import styles from "./page.module.css";

export default function HomePage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroGradient} />
        <div className={styles.heroContent}>
          <div className={styles.heroText}>
            <h1>Real Estate Voice AI</h1>
            <p className={styles.heroSubtitle}>
              Intelligent lead management and analytics platform that transforms voice interactions into conversion opportunities
            </p>
            <div className={styles.ctaButtons}>
              <Link href="/dashbord" className={styles.primaryCta}>
                Go to Dashboard
              </Link>
              <a href="#features" className={styles.secondaryCta}>
                Learn More
              </a>
            </div>
          </div>
          <div className={styles.heroVisual}>
            <div className={styles.floatingCard}>
              <div className={styles.cardIcon}>📊</div>
              <div className={styles.cardText}>
                <h3>Real-time Analytics</h3>
                <p>Track lead lifecycle and performance</p>
              </div>
            </div>
            <div className={styles.floatingCard} style={{ animationDelay: "0.2s" }}>
              <div className={styles.cardIcon}>🎯</div>
              <div className={styles.cardText}>
                <h3>Smart Scoring</h3>
                <p>AI-powered lead qualification</p>
              </div>
            </div>
            <div className={styles.floatingCard} style={{ animationDelay: "0.4s" }}>
              <div className={styles.cardIcon}>🚀</div>
              <div className={styles.cardText}>
                <h3>Auto-Dispatch</h3>
                <p>Automatic call job management</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className={styles.featuresSection}>
        <h2>API Endpoints</h2>
        <p className={styles.sectionSubtitle}>Core features and integrations</p>

        <div className={styles.featureGrid}>
          <div className={styles.featureCard}>
            <span className={styles.featureIcon}>📞</span>
            <h3>Call Webhook</h3>
            <code className={styles.featureCode}>POST /api/webhooks/call-ended</code>
            <p>Process call completion events and trigger lead lifecycle updates</p>
          </div>

          <div className={styles.featureCard}>
            <span className={styles.featureIcon}>🏠</span>
            <h3>Site Visit Tracking</h3>
            <code className={styles.featureCode}>POST /api/leads/[leadId]/site-visit</code>
            <p>Record and manage property viewing appointments</p>
          </div>

          <div className={styles.featureCard}>
            <span className={styles.featureIcon}>📈</span>
            <h3>Founder Metrics</h3>
            <code className={styles.featureCode}>GET /api/dashboard/founder-metrics</code>
            <p>Retrieve KPI snapshots and performance metrics</p>
          </div>

          <div className={styles.featureCard}>
            <span className={styles.featureIcon}>📋</span>
            <h3>Lead Management</h3>
            <code className={styles.featureCode}>GET /api/dashboard/leads</code>
            <p>Query leads with pagination, filtering, and sorting</p>
          </div>

          <div className={styles.featureCard}>
            <span className={styles.featureIcon}>➕</span>
            <h3>Manual Lead Entry</h3>
            <code className={styles.featureCode}>POST /api/leads/manual</code>
            <p>Create and manage manually added leads</p>
          </div>

          <div className={styles.featureCard}>
            <span className={styles.featureIcon}>⚡</span>
            <h3>Call Dispatch</h3>
            <code className={styles.featureCode}>POST /api/jobs/call-dispatch</code>
            <p>Trigger automated outbound call jobs and workflows</p>
          </div>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <h2>Ready to streamline your lead management?</h2>
        <Link href="/dashbord" className={styles.primaryCta}>
          Access Dashboard
        </Link>
      </section>
    </main>
  );
}
