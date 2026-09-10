package com.voiladi.app;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Background poller: every ~15 minutes (the OS minimum) asks the API for the notifications feed with the stored
 * session token and posts a phone notification for every item newer than the last one we notified about.
 * Runs while the app is closed (persisted across reboots). Cancelled on logout.
 */
public class PollService extends JobService {
    static final String API = "https://api.voiladi.com";
    static final int JOB_ID = 7001;
    private static final int MAX_PER_RUN = 3;

    static void scheduleIfLoggedIn(Context ctx) {
        if (ctx.getSharedPreferences(MainActivity.PREFS, Context.MODE_PRIVATE).getString("token", null) != null) schedule(ctx);
    }

    static void schedule(Context ctx) {
        JobScheduler js = (JobScheduler) ctx.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js == null) return;
        if (js.getPendingJob(JOB_ID) != null) return;
        JobInfo job = new JobInfo.Builder(JOB_ID, new ComponentName(ctx, PollService.class))
                .setPeriodic(15 * 60 * 1000L)
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPersisted(true)
                .build();
        js.schedule(job);
    }

    static void cancel(Context ctx) {
        JobScheduler js = (JobScheduler) ctx.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js != null) js.cancel(JOB_ID);
    }

    @Override
    public boolean onStartJob(final JobParameters params) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    poll();
                } catch (Exception ignored) {
                }
                jobFinished(params, false);
            }
        }).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return true;
    }

    private void poll() throws Exception {
        SharedPreferences prefs = getSharedPreferences(MainActivity.PREFS, Context.MODE_PRIVATE);
        String token = prefs.getString("token", null);
        if (token == null) return;

        HttpURLConnection c = (HttpURLConnection) new URL(API + "/api/notifications").openConnection();
        c.setRequestProperty("Authorization", "Bearer " + token);
        c.setRequestProperty("Accept", "application/json");
        c.setConnectTimeout(10000);
        c.setReadTimeout(10000);
        int code = c.getResponseCode();
        if (code == 401) {
            prefs.edit().remove("token").apply();
            cancel(this);
            return;
        }
        if (code != 200) return;
        BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), "UTF-8"));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = r.readLine()) != null) sb.append(line);
        r.close();

        JSONObject body = new JSONObject(sb.toString());
        JSONArray items = body.optJSONArray("items");
        if (items == null || items.length() == 0) return;

        String last = prefs.getString("last_notified_at", null);
        if (last == null) {
            // first run after login: remember the newest item, do not replay history
            prefs.edit().putString("last_notified_at", items.getJSONObject(0).optString("created_at", "")).apply();
            return;
        }

        String newest = last;
        int posted = 0;
        int extra = 0;
        for (int i = 0; i < items.length(); i++) {
            JSONObject it = items.getJSONObject(i);
            String at = it.optString("created_at", "");
            if (at.compareTo(last) <= 0) break; // sorted newest first
            if (at.compareTo(newest) > 0) newest = at;
            if ("system".equals(it.optString("type"))) continue;
            if (posted >= MAX_PER_RUN) {
                extra++;
                continue;
            }
            String photo = null;
            JSONObject user = it.optJSONObject("user");
            if (user != null) {
                JSONArray photos = user.optJSONArray("photos");
                if (photos != null && photos.length() > 0) {
                    photo = photos.optString(0, null);
                    if (photo != null && !photo.startsWith("http")) photo = API + photo;
                }
            }
            Notifier.post(this, 1000 + (it.optString("id").hashCode() & 0xffff), it.optString("title", "Voiladi"),
                    it.optString("sub", ""), it.optString("href", "/notifications"), photo);
            posted++;
        }
        if (extra > 0) {
            Notifier.post(this, 999, "Voiladi", "You have " + extra + " more new notifications", "/notifications", null);
        }
        prefs.edit().putString("last_notified_at", newest).apply();
    }
}
