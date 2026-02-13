export default function HomePage() {
  return (
    <main className="container">
      <h1>Real Estate Voice AI</h1>
      <p>
        API and dashboard for managing lead lifecycle, sales assignments, site visits, and conversion performance in one
        place.
      </p>
      <ul>
        <li>
          <code>POST /api/webhooks/call-ended</code>
        </li>
        <li>
          <code>POST /api/leads/[leadId]/site-visit</code>
        </li>
        <li>
          <code>GET /api/dashboard/founder-metrics</code>
        </li>
        <li>
          <code>GET /api/dashboard/leads</code>
        </li>
        <li>
          <code>GET /dashbord</code>
        </li>
      </ul>
    </main>
  );
}
