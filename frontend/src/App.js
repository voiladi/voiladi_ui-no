import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { SocketProvider } from "@/context/SocketContext";
import { AppShell } from "@/components/AppShell";
import { LogoMark } from "@/components/Logo";
import Welcome from "@/pages/Welcome";
import Signup from "@/pages/Signup";
import Login from "@/pages/Login";
import PhoneLogin from "@/pages/PhoneLogin";
import Onboarding from "@/pages/Onboarding";
import Discover from "@/pages/Discover";
import Explore from "@/pages/Explore";
import Likes from "@/pages/Likes";
import Chats from "@/pages/Chats";
import ChatRoom from "@/pages/ChatRoom";
import Profile from "@/pages/Profile";
import EditProfile from "@/pages/EditProfile";
import Filters from "@/pages/Filters";
import Settings from "@/pages/Settings";
import Legal from "@/pages/Legal";

const Splash = () => (
  <div className="vo-backdrop">
    <div className="vo-shell items-center justify-center" data-testid="splash-screen">
      <LogoMark size={72} />
    </div>
  </div>
);

const Gate = ({ need }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Splash />;
  const complete = !!user?.onboarded;
  if (need === "guest") {
    if (user) return <Navigate to={complete ? "/discover" : "/onboarding"} replace />;
    return <Outlet />;
  }
  if (!user) return <Navigate to="/welcome" replace state={{ from: location.pathname }} />;
  if (need === "onboarding") {
    if (complete) return <Navigate to="/discover" replace />;
    return <Outlet />;
  }
  if (!complete) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
};

const Home = () => {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/welcome" replace />;
  return <Navigate to={user.onboarded ? "/discover" : "/onboarding"} replace />;
};

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <SocketProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route element={<Gate need="guest" />}>
                <Route element={<AppShell nav={false} />}>
                  <Route path="/welcome" element={<Welcome />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/login/phone" element={<PhoneLogin />} />
                  <Route path="/auth" element={<Navigate to="/login" replace />} />
                </Route>
              </Route>
              <Route element={<AppShell nav={false} />}>
                <Route path="/legal/:page" element={<Legal />} />
              </Route>
              <Route element={<Gate need="onboarding" />}>
                <Route element={<AppShell nav={false} />}>
                  <Route path="/onboarding" element={<Onboarding />} />
                </Route>
              </Route>
              <Route element={<Gate need="app" />}>
                <Route element={<AppShell nav />}>
                  <Route path="/discover" element={<Discover />} />
                  <Route path="/explore" element={<Explore />} />
                  <Route path="/likes" element={<Likes />} />
                  <Route path="/chats" element={<Chats />} />
                  <Route path="/profile" element={<Profile />} />
                </Route>
                <Route element={<AppShell nav={false} />}>
                  <Route path="/chats/:matchId" element={<ChatRoom />} />
                  <Route path="/profile/edit" element={<EditProfile />} />
                  <Route path="/filters" element={<Filters />} />
                  <Route path="/profile/preferences" element={<Navigate to="/filters" replace />} />
                  <Route path="/settings" element={<Settings />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster position="top-center" closeButton={false} offset={12} duration={2600} visibleToasts={3} />
        </SocketProvider>
      </AuthProvider>
    </div>
  );
}

export default App;
