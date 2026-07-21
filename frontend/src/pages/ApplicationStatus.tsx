import { useState, useEffect } from "react";
import { getApplications } from "../api/applications";
import type { Application } from "../api/applications";
import { getMatches, getPostings } from "../api/matches";
import type { Match, Posting } from "../api/matches";
import { Card, CardHeader } from "../components/ui/Card";
import { getErrorMessage } from "../api/errorMessages";

export default function ApplicationStatus() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [matchesMap, setMatchesMap] = useState<Record<string, Match>>({});
  const [postingsMap, setPostingsMap] = useState<Record<string, Posting>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        
        const [fetchedApps, fetchedMatches, fetchedPostings] = await Promise.all([
          getApplications(),
          getMatches(),
          getPostings(),
        ]);
        
        setApplications(fetchedApps);
        
        const mMap: Record<string, Match> = {};
        fetchedMatches.forEach(m => { mMap[m.id] = m; });
        setMatchesMap(mMap);
        
        const pMap: Record<string, Posting> = {};
        fetchedPostings.forEach(p => { pMap[p.id] = p; });
        setPostingsMap(pMap);
        
      } catch (err: any) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="container" style={{ padding: "2rem 1rem" }}>
        <h2>Applications</h2>
        <p style={{ color: "var(--color-text-muted)" }}>Loading applications...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ padding: "2rem 1rem" }}>
        <h2>Applications</h2>
        <p style={{ color: "var(--color-error)" }}>{error}</p>
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="container" style={{ padding: "2rem 1rem" }}>
        <h2>Applications</h2>
        <div style={{ padding: "3rem", textAlign: "center", border: "1px solid var(--color-border)", borderRadius: 8 }}>
          <p>No applications found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container app-status-container">
      <h2>Applications</h2>
      <div className="app-list">
        {applications.map(app => {
          const match = matchesMap[app.match_id];
          const posting = match ? postingsMap[match.posting_id] : null;
          
          return (
            <Card key={app.id} padding="lg">
              <CardHeader
                title={posting ? posting.title : "Unknown Role"}
                subtitle={posting ? posting.company : "Unknown Company"}
              />
              <div className="app-status-body">
                <p><strong>Status:</strong> <span className={`status-badge ${app.status}`}>{app.status.toUpperCase()}</span></p>
                {app.submitted_at && (
                  <p><strong>Submitted:</strong> {new Date(app.submitted_at).toLocaleDateString()}</p>
                )}
                <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", marginTop: "0.5rem" }}>Last updated: {new Date(app.updated_at || app.created_at).toLocaleDateString()}</p>
              </div>
            </Card>
          );
        })}
      </div>

      <style>{`
        .app-status-container {
          padding: 2rem 1rem;
          max-width: 800px;
          margin: 0 auto;
        }
        .app-status-container h2 {
          margin-top: 0;
          margin-bottom: 1.5rem;
          font-size: 1.5rem;
          font-weight: 600;
        }
        .app-list {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .app-status-body {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid var(--color-border);
        }
        .app-status-body p {
          margin: 0 0 0.5rem 0;
        }
        .status-badge {
          display: inline-block;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 700;
          background: #f1f5f9;
          color: #475569;
        }
        .status-badge.submitted {
          background: #dcfce7;
          color: #166534;
        }
        .status-badge.drafted {
          background: #fef08a;
          color: #854d0e;
        }
        .status-badge.rejected {
          background: #fee2e2;
          color: #991b1b;
        }
      `}</style>
    </div>
  );
}
