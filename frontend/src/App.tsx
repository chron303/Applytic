import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Matches from "./pages/Matches";
import ReviewQueue from "./pages/ReviewQueue";
import ApplicationStatus from "./pages/ApplicationStatus";
import Dashboard from "./pages/Dashboard";
import "./App.css";

function AppLayout({ children }: { children?: React.ReactNode }) {
  const email = localStorage.getItem("accessToken")
    ? (() => {
      try {
        const payload = JSON.parse(atob(localStorage.getItem("accessToken")!.split(".")[1]));
        return payload.userId ?? payload.email ?? null;
      } catch {
        return null;
      }
    })()
    : null;

  return (
    <>
      <Navbar userEmail={email} />
      {children ? children : <Home />}
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