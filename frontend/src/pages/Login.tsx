import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { getErrorMessage } from "../api/errorMessages";
import { Button } from "../components/ui/Button";

function Login() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // OTP step state
  const [otpStep, setOtpStep] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (isSignup) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError("Invalid email format");
        return;
      }
      if (password.length < 8 || password.length > 128) {
        setError("Password must be between 8 and 128 characters");
        return;
      }
    }

    setLoading(true);

    try {
      if (isSignup) {
        await api.post("/auth/signup", { email, password });
        // Switch to OTP step
        setOtpEmail(email);
        setOtpStep(true);
        setPassword("");
        return;
      }

      const data = await api.post("/auth/login", { email, password });
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      navigate("/");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      await api.post("/auth/verify-otp", { email: otpEmail, code: otpCode });
      setOtpStep(false);
      setIsSignup(false);
      setEmail(otpEmail);
      setOtpCode("");
      setSuccess("Email verified! You can now sign in.");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      {/* Background grid */}
      <div className="login-bg" aria-hidden="true" />

      <div className="login-container">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-mark">
            <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
              <rect width="20" height="20" rx="5" fill="#09090B" />
              <path d="M5 14.5L7.5 9L10 13L12.5 7L15 14.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="login-logo-text">Applytic</span>
        </div>

        {/* Card */}
        <div className="login-card">
          {otpStep ? (
            <>
              <div className="login-card-header">
                <h1 className="login-title">Check your email</h1>
                <p className="login-subtitle">
                  We sent a 6-digit code to <strong>{otpEmail}</strong>. Enter it below to verify your account.
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="login-form" noValidate>
                <div className="login-field">
                  <label htmlFor="otp-code">Verification code</label>
                  <input
                    id="otp-code"
                    type="text"
                    inputMode="numeric"
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    required
                    autoFocus
                    style={{ letterSpacing: "0.3em", fontSize: "1.25rem", textAlign: "center" }}
                  />
                </div>

                {error && (
                  <div className="login-alert login-alert-error" role="alert">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M8 5v3M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    {error}
                  </div>
                )}

                <Button type="submit" fullWidth loading={loading} size="lg">
                  Verify Email
                </Button>
              </form>

              <div className="login-divider">
                <span />
                <p>Wrong email?</p>
                <span />
              </div>

              <button
                type="button"
                className="login-toggle"
                onClick={() => {
                  setOtpStep(false);
                  setIsSignup(true);
                  setError(null);
                }}
              >
                Go back to sign up
              </button>
            </>
          ) : (
            <>
              <div className="login-card-header">
                <h1 className="login-title">{isSignup ? "Create an account" : "Welcome back"}</h1>
                <p className="login-subtitle">
                  {isSignup
                    ? "Start analyzing resumes with AI-powered intelligence."
                    : "Sign in to your Applytic workspace."}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="login-form" noValidate>
                <div className="login-field">
                  <label htmlFor="email">Email address</label>
                  <input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </div>

                <div className="login-field">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete={isSignup ? "new-password" : "current-password"}
                  />
                </div>

                {error && (
                  <div className="login-alert login-alert-error" role="alert">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M8 5v3M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    {error}
                  </div>
                )}

                {success && (
                  <div className="login-alert login-alert-success" role="status">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M5 8l2.5 2.5L11 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {success}
                  </div>
                )}

                <Button
                  type="submit"
                  fullWidth
                  loading={loading}
                  size="lg"
                >
                  {isSignup ? "Create account" : "Sign in"}
                </Button>
              </form>

              <div className="login-divider">
                <span />
                <p>{isSignup ? "Already have an account?" : "Don't have an account?"}</p>
                <span />
              </div>

              <button
                type="button"
                className="login-toggle"
                onClick={() => {
                  setIsSignup(!isSignup);
                  setError(null);
                  setSuccess(null);
                }}
              >
                {isSignup ? "Sign in instead" : "Create an account"}
              </button>
            </>
          )}
        </div>


        <p className="login-footer">
          Secure. Private. Enterprise-ready.
        </p>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-bg);
          position: relative;
          padding: 2rem 1rem;
        }
        .login-bg {
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(var(--color-border) 1px, transparent 1px),
            linear-gradient(90deg, var(--color-border) 1px, transparent 1px);
          background-size: 40px 40px;
          opacity: 0.4;
          pointer-events: none;
        }
        .login-container {
          position: relative;
          width: 100%;
          max-width: 400px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
        }
        .login-logo {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .login-logo-mark {
          display: flex;
          align-items: center;
        }
        .login-logo-text {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--color-text);
          letter-spacing: -0.03em;
        }

        /* Card */
        .login-card {
          width: 100%;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
          padding: 2rem;
          box-shadow: var(--shadow-lg);
        }
        .login-card-header {
          margin-bottom: 1.75rem;
        }
        .login-title {
          font-size: 1.375rem;
          font-weight: 700;
          color: var(--color-text);
          margin-bottom: 0.375rem;
        }
        .login-subtitle {
          font-size: 0.875rem;
          color: var(--color-text-muted);
          line-height: 1.5;
        }

        /* Form */
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .login-field {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }

        /* Alerts */
        .login-alert {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 0.875rem;
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          font-weight: 500;
        }
        .login-alert-error {
          background: var(--color-error-bg);
          color: var(--color-error);
          border: 1px solid var(--color-error-border);
        }
        .login-alert-success {
          background: var(--color-success-bg);
          color: var(--color-success);
          border: 1px solid var(--color-success-border);
        }

        /* Divider */
        .login-divider {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin: 1.5rem 0 1rem;
        }
        .login-divider span {
          flex: 1;
          height: 1px;
          background: var(--color-border);
        }
        .login-divider p {
          font-size: 0.8125rem;
          color: var(--color-text-muted);
          white-space: nowrap;
          margin: 0;
        }

        /* Toggle */
        .login-toggle {
          display: block;
          width: 100%;
          background: var(--color-info-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 0.625rem;
          font-family: var(--font-sans);
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text);
          cursor: pointer;
          transition: background var(--transition-fast), border-color var(--transition-fast);
          text-align: center;
        }
        .login-toggle:hover {
          background: var(--color-border);
          border-color: var(--color-border-hover);
        }

        .login-footer {
          font-size: 0.75rem;
          color: var(--color-text-subtle);
          text-align: center;
          margin: 0;
        }
      `}</style>
    </div>
  );
}

export default Login;