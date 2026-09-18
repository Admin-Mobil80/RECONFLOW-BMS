import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AppHeader } from "../components/Chrome";

export default function AppLayout() {
  const { session, loading, isMock, signOut } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!session) return <Navigate to="/signin" replace state={{ from: location.pathname }} />;

  // Pool membership already keeps customer accounts out; this is belt and
  // braces for a token that somehow carries another role.
  if (session.role !== "root" && !isMock) {
    void signOut();
    return <Navigate to="/signin" replace />;
  }

  return (
    <>
      {isMock && (
        <div className="app-banner">
          <div className="wrap">Demo session — authentication is not connected, and nothing is saved.</div>
        </div>
      )}
      <AppHeader />
      <main className="wrap">
        <Outlet />
      </main>
    </>
  );
}
