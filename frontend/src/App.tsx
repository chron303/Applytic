import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { api } from "./api/client";
import { Navbar } from "./components/Navbar";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Landing from "./pages/Landing";
import Matches from "./pages/Matches";
import ReviewQueue from "./pages/ReviewQueue";
import ApplicationStatus from "./pages/ApplicationStatus";
import Dashboard from "./pages/Dashboard";
import "./App.css";

function AppLayout({ children }: { children?: React.ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      setLoading(false);
      return;
    }
    
    setIsAuthenticated(true);
    
    api.get("/auth/me")
      .then(data => {
        if (data.email) {
          setEmail(data.email);
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
        setEmail(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <>
      <Navbar isAuthenticated={isAuthenticated} userEmail={email} />
      {children ? children : (isAuthenticated ? <Home /> : <Landing />)}
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<AppLayout><Dashboard /></AppLayout>} />
        <Route path="/matches" element={<AppLayout><Matches /></AppLayout>} />
        <Route path="/review" element={<AppLayout><ReviewQueue /></AppLayout>} />
        <Route path="/application-status" element={<AppLayout><ApplicationStatus /></AppLayout>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;