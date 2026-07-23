import { useState, useEffect } from "react";
import { getApplications, updateApplicationField, approveApplication } from "../api/applications";
import type { Application } from "../api/applications";
import { getMatches, getPostings } from "../api/matches";
import type { Match, Posting } from "../api/matches";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { getErrorMessage } from "../api/errorMessages";

export default function ReviewQueue() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [matchesMap, setMatchesMap] = useState<Record<string, Match>>({});
  const [postingsMap, setPostingsMap] = useState<Record<string, Posting>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [editedFields, setEditedFields] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);
      
      const [fetchedApps, fetchedMatches, fetchedPostings] = await Promise.all([
        getApplications("drafted"),
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

  const handleEditClick = (app: Application) => {
    setEditingAppId(app.id);
    setEditedFields(JSON.parse(JSON.stringify(app.drafted_fields || {})));
  };

  const handleFieldChange = (fieldKey: string, newValue: string) => {
    setEditedFields(prev => ({
      ...prev,
      [fieldKey]: {
        ...prev[fieldKey],
        value: newValue,
      }
    }));
  };

  const handleSaveEdits = async (appId: string) => {
    try {
      setSubmitting(appId);
      await updateApplicationField(appId, { drafted_fields: editedFields });
      setEditingAppId(null);
      await fetchData(); // reload to get updated data
    } catch (err: any) {
      alert("Failed to save: " + getErrorMessage(err));
    } finally {
      setSubmitting(null);
    }
  };

  const handleApprove = async (appId: string) => {
    if (!window.confirm("Are you sure you want to approve and submit this application?")) {
      return;
    }
    
    try {
      setSubmitting(appId);
      await approveApplication(appId);
      // Remove from queue
      setApplications(prev => prev.filter(a => a.id !== appId));
      alert("Application submitted successfully!");
    } catch (err: any) {
      alert("Failed to approve: " + getErrorMessage(err));
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: "2rem 1rem" }}>
        <h2>Review Queue</h2>
        <p style={{ color: "var(--color-text-muted)" }}>Loading drafts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ padding: "2rem 1rem" }}>
        <h2>Review Queue</h2>
        <p style={{ color: "var(--color-error)" }}>{error}</p>
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="container" style={{ padding: "2rem 1rem" }}>
        <h2>Review Queue</h2>
        <div style={{ padding: "3rem", textAlign: "center", border: "1px solid var(--color-border)", borderRadius: 8 }}>
          <p>No drafted applications pending review.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container review-queue-container">
      <h2>Review Queue</h2>
      <div className="review-list">
        {applications.map(app => {
          const match = matchesMap[app.match_id];
          const posting = match ? postingsMap[match.posting_id] : null;
          
          const isEditing = editingAppId === app.id;
          const fieldsToRender = isEditing ? editedFields : (app.drafted_fields || {});
          
          return (
            <Card key={app.id} padding="lg">
              <CardHeader
                title={posting ? posting.title : "Unknown Role"}
                subtitle={posting ? posting.company : "Unknown Company"}
              />
              
              <div className="fields-container">
                <h4 className="fields-title">Drafted Fields</h4>
                {Object.entries(fieldsToRender).map(([key, detail]: [string, any]) => (
                  <div key={key} className="field-group">
                    <div className="field-header">
                      <label className="field-label">{key}</label>
                      {detail.confidence !== undefined && (
                        <span className={`confidence-badge ${detail.confidence < 0.5 ? 'low-confidence' : 'high-confidence'}`}>
                          Confidence: {Math.round(detail.confidence * 100)}%
                        </span>
                      )}
                    </div>
                    {detail.note && <p className="field-note">{detail.note}</p>}
                    
                    {isEditing ? (
                      <textarea 
                        className="field-textarea"
                        value={detail.value || ""}
                        onChange={(e) => handleFieldChange(key, e.target.value)}
                        rows={key.toLowerCase().includes("cover") || key.toLowerCase().includes("why") ? 5 : 2}
                      />
                    ) : (
                      <div className="field-value">{detail.value || <span className="empty-val">Not provided</span>}</div>
                    )}
                  </div>
                ))}
              </div>

              <div className="action-buttons">
                {isEditing ? (
                  <>
                    <Button 
                      variant="ghost" 
                      onClick={() => setEditingAppId(null)}
                      disabled={submitting === app.id}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => handleSaveEdits(app.id)}
                      loading={submitting === app.id}
                    >
                      Save Edits
                    </Button>
                  </>
                ) : (
                  <>
                    {app.source_url && (
                      <Button
                        variant="ghost"
                        onClick={() => window.open(app.source_url, '_blank')}
                        disabled={submitting === app.id}
                      >
                        Open Job Posting →
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      onClick={() => handleEditClick(app)}
                      disabled={submitting === app.id}
                    >
                      Edit Fields
                    </Button>
                    <Button 
                      onClick={() => handleApprove(app.id)}
                      loading={submitting === app.id}
                    >
                      Approve & Submit
                    </Button>
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <style>{`
        .review-queue-container {
          padding: 2rem 1rem;
          max-width: 800px;
          margin: 0 auto;
        }
        .review-queue-container h2 {
          margin-top: 0;
          margin-bottom: 1.5rem;
          font-size: 1.5rem;
          font-weight: 600;
        }
        .review-list {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .fields-container {
          margin-top: 1.5rem;
          padding-top: 1.5rem;
          border-top: 1px solid var(--color-border);
        }
        .fields-title {
          margin: 0 0 1rem 0;
          font-size: 1rem;
          font-weight: 600;
        }
        .field-group {
          margin-bottom: 1.25rem;
          background: #fafafa;
          padding: 1rem;
          border-radius: 6px;
          border: 1px solid #eaeaea;
        }
        .field-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }
        .field-label {
          font-weight: 600;
          font-size: 0.875rem;
          text-transform: capitalize;
        }
        .confidence-badge {
          font-size: 0.75rem;
          padding: 0.125rem 0.375rem;
          border-radius: 9999px;
          font-weight: 600;
        }
        .low-confidence {
          background: #ffedd5;
          color: #c2410c;
        }
        .high-confidence {
          background: #dcfce7;
          color: #166534;
        }
        .field-note {
          font-size: 0.8rem;
          color: var(--color-text-subtle);
          margin: 0 0 0.5rem 0;
          font-style: italic;
        }
        .field-value {
          font-size: 0.9375rem;
          white-space: pre-wrap;
          line-height: 1.5;
        }
        .empty-val {
          color: var(--color-text-muted);
          font-style: italic;
        }
        .field-textarea {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid var(--color-border);
          border-radius: 4px;
          font-family: inherit;
          font-size: 0.9375rem;
          resize: vertical;
        }
        .action-buttons {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          margin-top: 1.5rem;
        }
        @media (max-width: 640px) {
          .field-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }
          .action-buttons {
            flex-direction: column;
            gap: 0.5rem;
          }
          .action-buttons button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
