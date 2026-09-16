package com.voiladi.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.GoogleApiAvailabilityLight;
import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.Task;
import com.google.firebase.messaging.FirebaseMessaging;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Keeps the API in sync with this device's FCM token.
 *  register()   after login (JS bridge setToken)  -> fetch token, POST /api/push/tokens
 *  unregister() on logout (JS bridge clearToken) -> DELETE /api/push/tokens (so a logged-out phone stops buzzing)
 *  onToken()    from PushService.onNewToken      -> re-upload if someone is signed in
 * Phones without Google Play services fall back to the 15-minute PollService.
 */
final class Push {
    private static final String TAG = "VoiladiPush";
    private static final String API = PollService.API;
    private static final String KEY_FCM = "fcm_token";

    private Push() {
    }

    static boolean available(Context ctx) {
        try {
            return GoogleApiAvailabilityLight.getInstance().isGooglePlayServicesAvailable(ctx) == ConnectionResult.SUCCESS;
        } catch (Throwable t) {
            return false;
        }
    }

    static void register(final Context ctx) {
        if (!available(ctx)) {
            Log.w(TAG, "Play services unavailable - using poll fallback");
            PollService.schedule(ctx);
            return;
        }
        PollService.cancel(ctx);
        try {
            FirebaseMessaging.getInstance().getToken().addOnCompleteListener(new OnCompleteListener<String>() {
                @Override
                public void onComplete(Task<String> task) {
                    if (task.isSuccessful() && task.getResult() != null) {
                        onToken(ctx, task.getResult());
                    } else {
                        Log.w(TAG, "getToken failed", task.getException());
                        PollService.schedule(ctx);
                    }
                }
            });
        } catch (Throwable t) {
            Log.w(TAG, "FirebaseMessaging unavailable", t);
            PollService.schedule(ctx);
        }
    }

    static void onToken(final Context ctx, final String fcmToken) {
        final SharedPreferences p = ctx.getSharedPreferences(MainActivity.PREFS, Context.MODE_PRIVATE);
        p.edit().putString(KEY_FCM, fcmToken).apply();
        final String jwt = p.getString("token", null);
        if (jwt == null || fcmToken == null) return;
        new Thread(new Runnable() {
            @Override
            public void run() {
                String body = "{\"token\":" + json(fcmToken) + ",\"platform\":\"android\",\"device\":" + json(Build.MANUFACTURER + " " + Build.MODEL)
                        + ",\"app_version\":" + json(MainActivity.SHELL_VERSION) + "}";
                int code = call("POST", "/api/push/tokens", jwt, body);
                Log.i(TAG, "token upload -> " + code);
            }
        }).start();
    }

    static void unregister(final Context ctx) {
        final SharedPreferences p = ctx.getSharedPreferences(MainActivity.PREFS, Context.MODE_PRIVATE);
        final String jwt = p.getString("token", null);
        final String fcmToken = p.getString(KEY_FCM, null);
        if (jwt == null || fcmToken == null) return;
        new Thread(new Runnable() {
            @Override
            public void run() {
                int code = call("DELETE", "/api/push/tokens", jwt, "{\"token\":" + json(fcmToken) + "}");
                Log.i(TAG, "token delete -> " + code);
            }
        }).start();
    }

    private static int call(String method, String path, String jwt, String body) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(API + path).openConnection();
            c.setRequestMethod(method);
            c.setConnectTimeout(10000);
            c.setReadTimeout(10000);
            c.setRequestProperty("Authorization", "Bearer " + jwt);
            c.setRequestProperty("Content-Type", "application/json");
            c.setRequestProperty("User-Agent", "VoiladiApp/" + MainActivity.SHELL_VERSION);
            c.setDoOutput(true);
            OutputStream out = c.getOutputStream();
            out.write(body.getBytes(StandardCharsets.UTF_8));
            out.close();
            return c.getResponseCode();
        } catch (Exception e) {
            Log.w(TAG, method + " " + path + " failed", e);
            return -1;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private static String json(String s) {
        StringBuilder b = new StringBuilder("\"");
        for (char ch : s.toCharArray()) {
            if (ch == '"' || ch == '\\') b.append('\\').append(ch);
            else if (ch < 0x20) b.append(String.format("\\u%04x", (int) ch));
            else b.append(ch);
        }
        return b.append('"').toString();
    }
}
