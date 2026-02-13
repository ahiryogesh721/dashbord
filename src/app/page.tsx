export default function HomePage() {
  return (
    <main className="container">
      <h1>Real Estate Voice AI Backend</h1>
      <p>Backend scaffold is ready. Use API routes to ingest call events and manage lead lifecycle.</p>
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
