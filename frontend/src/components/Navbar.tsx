import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "./ui/Button";

interface NavbarProps {
  isAuthenticated?: boolean;
  userEmail?: string | null;
}

export function Navbar({ isAuthenticated, userEmail }: NavbarProps) {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  function handleLogout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    navigate("/login");
  }

  function closeMobileMenu() {
    setIsMobileMenuOpen(false);
  }

  return (
    <header className="navbar">
      <div className="navbar-inner container">
        {/* Logo */}
        <Link to="/" className="navbar-logo" aria-label="Applytic home" onClick={closeMobileMenu}>
          <div className="navbar-logo-mark" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect width="20" height="20" rx="5" fill="#09090B" />
              <path d="M5 14.5L7.5 9L10 13L12.5 7L15 14.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="navbar-logo-text">Applytic</span>
        </Link>

        {/* Mobile Toggle */}
        <button 
          className="navbar-mobile-toggle"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {isMobileMenuOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          )}
        </button>

        {/* Right side */}
        <div className={`navbar-right ${isMobileMenuOpen ? "open" : ""}`}>
          {isAuthenticated && (
            <>
              <Link to="/" className="navbar-link" onClick={closeMobileMenu}>Home</Link>
              <Link to="/dashboard" className="navbar-link" onClick={closeMobileMenu}>Dashboard</Link>
              <Link to="/matches" className="navbar-link" onClick={closeMobileMenu}>Matches</Link>
              <Link to="/review" className="navbar-link" onClick={closeMobileMenu}>Review Queue</Link>
              <Link to="/application-status" className="navbar-link" onClick={closeMobileMenu}>Applications</Link>
              {userEmail && (
                <div className="navbar-user">
                  <div className="navbar-avatar" aria-hidden="true">
                    {userEmail.charAt(0).toUpperCase()}
                  </div>
                  <span className="navbar-email">{userEmail}</span>
                </div>
              )}
              <Button variant="ghost" size="sm" onClick={() => { handleLogout(); closeMobileMenu(); }}>
                Sign out
              </Button>
            </>
          )}
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
        .navbar-mobile-toggle {
          display: none;
          background: none;
          border: none;
          color: var(--color-text);
          cursor: pointer;
          padding: 0.25rem;
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
        
        @media (max-width: 768px) {
          .navbar-mobile-toggle {
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .navbar-right {
            display: none;
            position: absolute;
            top: 56px;
            left: 0;
            right: 0;
            background: var(--color-surface);
            flex-direction: column;
            align-items: flex-start;
            padding: 1.5rem;
            gap: 1rem;
            border-bottom: 1px solid var(--color-border);
            box-shadow: var(--shadow-sm);
          }
          .navbar-right.open {
            display: flex;
          }
          .navbar-link {
            width: 100%;
            padding: 0.5rem 0;
          }
          .navbar-user {
            width: 100%;
            padding: 0.5rem 0;
          }
          .navbar-right button {
            width: 100%;
            margin-top: 0.5rem;
          }
        }
      `}</style>
    </header>
  );
}
