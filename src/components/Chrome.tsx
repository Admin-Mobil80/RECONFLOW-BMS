import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3 5h7a5 5 0 0 1 5 5v4a5 5 0 0 0 5 5h1M3 19h7a5 5 0 0 0 5-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="20.5" cy="9.5" r="2.2" fill="currentColor" />
    </svg>
  );
}

/** Header for the signed-out pages: brand only. */
export function PlainHeader() {
  return (
    <header className="site-header">
      <div className="wrap">
        <span className="brand">
          <BrandMark />
          ReconFlow <span className="bms-tag">BMS</span>
        </span>
      </div>
    </header>
  );
}

/** Header plus section navigation for the signed-in shell. */
export function AppHeader() {
  const { session, signOut } = useAuth();
  return (
    <>
      <header className="site-header">
        <div className="wrap">
          <span className="brand">
            <BrandMark />
            ReconFlow <span className="bms-tag">BMS</span>
          </span>
          {session && (
            <div className="who">
              <span>{session.email}</span>
              <button className="linklike" onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>
      <div className="wrap">
        <nav className="app-nav">
          <NavLink to="/" end>
            Organisations
          </NavLink>
          <NavLink to="/demo">Demonstration</NavLink>
        </nav>
      </div>
    </>
  );
}
