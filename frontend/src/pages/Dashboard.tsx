import { useState, useEffect } from "react";
import { getDashboardCounts } from "../api/dashboard";
import { getErrorMessage } from "../api/errorMessages";
import { Card } from "../components/ui/Card";

const FUNNEL_STAGES = [
  "matched",
  "drafted",
  "reviewed",
  "submitted",
  "response_received",
  "interview",
  "offer",
  "rejected"
];

export default function Dashboard() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCounts() {
      try {
        setLoading(true);
        setError(null);
        const data = await getDashboardCounts();
        setCounts(data);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }
    fetchCounts();
  }, []);

  if (loading) {
    return (
      <div className="container dashboard-container">
        <h2>Dashboard</h2>
        <p style={{ color: "var(--color-text-muted)" }}>Loading metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container dashboard-container">
        <h2>Dashboard</h2>
        <p style={{ color: "var(--color-error)" }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="container dashboard-container">
      <h2>Application Funnel</h2>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "2rem" }}>
        Overview of your application pipeline by stage.
      </p>

      <div className="funnel-list">
        {FUNNEL_STAGES.map((stage, index) => {
          const count = counts[stage] || 0;
          const formattedStage = stage.replace(/_/g, " ");
          
          return (
            <Card key={stage} padding="md" className="funnel-card">
              <div className="funnel-item">
                <div className="funnel-label">
                  <span className="funnel-index">{index + 1}</span>
                  <span className="funnel-name">{formattedStage}</span>
                </div>
                <div className="funnel-count">
                  {count}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <style>{`
        .dashboard-container {
          padding: 2rem 1rem;
          max-width: 800px;
          margin: 0 auto;
        }
        .dashboard-container h2 {
          margin-top: 0;
          margin-bottom: 0.5rem;
          font-size: 1.5rem;
          font-weight: 600;
        }
        .funnel-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .funnel-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .funnel-label {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .funnel-index {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--color-info-bg);
          color: var(--color-text-muted);
          font-size: 0.8rem;
          font-weight: 600;
        }
        .funnel-name {
          font-size: 1.1rem;
          font-weight: 600;
          text-transform: capitalize;
          color: var(--color-text);
        }
        .funnel-count {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--color-primary);
        }
      `}</style>
    </div>
  );
}
