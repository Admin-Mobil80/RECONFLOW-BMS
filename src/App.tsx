import { Link, Route, Routes } from "react-router-dom";
import { PlainHeader } from "./components/Chrome";
import AppLayout from "./pages/AppLayout";
import Organisations from "./pages/Organisations";
import SignIn from "./pages/SignIn";

function NotFound() {
  return (
    <>
      <PlainHeader />
      <main className="wrap" style={{ padding: "4rem 1.25rem" }}>
        <h1>Page not found</h1>
        <p style={{ marginTop: "1.5rem" }}>
          <Link to="/">← Organisations</Link>
        </p>
      </main>
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/signin" element={<SignIn />} />
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Organisations />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
