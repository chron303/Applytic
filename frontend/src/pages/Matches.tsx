import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getMatches, getPostings } from "../api/matches";
import type { Match, Posting } from "../api/matches";
import { draftApplication } from "../api/applications";
import { Button } from "../components/ui/Button";
import { getErrorMessage } from "../api/errorMessages";

export default function Matches() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [postingsMap, setPostingsMap] = useState<Record<string, Posting>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftingId, setDraftingId] = useState<string | null>(null);

  const handleDraft = async (matchId: string) => {
    try {
      setDraftingId(matchId);
      await draftApplication(matchId);
      navigate("/review");
    } catch (err: any) {
      alert("Failed to draft application: " + getErrorMessage(err));
    } finally {
      setDraftingId(null);
    }
  };

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const [fetchedMatches, fetchedPostings] = await Promise.all([
          getMatches(),
          getPostings(),
        ]);
        
        setMatches(fetchedMatches);
        
        const map: Record<string, Posting> = {};
        for (const posting of fetchedPostings) {
          map[posting.id] = posting;
        }
        setPostingsMap(map);
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
      <div className="matches-container container">
        <h2>Match Feed</h2>
        <p className="loading-text">Loading matches...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="matches-container container">
        <h2>Match Feed</h2>
        <p className="error-text">{error}</p>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="matches-container container">
        <h2>Match Feed</h2>
        <div className="empty-state">
          <p>No matches found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="matches-container container">
      <h2>Match Feed</h2>
      <div className="matches-list">
        {matches.map((match) => {
          const posting = postingsMap[match.posting_id];
          
          let displayBadge = match.match_result.toUpperCase();
          let badgeClass = `badge badge-${match.match_result}`;

          if (match.application_status === 'submitted') {
            displayBadge = "APPLIED";
            badgeClass = "badge badge-applied";
          } else if (match.application_status === 'drafted' || match.application_status === 'reviewed') {
            displayBadge = "DRAFTED";
            badgeClass = "badge badge-drafted";
          }

          return (
            <div key={match.id} className="match-card">
              <div className="match-header">
                <div>
                  <h3 className="match-title">{posting?.title || "Unknown Title"}</h3>
                  <p className="match-company">{posting?.company || "Unknown Company"}</p>
                </div>
                <span className={badgeClass}>
                  {displayBadge}
                </span>
              </div>
              <div className="match-body">
                <p className="match-reasoning">{match.reasoning || "No reasoning provided."}</p>
              </div>
              {match.match_result === 'apply' && !match.application_status && (
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <Button 
                    onClick={() => handleDraft(match.id)}
                    loading={draftingId === match.id}
                  >
                    Draft Application
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      <style>{`
        .matches-container {
          padding: 2rem 1rem;
          max-width: 800px;
          margin: 0 auto;
        }
        .matches-container h2 {
          margin-top: 0;
          margin-bottom: 1.5rem;
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--color-text);
        }
        .loading-text, .error-text, .empty-state p {
          color: var(--color-text-muted);
        }
        .error-text {
          color: #ef4444;
        }
        .empty-state {
          padding: 3rem 1rem;
          text-align: center;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 8px;
        }
        .matches-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .match-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          padding: 1.25rem;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .match-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }
        .match-title {
          margin: 0 0 0.25rem 0;
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--color-text);
        }
        .match-company {
          margin: 0;
          font-size: 0.875rem;
          color: var(--color-text-muted);
        }
        .badge {
          display: inline-flex;
          align-items: center;
          padding: 0.25rem 0.625rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
        }
        .badge-apply {
          background: #dcfce7;
          color: #166534;
        }
        .badge-maybe {
          background: #fef08a;
          color: #854d0e;
        }
        .badge-skip {
          background: #f3f4f6;
          color: #374151;
        }
        .badge-applied {
          background: #dbeafe;
          color: #1e40af;
        }
        .badge-drafted {
          background: #f3e8ff;
          color: #6b21a8;
        }
        .match-body {
          font-size: 0.9375rem;
          line-height: 1.5;
          color: var(--color-text);
        }
        .match-reasoning {
          margin: 0;
        }
        @media (max-width: 640px) {
          .match-header {
            flex-direction: column;
            gap: 0.75rem;
          }
        }
      `}</style>
    </div>
  );
}
