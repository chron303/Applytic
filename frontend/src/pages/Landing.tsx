import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";

export default function Landing() {
  return (
    <div className="landing-container">
      <div className="landing-content">
        <h1 className="landing-title">Applytic</h1>
        <p className="landing-description">
          AI-powered job discovery and application assistant — upload your resume, get matched to real openings with honest, cited reasoning.
        </p>
        
        <div className="features-container">
          <div className="feature-card">
            <h3>Smart Matching</h3>
            <p>deterministic + AI-explained fit scoring</p>
          </div>
          <div className="feature-card">
            <h3>Application Drafting</h3>
            <p>auto-fills real job forms for review</p>
          </div>
          <div className="feature-card">
            <h3>Full Transparency</h3>
            <p>every match comes with clear reasoning, never a bare score</p>
          </div>
        </div>

        <Link to="/login">
          <Button size="lg" className="landing-signin-btn">Sign In</Button>
        </Link>
      </div>

      <style>{`
        .landing-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: calc(100vh - 56px);
          background-color: var(--color-bg);
          padding: 2rem;
        }
        .landing-content {
          text-align: center;
          max-width: 900px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .landing-title {
          font-size: 3.5rem;
          font-weight: 800;
          color: var(--color-text);
          margin-bottom: 1rem;
          letter-spacing: -0.05em;
        }
        .landing-description {
          font-size: 1.25rem;
          color: var(--color-text-muted);
          margin-bottom: 3rem;
          line-height: 1.6;
          max-width: 700px;
        }
        .features-container {
          display: flex;
          gap: 1.5rem;
          margin-bottom: 3.5rem;
          flex-wrap: wrap;
          justify-content: center;
          width: 100%;
        }
        .feature-card {
          flex: 1;
          min-width: 240px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl, 1rem);
          padding: 1.5rem;
          text-align: left;
          box-shadow: var(--shadow-sm, 0 1px 2px 0 rgb(0 0 0 / 0.05));
        }
        .feature-card h3 {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--color-text);
          margin-top: 0;
          margin-bottom: 0.5rem;
        }
        .feature-card p {
          font-size: 0.875rem;
          color: var(--color-text-muted);
          line-height: 1.5;
          margin: 0;
        }
        .landing-signin-btn {
          padding-left: 2.5rem;
          padding-right: 2.5rem;
        }
        
        @media (max-width: 768px) {
          .features-container {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
