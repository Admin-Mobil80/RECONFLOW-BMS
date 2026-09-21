import { Link, Route, Routes } from "react-router-dom";
import { PlainHeader } from "./components/Chrome";
import AppLayout from "./pages/AppLayout";
import Demo from "./pages/Demo";
import Organisations from "./pages/Organisations";
import SignIn from "./pages/SignIn";
import Users from "./pages/Users";

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
        <Route path="demo" element={<Demo />} />
        <Route path="users" element={<Users />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
