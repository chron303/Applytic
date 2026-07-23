import { useState, useEffect } from "react";
import { getDashboardCounts } from "../api/dashboard";
import { getApplications, type Application } from "../api/applications";
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
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const [countsData, appsData] = await Promise.all([
          getDashboardCounts(),
          getApplications()
        ]);
        setCounts(countsData);
        setApplications(appsData);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }
    fetchData();
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
          // Define which subsequent stages should roll up into the current stage's count
          const cumulativeMapping: Record<string, string[]> = {
            matched: ["matched", "drafted", "reviewed", "submitted", "response_received", "interview", "offer", "rejected"],
            drafted: ["drafted", "reviewed", "submitted", "response_received", "interview", "offer", "rejected"],
            reviewed: ["reviewed", "submitted", "response_received", "interview", "offer", "rejected"],
            submitted: ["submitted", "response_received", "interview", "offer", "rejected"],
            response_received: ["response_received", "interview", "offer"],
            interview: ["interview", "offer"],
            offer: ["offer"],
            rejected: ["rejected"],
          };
          
          const stagesToSum = cumulativeMapping[stage] || [stage];
          const cumulativeCount = stagesToSum.reduce((sum, s) => sum + (counts[s] || 0), 0);

          const formattedStage = stage.replace(/_/g, " ");
          
          return (
            <Card key={stage} padding="md" className="funnel-card">
              <div className="funnel-item">
                <div className="funnel-label">
                  <span className="funnel-index">{index + 1}</span>
                  <span className="funnel-name">{formattedStage}</span>
                </div>
                <div className="funnel-count">
                  {cumulativeCount}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <h2 style={{ marginTop: "3rem" }}>Recent Applications</h2>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "2rem" }}>
        Your most recently updated application statuses.
      </p>

      {applications.length === 0 ? (
        <Card padding="md">
          <p style={{ color: "var(--color-text-muted)", margin: 0, textAlign: "center" }}>
            No applications found.
          </p>
        </Card>
      ) : (
        <div className="applications-list">
          {applications.map((app) => (
            <Card key={app.id} padding="md" className="application-card">
              <div className="application-header">
                <div>
                  <h3 className="application-title">{app.title || "Unknown Title"}</h3>
                  <p className="application-company">{app.company || "Unknown Company"}</p>
                </div>
                <div className="application-meta">
                  <span className={`badge badge-${app.status}`}>
                    {app.status.replace(/_/g, " ").toUpperCase()}
                  </span>
                  <span className="application-date">
                    {new Date(app.updated_at || app.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

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
        .applications-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .application-card {
          display: flex;
          flex-direction: column;
        }
        .application-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
        }
        .application-title {
          margin: 0 0 0.25rem 0;
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--color-text);
        }
        .application-company {
          margin: 0;
          font-size: 0.875rem;
          color: var(--color-text-muted);
        }
        .application-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.5rem;
        }
        .application-date {
          font-size: 0.75rem;
          color: var(--color-text-subtle);
        }
        .badge {
          display: inline-flex;
          align-items: center;
          padding: 0.25rem 0.625rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
          background: var(--color-info-bg);
          color: var(--color-text);
        }
        .badge-matched { background: #f3f4f6; color: #374151; }
        .badge-drafted { background: #f3e8ff; color: #6b21a8; }
        .badge-reviewed { background: #dbeafe; color: #1e40af; }
        .badge-submitted { background: #dcfce7; color: #166534; }
        .badge-response_received { background: #fef08a; color: #854d0e; }
        .badge-interview { background: #fef08a; color: #854d0e; }
        .badge-offer { background: #a7f3d0; color: #065f46; }
        .badge-rejected { background: #fee2e2; color: #991b1b; }
      `}</style>
    </div>
  );
}
