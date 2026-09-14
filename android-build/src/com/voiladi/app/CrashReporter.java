package com.voiladi.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;

import java.io.OutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * If the shell ever crashes, remember the stack trace and post it to the API on the next launch so we can read it
 * from the operator side instead of guessing. No personal data: version, device, Android level, trace.
 */
final class CrashReporter {
    private static final String PREFS = "voiladi_crash";
    private static final String KEY = "trace";

    private CrashReporter() {}

    static void install(final Context ctx) {
        final Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler(new Thread.UncaughtExceptionHandler() {
            @Override
            public void uncaughtException(Thread t, Throwable e) {
                try {
                    StringWriter sw = new StringWriter();
                    e.printStackTrace(new PrintWriter(sw));
                    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, sw.toString()).commit();
                } catch (Throwable ignored) {
                }
                if (previous != null) previous.uncaughtException(t, e);
                else System.exit(2);
            }
        });
    }

    /** Send a stored trace (if any) and clear it. Runs on a background thread. */
    static void flush(final Context ctx, final String shellVersion) {
        final SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        final String trace = p.getString(KEY, null);
        if (trace == null) return;
        new Thread(new Runnable() {
            @Override
            public void run() {
                HttpURLConnection c = null;
                try {
                    String body = "{\"shell\":" + q(shellVersion) + ",\"device\":" + q(Build.MANUFACTURER + " " + Build.MODEL)
                            + ",\"android\":" + Build.VERSION.SDK_INT + ",\"trace\":" + q(trace) + "}";
                    c = (HttpURLConnection) new URL(PollService.API + "/api/shell/crash").openConnection();
                    c.setConnectTimeout(8000);
                    c.setReadTimeout(8000);
                    c.setRequestMethod("POST");
                    c.setRequestProperty("Content-Type", "application/json");
                    c.setDoOutput(true);
                    OutputStream os = c.getOutputStream();
                    os.write(body.getBytes(StandardCharsets.UTF_8));
                    os.close();
                    if (c.getResponseCode() < 500) p.edit().remove(KEY).apply();
                } catch (Throwable ignored) {
                } finally {
                    if (c != null) c.disconnect();
                }
            }
        }).start();
    }

    private static String q(String s) {
        StringBuilder b = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            switch (ch) {
                case '"': b.append("\\\""); break;
                case '\\': b.append("\\\\"); break;
                case '\n': b.append("\\n"); break;
                case '\r': b.append("\\r"); break;
                case '\t': b.append("\\t"); break;
                default:
                    if (ch < 0x20) b.append(String.format("\\u%04x", (int) ch));
                    else b.append(ch);
            }
        }
        return b.append('"').toString();
    }
}
