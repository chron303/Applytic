import { useNavigate, Link } from "react-router-dom";
import { Button } from "./ui/Button";

interface NavbarProps {
  userEmail?: string | null;
}

export function Navbar({ userEmail }: NavbarProps) {
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    navigate("/login");
  }

  return (
    <header className="navbar">
      <div className="navbar-inner container">
        {/* Logo */}
        <Link to="/" className="navbar-logo" aria-label="Applytic home">
          <div className="navbar-logo-mark" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect width="20" height="20" rx="5" fill="#09090B" />
              <path d="M5 14.5L7.5 9L10 13L12.5 7L15 14.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="navbar-logo-text">Applytic</span>
        </Link>

        {/* Right side */}
        <div className="navbar-right">
          {userEmail && (
            <>
              <Link to="/" className="navbar-link">Home</Link>
              <Link to="/matches" className="navbar-link">Matches</Link>
              <Link to="/review" className="navbar-link">Review Queue</Link>
              <Link to="/application-status" className="navbar-link">Applications</Link>
              <div className="navbar-user">
              <div className="navbar-avatar" aria-hidden="true">
                {userEmail[0].toUpperCase()}
              </div>
              <span className="navbar-email">{userEmail}</span>
            </div>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Sign out
          </Button>
        </div>
      </div>

      <style>{`
        .navbar {
          position: sticky;
          top: 0;
          z-index: 100;
          background: var(--color-surface);
          border-bottom: 1px solid var(--color-border);
          height: 56px;
          display: flex;
          align-items: center;
        }
        .navbar-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }
        .navbar-logo {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          text-decoration: none;
          color: inherit;
        }
        .navbar-logo-mark {
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 5px;
          flex-shrink: 0;
        }
        .navbar-logo-text {
          font-size: 1rem;
          font-weight: 700;
          color: var(--color-text);
          letter-spacing: -0.03em;
        }
        .navbar-right {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }
        .navbar-link {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text);
          text-decoration: none;
        }
        .navbar-link:hover {
          color: var(--color-primary);
        }
        .navbar-user {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .navbar-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--color-primary);
          color: var(--color-primary-fg);
          font-size: 0.75rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .navbar-email {
          font-size: 0.8125rem;
          color: var(--color-text-muted);
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        @media (max-width: 640px) {
          .navbar-email { display: none; }
        }
      `}</style>
    </header>
  );
}
