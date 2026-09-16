package com.voiladi.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Person;
import android.app.RemoteInput;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.drawable.Icon;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.Rect;
import android.os.Build;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Posts phone notifications for Voiladi activity. */
final class Notifier {
    static final String CHANNEL = "voiladi_activity";
    static final int RES_SMALL_ICON = R.mipmap.ic_notification; // white V silhouette

    private Notifier() {
    }

    static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Likes, matches & messages", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("New activity on Voiladi");
        ch.enableVibration(true);
        nm.createNotificationChannel(ch);
    }

    static final String KEY_REPLY = "reply";
    private static final int MAX_LINES = 8;

    static int idFor(String tag) {
        return tag.hashCode();
    }

    /** Conversation notification for a chat: MessagingStyle history + inline "Reply" (RemoteInput) + open-on-tap. */
    static void postMessage(Context ctx, String matchId, String senderName, String text, String photoUrl, boolean fromMe) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || matchId == null) return;
        int id = idFor("chat-" + matchId);
        String path = "/chats/" + matchId;

        // remember the last few lines so the bubble shows the conversation across pushes / replies
        SharedPreferences p = ctx.getSharedPreferences(MainActivity.PREFS, Context.MODE_PRIVATE);
        String key = "conv_" + matchId;
        String hist = p.getString(key, "");
        String line = (fromMe ? "M" : "S") + "\u0001" + text.replace("\u0002", " ").replace("\u0001", " ");
        String[] lines = hist.isEmpty() ? new String[0] : hist.split("\u0002");
        StringBuilder sb = new StringBuilder();
        int start = Math.max(0, lines.length - (MAX_LINES - 1));
        for (int i = start; i < lines.length; i++) sb.append(lines[i]).append("\u0002");
        sb.append(line);
        p.edit().putString(key, sb.toString()).putString("conv_name_" + matchId, senderName).putString("conv_photo_" + matchId, photoUrl == null ? "" : photoUrl).apply();

        Intent open = new Intent(ctx, MainActivity.class);
        open.setAction(Intent.ACTION_MAIN);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        open.putExtra("path", path);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent openPi = PendingIntent.getActivity(ctx, id, open, piFlags);

        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(ctx, CHANNEL) : new Notification.Builder(ctx);
        Bitmap avatar = circle(fetch(photoUrl));
        b.setSmallIcon(RES_SMALL_ICON)
                .setContentTitle(senderName)
                .setContentText(fromMe ? "You: " + text : text)
                .setAutoCancel(true)
                .setContentIntent(openPi)
                .setColor(0xFF111111)
                .setCategory(Notification.CATEGORY_MESSAGE)
                .setGroup("voiladi")
                .setOnlyAlertOnce(fromMe);
        if (avatar != null) b.setLargeIcon(avatar);

        if (Build.VERSION.SDK_INT >= 28) {
            Person me = new Person.Builder().setName("You").build();
            Person.Builder them = new Person.Builder().setName(senderName).setKey(matchId);
            if (avatar != null) them.setIcon(Icon.createWithBitmap(avatar));
            Person other = them.build();
            Notification.MessagingStyle style = new Notification.MessagingStyle(me).setGroupConversation(false);
            for (String l : sb.toString().split("\u0002")) {
                int sep = l.indexOf('\u0001');
                if (sep < 1) continue;
                boolean mine = l.charAt(0) == 'M';
                style.addMessage(new Notification.MessagingStyle.Message(l.substring(sep + 1), System.currentTimeMillis(), mine ? null : other));
            }
            b.setStyle(style);
        } else {
            b.setStyle(new Notification.BigTextStyle().bigText(fromMe ? "You: " + text : text));
        }

        // inline reply: RemoteInput -> ReplyReceiver -> POST /api/matches/{id}/messages
        Intent reply = new Intent(ctx, ReplyReceiver.class);
        reply.setAction(ReplyReceiver.ACTION_REPLY);
        reply.putExtra("match_id", matchId);
        reply.putExtra("sender_name", senderName);
        reply.putExtra("photo", photoUrl);
        int replyFlags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
        PendingIntent replyPi = PendingIntent.getBroadcast(ctx, id, reply, replyFlags);
        RemoteInput input = new RemoteInput.Builder(KEY_REPLY).setLabel("Reply to " + senderName.split(" ")[0]).build();
        Notification.Action action = new Notification.Action.Builder(Icon.createWithResource(ctx, RES_SMALL_ICON), "Reply", replyPi)
                .addRemoteInput(input)
                .setAllowGeneratedReplies(true)
                .build();
        if (Build.VERSION.SDK_INT >= 29) {
            action = new Notification.Action.Builder(Icon.createWithResource(ctx, RES_SMALL_ICON), "Reply", replyPi)
                    .addRemoteInput(input)
                    .setAllowGeneratedReplies(true)
                    .setSemanticAction(Notification.Action.SEMANTIC_ACTION_REPLY)
                    .build();
        }
        b.addAction(action);
        if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_HIGH).setDefaults(fromMe ? 0 : Notification.DEFAULT_ALL);
        nm.notify(id, b.build());
    }

    /** Replace the chat notification with a short "couldn't send" state (tap opens the chat). */
    static void postReplyFailed(Context ctx, String matchId, String senderName, String reason) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        int id = idFor("chat-" + matchId);
        Intent open = new Intent(ctx, MainActivity.class);
        open.setAction(Intent.ACTION_MAIN);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        open.putExtra("path", "/chats/" + matchId);
        PendingIntent pi = PendingIntent.getActivity(ctx, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(ctx, CHANNEL) : new Notification.Builder(ctx);
        b.setSmallIcon(RES_SMALL_ICON).setContentTitle(senderName).setContentText((reason == null || reason.isEmpty() ? "Couldn't send your reply." : reason) + " Tap to open the chat.")
                .setAutoCancel(true).setContentIntent(pi).setColor(0xFF111111).setCategory(Notification.CATEGORY_MESSAGE).setGroup("voiladi").setOnlyAlertOnce(true);
        nm.notify(id, b.build());
    }

    static void clearConversation(Context ctx, String matchId) {
        ctx.getSharedPreferences(MainActivity.PREFS, Context.MODE_PRIVATE).edit().remove("conv_" + matchId).remove("conv_name_" + matchId).remove("conv_photo_" + matchId).apply();
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(idFor("chat-" + matchId));
    }

    static void post(Context ctx, int id, String title, String text, String path, String photoUrl) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        Intent open = new Intent(ctx, MainActivity.class);
        open.setAction(Intent.ACTION_MAIN);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        open.putExtra("path", path == null ? "/notifications" : path);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) piFlags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pi = PendingIntent.getActivity(ctx, id, open, piFlags);

        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(ctx, CHANNEL) : new Notification.Builder(ctx);
        b.setSmallIcon(RES_SMALL_ICON)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setAutoCancel(true)
                .setContentIntent(pi)
                .setColor(0xFF111111)
                .setCategory(Notification.CATEGORY_SOCIAL)
                .setGroup("voiladi");
        if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);
        Bitmap avatar = circle(fetch(photoUrl));
        if (avatar != null) b.setLargeIcon(avatar);
        nm.notify(id, b.build());
    }

    private static Bitmap fetch(String url) {
        if (url == null || url.isEmpty()) return null;
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(6000);
            c.setReadTimeout(6000);
            InputStream in = c.getInputStream();
            Bitmap raw = BitmapFactory.decodeStream(in);
            in.close();
            if (raw == null) return null;
            int side = Math.min(raw.getWidth(), raw.getHeight());
            Bitmap sq = Bitmap.createBitmap(raw, (raw.getWidth() - side) / 2, (raw.getHeight() - side) / 2, side, side);
            return Bitmap.createScaledBitmap(sq, 192, 192, true);
        } catch (Exception e) {
            return null;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private static Bitmap circle(Bitmap src) {
        if (src == null) return null;
        Bitmap out = Bitmap.createBitmap(src.getWidth(), src.getHeight(), Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(out);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        canvas.drawCircle(src.getWidth() / 2f, src.getHeight() / 2f, src.getWidth() / 2f, paint);
        paint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));
        canvas.drawBitmap(src, new Rect(0, 0, src.getWidth(), src.getHeight()), new Rect(0, 0, src.getWidth(), src.getHeight()), paint);
        return out;
    }
}
