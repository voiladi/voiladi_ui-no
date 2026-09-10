import React, { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { SocketProvider } from "@/context/SocketContext";
import { AppShell } from "@/components/AppShell";
import { LogoMark } from "@/components/Logo";
import { Spinner } from "@/components/Loading";
import { OfflineScreen } from "@/components/Offline";
import { nativeReady } from "@/lib/native";
import { getToken } from "@/lib/api";
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
import Notifications from "@/pages/Notifications";
import Legal from "@/pages/Legal";

/* Boot screen while the session is checked: logo centred, thin spinner near the bottom (as native apps do). */
const Splash = () => (
  <div className="vo-backdrop">
    <div className="vo-shell items-center justify-center" data-testid="splash-screen">
      <LogoMark size={84} />
      <div className="absolute bottom-0 flex flex-col items-center gap-3 text-mute" style={{ paddingBottom: "max(48px, env(safe-area-inset-bottom))" }}>
        <Spinner size={22} stroke={2} />
      </div>
    </div>
  </div>
);

/* Tells the Android shell the web app has rendered (hides the native splash). Harmless in browsers. */
const NativeReady = () => {
  useEffect(() => {
    nativeReady();
  }, []);
  return null;
};

const Gate = ({ need }) => {
  const { user, loading, netError, refresh } = useAuth();
  const location = useLocation();
  if (loading) return <Splash />;
  if (!user && netError === "offline" && getToken()) return <OfflineScreen onRetry={refresh} />;
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
  const { user, loading, netError, refresh } = useAuth();
  if (loading) return <Splash />;
  if (!user && netError === "offline" && getToken()) return <OfflineScreen onRetry={refresh} />;
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
                  <Route path="/notifications" element={<Notifications />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
          <NativeReady />
        </SocketProvider>
      </AuthProvider>
    </div>
  );
}

export default App;
