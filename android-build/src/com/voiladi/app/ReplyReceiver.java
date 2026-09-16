package com.voiladi.app;

import android.app.RemoteInput;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.util.Log;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * Inline reply from a chat notification. Reads the RemoteInput text, POSTs it to the chat with the stored session,
 * then re-posts the notification with the sent line (Android requires the notification to be updated, otherwise the
 * reply field keeps spinning). On failure the notification switches to "couldn't send - tap to open".
 */
public class ReplyReceiver extends BroadcastReceiver {
    static final String ACTION_REPLY = "com.voiladi.app.REPLY";
    private static final String TAG = "VoiladiReply";

    @Override
    public void onReceive(final Context context, Intent intent) {
        if (intent == null || !ACTION_REPLY.equals(intent.getAction())) return;
        Bundle results = RemoteInput.getResultsFromIntent(intent);
        CharSequence cs = results == null ? null : results.getCharSequence(Notifier.KEY_REPLY);
        final String text = cs == null ? "" : cs.toString().trim();
        final String matchId = intent.getStringExtra("match_id");
        final String senderName = intent.getStringExtra("sender_name") == null ? "Voiladi" : intent.getStringExtra("sender_name");
        final String photo = intent.getStringExtra("photo");
        if (text.isEmpty() || matchId == null) return;

        final SharedPreferences p = context.getSharedPreferences(MainActivity.PREFS, Context.MODE_PRIVATE);
        final String jwt = p.getString("token", null);
        if (jwt == null) {
            Notifier.postReplyFailed(context, matchId, senderName, "You're signed out.");
            return;
        }
        final PendingResult pending = goAsync();
        final Context app = context.getApplicationContext();
        new Thread(new Runnable() {
            @Override
            public void run() {
                String[] res = send(jwt, matchId, text);
                int code = Integer.parseInt(res[0]);
                if (code >= 200 && code < 300) {
                    Notifier.postMessage(app, matchId, senderName, text, photo, true);
                } else {
                    Log.w(TAG, "reply failed " + code);
                    Notifier.postReplyFailed(app, matchId, senderName, res[1]);
                }
                pending.finish();
            }
        }).start();
    }

    /** Returns {statusCode, serverDetailOrNull}. */
    private static String[] send(String jwt, String matchId, String text) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(PollService.API + "/api/matches/" + matchId + "/messages").openConnection();
            c.setRequestMethod("POST");
            c.setConnectTimeout(10000);
            c.setReadTimeout(15000);
            c.setRequestProperty("Authorization", "Bearer " + jwt);
            c.setRequestProperty("Content-Type", "application/json");
            c.setRequestProperty("User-Agent", "VoiladiApp/" + MainActivity.SHELL_VERSION);
            c.setDoOutput(true);
            String body = "{\"text\":" + json(text) + ",\"client_id\":" + json("notif-" + UUID.randomUUID()) + "}";
            OutputStream out = c.getOutputStream();
            out.write(body.getBytes(StandardCharsets.UTF_8));
            out.close();
            int code = c.getResponseCode();
            String detail = null;
            if (code >= 400 && c.getErrorStream() != null) {
                java.io.InputStream in = c.getErrorStream();
                byte[] buf = new byte[4096];
                int n = in.read(buf);
                in.close();
                if (n > 0) {
                    String err = new String(buf, 0, n, StandardCharsets.UTF_8);
                    int i = err.indexOf("\"detail\":\"");
                    if (i >= 0) {
                        int j = err.indexOf('"', i + 10);
                        if (j > i) detail = err.substring(i + 10, j);
                    }
                }
            }
            return new String[]{String.valueOf(code), detail};
        } catch (Exception e) {
            Log.w(TAG, "send failed", e);
            return new String[]{"-1", null};
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private static String json(String s) {
        StringBuilder b = new StringBuilder("\"");
        for (char ch : s.toCharArray()) {
            if (ch == '"' || ch == '\\') b.append('\\').append(ch);
            else if (ch == '\n') b.append("\\n");
            else if (ch < 0x20) b.append(String.format("\\u%04x", (int) ch));
            else b.append(ch);
        }
        return b.append('"').toString();
    }
}
