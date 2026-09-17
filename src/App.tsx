import { Link, Route, Routes } from 'react-router-dom';

/** Internal back-office shell. Not a public site — no marketing routes here. */
function Dashboard() {
  return (
    <main>
      <span className="badge">ReconFlow BMS</span>
      <h1>Business management</h1>
      <p>
        Placeholder for the internal BMS. No auth wired up yet — do not deploy
        anything sensitive here until it is.
      </p>
    </main>
  );
}

function NotFound() {
  return (
    <main>
      <span className="badge">404</span>
      <h1>Page not found</h1>
      <p>
        CloudFront rewrites unknown paths to this app, so this is React Router
        answering — not S3.
      </p>
      <p>
        <Link to="/">← Back to the dashboard</Link>
      </p>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
