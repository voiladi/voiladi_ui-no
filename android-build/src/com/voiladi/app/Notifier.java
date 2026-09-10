package com.voiladi.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
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
    static final int RES_SMALL_ICON = 0x7f010001; // mipmap/ic_notification (white V silhouette)

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
