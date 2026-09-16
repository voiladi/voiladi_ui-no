package com.voiladi.app;

import android.Manifest;
import android.animation.ObjectAnimator;
import android.app.Activity;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Rect;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.view.PixelCopy;
import java.io.ByteArrayOutputStream;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.graphics.Insets;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * Voiladi Android shell: full-screen WebView on the production web app with
 *  - a native splash (logo) shown instantly until the web app reports ready,
 *  - a native "You're offline" screen instead of the browser error page,
 *  - a JS bridge (window.VoiladiNative) used by the web app to hand over the session token,
 *  - background polling (PollService) that posts phone notifications for new likes / matches / messages.
 */
public class MainActivity extends Activity {
    static final String HOME = "https://www.voiladi.com/";
    static final String PREFS = "voiladi";
    private static final int REQ_FILE = 1;
    private static final int REQ_LOCATION = 2;
    private static final int REQ_CAMERA = 3;
    private static final int REQ_NOTIFICATIONS = 3;
    static final int RES_ICON = R.mipmap.ic_launcher;

    private FrameLayout root;
    private WebView web;
    private View splash;
    private View offline;
    private TextView offlineTitle;
    private boolean pageFailed;
    private boolean webReady;
    private ValueCallback<Uri[]> fileCallback;
    private String geoOrigin;
    private GeolocationPermissions.Callback geoCallback;
    private PermissionRequest pendingMediaRequest;

    /* The web app tells us its theme (Settings > Dark Mode); we remember it so the very first frame, the splash,
       the status bar and the Android navigation bar are all dark when the app is in dark mode - no white strips. */
    private boolean darkMode;
    private View splashView;
    private View offlineBox;

    /** Phone-level dark mode (Settings > Display). The page asks for this when Appearance = System. */
    private boolean systemDark() {
        return (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        if (web != null) {
            web.evaluateJavascript("window.dispatchEvent(new CustomEvent('voiladi:systemtheme',{detail:{dark:" + systemDark() + "}}))", null);
        }
    }

    private boolean readDarkPref() {
        return "dark".equals(getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("theme", "light"));
    }

    /* Edge-to-edge (Android 11+): the page draws behind the transparent status + navigation bars, exactly like Instagram,
       and receives their sizes as CSS variables. Older Androids keep solid bars that follow the theme. */
    private boolean edgeToEdgeFailed;

    private boolean edgeToEdge() {
        return Build.VERSION.SDK_INT >= 30 && !edgeToEdgeFailed;
    }

    /** Page-level override: "dark" = light icons (black screens such as Discover), "" = follow the theme. */
    private String barsOverride = "";

    private boolean lightIcons() {
        if ("dark".equals(barsOverride)) return true;
        if ("light".equals(barsOverride)) return false;
        return darkMode;
    }

    private void applySystemBars() {
        Window w = getWindow();
        int bg = darkMode ? Color.BLACK : Color.WHITE;
        boolean done = false;
        if (edgeToEdge()) {
            try {
                w.setDecorFitsSystemWindows(false);
                w.setStatusBarColor(Color.TRANSPARENT);
                w.setNavigationBarColor(Color.TRANSPARENT);
                w.setNavigationBarDividerColor(Color.TRANSPARENT);
                w.setNavigationBarContrastEnforced(false);
                w.setStatusBarContrastEnforced(false);
                // PhoneWindow.getInsetsController() dereferences the decor view - make sure it exists first
                // (this was the 1.6.0 launch crash: called before setContentView, decor == null -> NPE)
                w.getDecorView();
                WindowInsetsController c = w.getInsetsController();
                if (c != null) {
                    int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                    c.setSystemBarsAppearance(lightIcons() ? 0 : mask, mask);
                }
                done = true;
            } catch (Throwable t) {
                // anything odd on this OEM build: fall back to solid themed bars instead of crashing
                edgeToEdgeFailed = true;
                try { w.setDecorFitsSystemWindows(true); } catch (Throwable ignored) {}
            }
        }
        if (!done) {
            w.setStatusBarColor(bg);
            w.setNavigationBarColor(bg);
            if (Build.VERSION.SDK_INT >= 28) w.setNavigationBarDividerColor(bg);
            int flags = 0;
            if (!lightIcons()) {
                flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                if (Build.VERSION.SDK_INT >= 26) flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            }
            w.getDecorView().setSystemUiVisibility(flags);
        }
        if (root != null) root.setBackgroundColor(bg);
        if (web != null) web.setBackgroundColor(bg);
        if (splashView != null) splashView.setBackgroundColor(bg);
        if (offlineBox != null) offlineBox.setBackgroundColor(bg);
        if (offlineTitle != null) offlineTitle.setTextColor(darkMode ? Color.WHITE : Color.parseColor("#111111"));
    }

    /** Hand the bar sizes to the page (CSS px) and make room for the keyboard ourselves (edge-to-edge disables adjustResize). */
    private void installInsetsListener() {
        if (!edgeToEdge() || root == null) return;
        root.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                try {
                    Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                    Insets ime = insets.getInsets(WindowInsets.Type.ime());
                    boolean keyboard = ime.bottom > bars.bottom;
                    // keyboard open: shrink the whole view like adjustResize would; the page's bottom inset is then 0
                    root.setPadding(0, 0, 0, keyboard ? ime.bottom : 0);
                    float d = getResources().getDisplayMetrics().density;
                    int top = Math.round(bars.top / d);
                    int bottom = keyboard ? 0 : Math.round(bars.bottom / d);
                    pushInsets(top, bottom);
                } catch (Throwable ignored) {
                }
                return WindowInsets.CONSUMED;
            }
        });
    }

    private int lastTop = -1, lastBottom = -1;

    private void pushInsets(int top, int bottom) {
        lastTop = top;
        lastBottom = bottom;
        if (web == null) return;
        try {
            web.evaluateJavascript(insetsScript(top, bottom), null);
        } catch (Throwable ignored) {
        }
    }

    private static String insetsScript(int top, int bottom) {
        return "(function(){var h=document.documentElement;h.classList.add('vo-native-insets');"
                + "h.style.setProperty('--native-inset-top','" + top + "px');"
                + "h.style.setProperty('--native-inset-bottom','" + bottom + "px');})();";
    }

    private void setDarkMode(boolean dark) {
        if (dark == darkMode) return;
        darkMode = dark;
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("theme", dark ? "dark" : "light").apply();
        applySystemBars();
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        CrashReporter.install(getApplicationContext());
        CrashReporter.flush(getApplicationContext(), SHELL_VERSION);
        darkMode = readDarkPref();
        setTheme(darkMode ? android.R.style.Theme_DeviceDefault_NoActionBar : android.R.style.Theme_DeviceDefault_Light_NoActionBar);
        super.onCreate(savedInstanceState);

        root = new FrameLayout(this);
        root.setBackgroundColor(darkMode ? Color.BLACK : Color.WHITE);
        applySystemBars();
        installInsetsListener();

        web = new WebView(this);
        setupWebView();
        root.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        offline = buildOfflineView();
        offline.setVisibility(View.GONE);
        root.addView(offline, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        splash = buildSplashView();
        root.addView(splash, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        setContentView(root);
        applySystemBars(); // decor is definitely attached now: icon style + transparent bars take effect

        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState);
        } else {
            web.loadUrl(targetUrl(getIntent()));
        }
        // safety net: never keep the splash forever
        root.postDelayed(new Runnable() {
            @Override
            public void run() {
                hideSplash();
            }
        }, 8000);

        Notifier.ensureChannel(this);
        // signed in already: make sure the API has this device's current FCM token (or fall back to polling)
        if (getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("token", null) != null) Push.register(this);
    }

    /* ---------------------------------------------------------------- web view */

    static final String SHELL_VERSION = "1.8.1";
    private static final String[] ALLOWED_HOSTS = {"voiladi.com", "www.voiladi.com", "api.voiladi.com"};

    /** Exact-host allow-list over https only (an "evilvoiladi.com" or http:// link never loads inside the app). */
    static boolean isAllowedOrigin(Uri uri) {
        if (uri == null || uri.getHost() == null) return false;
        if (!"https".equalsIgnoreCase(uri.getScheme())) return false;
        String host = uri.getHost().toLowerCase();
        for (String h : ALLOWED_HOSTS) if (h.equals(host)) return true;
        return false;
    }

    private void setupWebView() {
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        // lock the WebView to the web: no local file / content:// access, no file-URL origins
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setSaveFormData(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setGeolocationEnabled(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setUserAgentString(s.getUserAgentString() + " VoiladiApp/" + SHELL_VERSION);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        WebView.setWebContentsDebuggingEnabled(false);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setBackgroundColor(darkMode ? Color.BLACK : Color.WHITE);
        web.addJavascriptInterface(new Bridge(), "VoiladiNative");
        // file downloads (e.g. a newer voiladi.apk) are handed to the system browser / download manager
        web.setDownloadListener(new android.webkit.DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                } catch (Exception ignored) {
                }
            }
        });

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                // only our own https origins render inside the app; anything else opens in the system browser
                if (isAllowedOrigin(uri)) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {
                }
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                pageFailed = false;
            }

            @Override
            public void onPageCommitVisible(WebView view, String url) {
                if (edgeToEdge() && lastTop >= 0) view.evaluateJavascript(insetsScript(lastTop, lastBottom), null);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showOffline("You're offline", "Check your connection and try again.");
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 500) {
                    showOffline("Voiladi is unavailable", "We're having trouble reaching the server. Please try again in a moment.");
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (edgeToEdge() && lastTop >= 0) view.evaluateJavascript(insetsScript(lastTop, lastBottom), null);
                if (!pageFailed) {
                    offline.setVisibility(View.GONE);
                    // the web app calls VoiladiNative.ready() itself; this is the fallback for older builds
                    root.postDelayed(new Runnable() {
                        @Override
                        public void run() {
                            hideSplash();
                        }
                    }, 600);
                }
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), REQ_FILE);
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    callback.invoke(origin, true, false);
                    return;
                }
                geoOrigin = origin;
                geoCallback = callback;
                requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOCATION);
            }

            /* Live camera / mic for the web page (selfie verification, calls). The WebView can only use the camera once
               the app itself holds the Android CAMERA permission, so ask the system first, then grant to the page. */
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                boolean wantsCamera = false;
                boolean wantsMic = false;
                for (String r : request.getResources()) {
                    if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) wantsCamera = true;
                    if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) wantsMic = true;
                }
                if (!wantsCamera && !wantsMic) {
                    request.deny();
                    return;
                }
                java.util.ArrayList<String> need = new java.util.ArrayList<String>();
                if (wantsCamera && checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) need.add(Manifest.permission.CAMERA);
                if (wantsMic && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) need.add(Manifest.permission.RECORD_AUDIO);
                if (need.isEmpty()) {
                    request.grant(request.getResources());
                    return;
                }
                if (pendingMediaRequest != null) pendingMediaRequest.deny();
                pendingMediaRequest = request;
                requestPermissions(need.toArray(new String[0]), REQ_CAMERA);
            }
        });
    }

    /* URL to open for an intent: notification taps carry a "path" extra (e.g. /chats/123). */
    private String targetUrl(Intent intent) {
        String path = intent == null ? null : intent.getStringExtra("path");
        if (path != null && path.startsWith("/chats/")) Notifier.clearConversation(this, path.substring(7).split("[/?#]")[0]);
        if (path == null || !path.startsWith("/")) return HOME;
        return HOME.substring(0, HOME.length() - 1) + path;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String path = intent.getStringExtra("path");
        if (path != null && web != null) web.loadUrl(targetUrl(intent));
    }

    /* ---------------------------------------------------------------- splash */

    private View buildSplashView() {
        FrameLayout f = new FrameLayout(this);
        f.setBackgroundColor(darkMode ? Color.BLACK : Color.WHITE);
        f.setClickable(true);
        splashView = f;
        ImageView logo = new ImageView(this);
        logo.setImageResource(RES_ICON);
        int size = dp(96);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(size, size);
        lp.gravity = Gravity.CENTER;
        f.addView(logo, lp);
        return f;
    }

    private void hideSplash() {
        if (splash == null || splash.getVisibility() != View.VISIBLE || splash.getAlpha() < 1f) return;
        ObjectAnimator a = ObjectAnimator.ofFloat(splash, "alpha", 1f, 0f);
        a.setDuration(220);
        a.addListener(new android.animation.AnimatorListenerAdapter() {
            @Override
            public void onAnimationEnd(android.animation.Animator animation) {
                splash.setVisibility(View.GONE);
            }
        });
        a.start();
    }

    /* ---------------------------------------------------------------- offline screen */

    private View buildOfflineView() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setBackgroundColor(darkMode ? Color.BLACK : Color.WHITE);
        box.setClickable(true);
        offlineBox = box;
        int pad = dp(32);
        box.setPadding(pad, pad, pad, pad);

        ImageView logo = new ImageView(this);
        logo.setImageResource(RES_ICON);
        box.addView(logo, new LinearLayout.LayoutParams(dp(64), dp(64)));

        offlineTitle = new TextView(this);
        offlineTitle.setText("You're offline");
        offlineTitle.setTextColor(darkMode ? Color.WHITE : Color.parseColor("#111111"));
        offlineTitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 24);
        offlineTitle.setTypeface(Typeface.DEFAULT_BOLD);
        offlineTitle.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams tlp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        tlp.topMargin = dp(28);
        box.addView(offlineTitle, tlp);

        final TextView sub = new TextView(this);
        sub.setTag("sub");
        sub.setText("Check your connection and try again.");
        sub.setTextColor(Color.parseColor("#8A8A8E"));
        sub.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        sub.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams slp = new LinearLayout.LayoutParams(dp(280), LinearLayout.LayoutParams.WRAP_CONTENT);
        slp.topMargin = dp(8);
        box.addView(sub, slp);

        Button retry = new Button(this);
        retry.setText("Try again");
        retry.setAllCaps(false);
        retry.setTextColor(Color.WHITE);
        retry.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        retry.setTypeface(Typeface.DEFAULT_BOLD);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor("#111111"));
        bg.setCornerRadius(dp(999));
        retry.setBackground(bg);
        retry.setPadding(dp(28), 0, dp(28), 0);
        retry.setStateListAnimator(null);
        LinearLayout.LayoutParams blp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, dp(48));
        blp.topMargin = dp(28);
        box.addView(retry, blp);
        retry.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                pageFailed = false;
                web.loadUrl(targetUrl(getIntent()));
            }
        });
        return box;
    }

    private void showOffline(String title, String subtitle) {
        pageFailed = true;
        offlineTitle.setText(title);
        View sub = offline.findViewWithTag("sub");
        if (sub instanceof TextView) ((TextView) sub).setText(subtitle);
        offline.setVisibility(View.VISIBLE);
        hideSplash();
    }

    /* ---------------------------------------------------------------- JS bridge */

    private class Bridge {
        @JavascriptInterface
        public void setToken(String token) {
            SharedPreferences p = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            p.edit().putString("token", token).apply();
            Push.register(MainActivity.this);
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    askNotificationPermission();
                }
            });
        }

        @JavascriptInterface
        public void clearToken() {
            Push.unregister(MainActivity.this);
            getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove("token").remove("last_notified_at").apply();
            PollService.cancel(MainActivity.this);
        }

        @JavascriptInterface
        public void chatOpened(String matchId) {
            if (matchId != null && !matchId.isEmpty()) Notifier.clearConversation(MainActivity.this, matchId);
        }

        @JavascriptInterface
        public void ready() {
            webReady = true;
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    hideSplash();
                }
            });
        }

        @JavascriptInterface
        public void openSettings() {
            Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            i.putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
            startActivity(i);
        }

        @JavascriptInterface
        public boolean isNative() {
            return true;
        }

        /** Present from shell 1.4: the WebView can open the live camera (runtime permission is requested on demand). */
        @JavascriptInterface
        public boolean hasCamera() {
            return true;
        }

        /** Shell 1.5: the page reports light/dark so the status + navigation bars follow the app theme. */
        @JavascriptInterface
        public void setTheme(final String mode) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    setDarkMode("dark".equals(mode));
                }
            });
        }

        /** Shell 1.7: per-screen bar icon style ("dark" -> light icons, "" -> follow theme). */
        @JavascriptInterface
        public void setBars(final String mode) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    barsOverride = mode == null ? "" : mode;
                    applySystemBars();
                }
            });
        }

        /** Shell 1.7: the page can ask for the current insets (e.g. right after it boots). */
        @JavascriptInterface
        public String insets() {
            return "{\"top\":" + Math.max(0, lastTop) + ",\"bottom\":" + Math.max(0, lastBottom) + "}";
        }

        /** Shell 1.6: true when the phone itself is in dark mode (the WebView's own media query follows the app theme, not the phone). */
        @JavascriptInterface
        public boolean isSystemDark() {
            return systemDark();
        }

        @JavascriptInterface
        public String shellVersion() {
            return SHELL_VERSION;
        }

        /** Shell 1.7.3: exact screenshot of the app window (PixelCopy) for the orb's visual search; answered via the 'voiladi:capture' event. */
        @JavascriptInterface
        public void capture(final String id) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    captureWindow(id);
                }
            });
        }
    }

    /* ---------------------------------------------------------------- screen capture (orb visual search) */

    private void captureWindow(String rawId) {
        final String id = rawId == null ? "" : rawId.replaceAll("[^A-Za-z0-9_-]", "");
        try {
            if (Build.VERSION.SDK_INT >= 26 && web != null && web.getWidth() > 0 && web.getHeight() > 0) {
                final Bitmap bmp = Bitmap.createBitmap(web.getWidth(), web.getHeight(), Bitmap.Config.ARGB_8888);
                int[] loc = new int[2];
                web.getLocationInWindow(loc);
                Rect r = new Rect(loc[0], loc[1], loc[0] + web.getWidth(), loc[1] + web.getHeight());
                PixelCopy.request(getWindow(), r, bmp, new PixelCopy.OnPixelCopyFinishedListener() {
                    @Override
                    public void onPixelCopyFinished(int result) {
                        if (result == PixelCopy.SUCCESS) deliverCapture(id, bmp);
                        else drawCapture(id);
                    }
                }, new Handler(Looper.getMainLooper()));
                return;
            }
        } catch (Throwable t) {
            // fall back to a software draw below
        }
        drawCapture(id);
    }

    private void drawCapture(String id) {
        try {
            Bitmap bmp = Bitmap.createBitmap(web.getWidth(), web.getHeight(), Bitmap.Config.ARGB_8888);
            web.draw(new Canvas(bmp));
            deliverCapture(id, bmp);
        } catch (Throwable t) {
            deliverCapture(id, null);
        }
    }

    private void deliverCapture(final String id, final Bitmap bmp) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                String dataUrl = "";
                if (bmp != null) {
                    try {
                        Bitmap b = bmp;
                        if (b.getWidth() > 1080) {
                            float s = 1080f / b.getWidth();
                            b = Bitmap.createScaledBitmap(bmp, 1080, Math.max(1, Math.round(b.getHeight() * s)), true);
                        }
                        ByteArrayOutputStream out = new ByteArrayOutputStream();
                        b.compress(Bitmap.CompressFormat.JPEG, 80, out);
                        dataUrl = "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
                    } catch (Throwable t) {
                        dataUrl = "";
                    }
                }
                final String js = "window.dispatchEvent(new CustomEvent('voiladi:capture',{detail:{id:'" + id + "',dataUrl:'" + dataUrl + "'}}))";
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            if (web != null) web.evaluateJavascript(js, null);
                        } catch (Throwable t) {
                            // ignore
                        }
                    }
                });
            }
        }).start();
    }

    private void askNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, REQ_NOTIFICATIONS);
        }
    }

    /* ---------------------------------------------------------------- results */

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode == REQ_LOCATION && geoCallback != null) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            geoCallback.invoke(geoOrigin, granted, false);
            geoCallback = null;
            geoOrigin = null;
        }
        if (requestCode == REQ_CAMERA && pendingMediaRequest != null) {
            boolean all = grantResults.length > 0;
            for (int g : grantResults) if (g != PackageManager.PERMISSION_GRANTED) all = false;
            if (all) pendingMediaRequest.grant(pendingMediaRequest.getResources());
            else pendingMediaRequest.deny();
            pendingMediaRequest = null;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (offline.getVisibility() == View.VISIBLE) {
            super.onBackPressed();
            return;
        }
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (web != null) web.saveState(outState);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
        // the app is open: clear any pending activity notifications
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancelAll();
    }

    @Override
    protected void onPause() {
        if (web != null) web.onPause();
        super.onPause();
    }

    private int dp(int v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()));
    }
}
