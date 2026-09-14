package com.voiladi.app;

import android.Manifest;
import android.animation.ObjectAnimator;
import android.app.Activity;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
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
    static final int RES_ICON = 0x7f010000;

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

    private boolean readDarkPref() {
        return "dark".equals(getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("theme", "light"));
    }

    private void applySystemBars() {
        Window w = getWindow();
        int bg = darkMode ? Color.BLACK : Color.WHITE;
        w.setStatusBarColor(bg);
        w.setNavigationBarColor(bg);
        if (Build.VERSION.SDK_INT >= 28) w.setNavigationBarDividerColor(bg);
        int flags = 0;
        if (!darkMode) {
            flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            if (Build.VERSION.SDK_INT >= 26) flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        }
        w.getDecorView().setSystemUiVisibility(flags);
        if (root != null) root.setBackgroundColor(bg);
        if (web != null) web.setBackgroundColor(bg);
        if (splashView != null) splashView.setBackgroundColor(bg);
        if (offlineBox != null) offlineBox.setBackgroundColor(bg);
        if (offlineTitle != null) offlineTitle.setTextColor(darkMode ? Color.WHITE : Color.parseColor("#111111"));
    }

    private void setDarkMode(boolean dark) {
        if (dark == darkMode) return;
        darkMode = dark;
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("theme", dark ? "dark" : "light").apply();
        applySystemBars();
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        darkMode = readDarkPref();
        setTheme(darkMode ? android.R.style.Theme_DeviceDefault_NoActionBar : android.R.style.Theme_DeviceDefault_Light_NoActionBar);
        super.onCreate(savedInstanceState);

        root = new FrameLayout(this);
        root.setBackgroundColor(darkMode ? Color.BLACK : Color.WHITE);
        applySystemBars();

        web = new WebView(this);
        setupWebView();
        root.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        offline = buildOfflineView();
        offline.setVisibility(View.GONE);
        root.addView(offline, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        splash = buildSplashView();
        root.addView(splash, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        setContentView(root);

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
        PollService.scheduleIfLoggedIn(this);
    }

    /* ---------------------------------------------------------------- web view */

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
        s.setUserAgentString(s.getUserAgentString() + " VoiladiApp/1.5");
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
            PollService.schedule(MainActivity.this);
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    askNotificationPermission();
                }
            });
        }

        @JavascriptInterface
        public void clearToken() {
            getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove("token").remove("last_notified_at").apply();
            PollService.cancel(MainActivity.this);
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

        @JavascriptInterface
        public String shellVersion() {
            return "1.5";
        }
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
