import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ResumeUpload from "../components/ResumeUpload";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { uploadResume } from "../api/resume";
import { matchProfile } from "../api/matches";
import { getProfile } from "../api/profiles";

function Home() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      const token = localStorage.getItem("accessToken");
      if (!token) {
        setLoadingProfile(false);
        return;
      }
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const userId = payload.userId || payload.sub; // Handle different token structures just in case
        if (userId) {
          const data = await getProfile(userId);
          setProfile(data);
        }
      } catch (err) {
        // Assume no profile or error fetching
      } finally {
        setLoadingProfile(false);
      }
    }
    loadProfile();
  }, []);

  async function handleAnalyze() {
    if (!file && !profile) {
      setError("Please upload a resume PDF before analyzing.");
      return;
    }

    setError(null);

    try {
      setLoading(true);
      if (file) {
        const newProfile = await uploadResume(file);
        await matchProfile(newProfile.user_id, newProfile.parsed_data);
      } else if (profile) {
        await matchProfile(profile.user_id, profile.parsed_data);
      }
      navigate("/matches");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError("Analysis failed: " + msg);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setFile(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const canAnalyze = !!file || !!profile;

  return (
    <main className="home-page">
      <div className="container">

        {/* ── Page header ── */}
        <div className="home-header">
          <div>
            <h1 className="home-title">Resume Intelligence</h1>
            <p className="home-subtitle">
              Upload your resume to instantly match against all active job postings.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleReset}>
            Reset
          </Button>
        </div>

        {/* ── Dashboard grid ── */}
        <div className="home-grid">

          {/* Card 1 — Resume Upload */}
          <Card padding="md">
            <CardHeader
              title={profile && !showUpload ? "Current Profile" : profile && showUpload ? "Update Resume" : "Upload Resume"}
              subtitle={profile && !showUpload ? "Your saved profile details" : "Upload the candidate's resume in PDF format"}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              }
            />
            {loadingProfile ? (
              <p style={{ color: "var(--color-text-muted)" }}>Loading profile...</p>
            ) : profile && !showUpload ? (
              <div className="profile-summary">
                <p style={{ marginBottom: "0.5rem" }}><strong>Name:</strong> {profile.parsed_data?.name || "Unknown"}</p>
                <p style={{ marginBottom: "0.5rem" }}><strong>Top Skills:</strong> {profile.parsed_data?.skills?.slice(0, 5).join(", ") || "None"}</p>
                <p style={{ marginBottom: "1.5rem" }}><strong>Resume last updated:</strong> {new Date(profile.updated_at || profile.created_at).toLocaleDateString()}</p>
                <Button onClick={() => setShowUpload(true)} variant="ghost">
                  Update Resume
                </Button>
              </div>
            ) : (
              <ResumeUpload file={file} setFile={setFile} />
            )}
          </Card>

          {/* Card 2 — Analyze */}
          <Card padding="md">
            <CardHeader
              title="Analyze & Match"
              subtitle="Run the AI-powered matching engine against all jobs"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              }
            />

            <div className="home-analyze-body">
              {/* Checklist */}
              <div className="home-checklist">
                <div className={`home-check-item ${(file || profile) ? "home-check--done" : ""}`}>
                  {(file || profile) ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" fill="var(--color-success)" />
                      <path d="M5 8l2.5 2.5L11 5.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <div className="home-check-circle" aria-hidden="true" />
                  )}
                  <span>{profile && !file ? "Saved profile active" : "Resume uploaded"}</span>
                </div>
              </div>

              {error && (
                <div className="home-error" role="alert">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M8 5v3M8 10.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  {error}
                </div>
              )}

              <Button
                fullWidth
                size="lg"
                loading={loading}
                disabled={!canAnalyze}
                onClick={handleAnalyze}
              >
                {loading ? "Matching profile…" : "Find Matches"}
              </Button>

              <p className="home-analyze-note">
                Powered by Google Gemini · Results in ~10 seconds
              </p>
            </div>
          </Card>

        </div>
      </div>

      <style>{`
        .home-page {
          flex: 1;
          padding: 2rem 0 4rem;
        }

        .home-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 2rem;
        }
        .home-title {
          font-size: 1.625rem;
          font-weight: 700;
          color: var(--color-text);
          letter-spacing: -0.03em;
          margin-bottom: 0.25rem;
        }
        .home-subtitle {
          font-size: 0.9375rem;
          color: var(--color-text-muted);
          margin: 0;
          max-width: 520px;
        }

        /* Grid */
        .home-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.25rem;
        }
        @media (max-width: 768px) {
          .home-grid { grid-template-columns: 1fr; }
          .home-header { flex-direction: column; }
        }

        /* Analyze card body */
        .home-analyze-body {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        /* Checklist */
        .home-checklist {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .home-check-item {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          font-size: 0.875rem;
          color: var(--color-text-subtle);
          transition: color var(--transition-fast);
        }
        .home-check--done {
          color: var(--color-text-muted);
          font-weight: 500;
        }
        .home-check-circle {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid var(--color-border);
          flex-shrink: 0;
        }

        /* Error */
        .home-error {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          padding: 0.625rem 0.875rem;
          background: var(--color-error-bg);
          border: 1px solid var(--color-error-border);
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          color: var(--color-error);
          line-height: 1.4;
        }

        .home-analyze-note {
          font-size: 0.8rem;
          color: var(--color-text-subtle);
          text-align: center;
          margin: 0;
        }
      `}</style>
    </main>
  );
}

export default Home;