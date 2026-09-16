package com.voiladi.app;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Firebase Cloud Messaging entry point.
 *  - onNewToken: Google rotated the device token -> hand it to the API for the signed-in user.
 *  - onMessageReceived: the API sends DATA messages (never "notification" ones) so we always draw the notification
 *    ourselves (avatar, deep link) whether the app is in the foreground, background or killed.
 *    Data keys: kind, title, body, path (in-app route), photo (avatar url), tag (collapse key).
 */
public class PushService extends FirebaseMessagingService {
    @Override
    public void onNewToken(String token) {
        Push.onToken(getApplicationContext(), token);
    }

    @Override
    public void onMessageReceived(RemoteMessage message) {
        Map<String, String> d = message.getData();
        if (d == null || d.isEmpty()) return;
        String title = d.get("title");
        String body = d.get("body");
        if (title == null && body == null) return;
        String path = d.get("path");
        String photo = d.get("photo");
        String tag = d.get("tag");
        String matchId = d.get("match_id");
        if ("message".equals(d.get("kind")) && matchId != null) {
            Notifier.postMessage(getApplicationContext(), matchId, title == null ? "Voiladi" : title, body == null ? "" : body, photo, false);
            return;
        }
        int id = tag != null ? tag.hashCode() : (int) (System.currentTimeMillis() & 0x7fffffff);
        Notifier.post(getApplicationContext(), id, title == null ? "Voiladi" : title, body == null ? "" : body, path, photo);
    }
}
