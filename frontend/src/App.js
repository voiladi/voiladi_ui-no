import React, { lazy, Suspense, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { SocketProvider } from "@/context/SocketContext";
import { AppShell } from "@/components/AppShell";
import { LogoMark } from "@/components/Logo";
import { Spinner } from "@/components/Loading";
import { OfflineScreen } from "@/components/Offline";
import { nativeReady, isNativeApp } from "@/lib/native";
import { FeedbackLayer } from "@/components/Feedback";
import { getToken } from "@/lib/api";

/*
 * Every screen is its own chunk: the first paint only needs the shell, and each screen loads when first opened.
 * If a chunk fails to load (typically a stale tab after a deploy renamed the files), reload the page once.
 */
const CHUNK_KEY = "voiladi_chunk_reload";
const screen = (load) =>
  lazy(() =>
    load()
      .then((m) => {
        sessionStorage.removeItem(CHUNK_KEY);
        return m;
      })
      .catch((e) => {
        const key = CHUNK_KEY;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "1");
          window.location.reload();
          return new Promise(() => {});
        }
        throw e;
      }),
  );
const Landing = screen(() => import("@/pages/Landing"));
const Welcome = screen(() => import("@/pages/Welcome"));
const Signup = screen(() => import("@/pages/Signup"));
const Login = screen(() => import("@/pages/Login"));
const PhoneLogin = screen(() => import("@/pages/PhoneLogin"));
const Onboarding = screen(() => import("@/pages/Onboarding"));
const Discover = screen(() => import("@/pages/Discover"));
const Explore = screen(() => import("@/pages/Explore"));
const Likes = screen(() => import("@/pages/Likes"));
const Chats = screen(() => import("@/pages/Chats"));
const ChatRoom = screen(() => import("@/pages/ChatRoom"));
const Profile = screen(() => import("@/pages/Profile"));
const EditProfile = screen(() => import("@/pages/EditProfile"));
const Filters = screen(() => import("@/pages/Filters"));
const Settings = screen(() => import("@/pages/Settings"));
const VerificationSettings = screen(() => import("@/pages/settings/Verification"));
const ChangeEmail = screen(() => import("@/pages/settings/ChangeEmail"));
const ChangePhone = screen(() => import("@/pages/settings/ChangePhone"));
const Notifications = screen(() => import("@/pages/Notifications"));
const Legal = screen(() => import("@/pages/Legal"));
const Verify = screen(() => import("@/pages/Verify"));
const AdminVerify = screen(() => import("@/pages/AdminVerify"));

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
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (need === "onboarding") {
    if (complete) return <Navigate to="/discover" replace />;
    return <Outlet />;
  }
  if (!complete) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
};

/*
 * voiladi.com root. Signed-out visitors in a browser get the public landing page (full-width web layout, outside the
 * phone shell); the Android shell skips straight to /login. Signed-in people go to the app.
 */
const LandingRoute = () => (
  <Suspense fallback={<Splash />}>
    <Landing />
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[300] mx-auto w-full max-w-[560px] [&>*]:pointer-events-auto">
      <FeedbackLayer />
    </div>
  </Suspense>
);

const Home = () => {
  const { user, loading, netError, refresh } = useAuth();
  if (loading) return <Splash />;
  if (!user && netError === "offline" && getToken()) return <OfflineScreen onRetry={refresh} />;
  if (!user) return isNativeApp() ? <Navigate to="/login" replace /> : <LandingRoute />;
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
                  <Route path="/login" element={<Welcome />} />
                  <Route path="/welcome" element={<Navigate to="/login" replace />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/login/email" element={<Login />} />
                  <Route path="/login/phone" element={<PhoneLogin />} />
                  <Route path="/auth" element={<Navigate to="/login/email" replace />} />
                </Route>
              </Route>
              <Route element={<AppShell nav={false} />}>
                <Route path="/legal/:page" element={<Legal />} />
                <Route path="/admin/verify" element={<AdminVerify />} />
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
                  <Route path="/settings/verification" element={<VerificationSettings />} />
                  <Route path="/settings/email" element={<ChangeEmail />} />
                  <Route path="/settings/phone" element={<ChangePhone />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/verify" element={<Verify />} />
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
