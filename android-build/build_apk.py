"""Build the Voiladi Android APK without Gradle.

Pipeline (aapt2 is the x86-64 build from Google Maven, run through qemu-user on this aarch64 host):
  1. unpack every AAR/JAR in libs/ (Firebase Cloud Messaging + its runtime dependencies, fetched by fetch_deps.py)
  2. generate res/values/firebase.xml from firebase/google-services.json (what the google-services Gradle plugin does),
     the launcher + status-bar icons, and the merged text AndroidManifest.xml (our components + the libraries' components)
  3. aapt2 compile (app res + each library's res) -> aapt2 link (binary manifest + resources.arsc + R.java for app and libs)
  4. javac (our sources + R.java, classpath = library jars) -> d8 (everything) -> classes*.dex
  5. assemble, 4-byte align, sign (release keystore from android-build/release.env when configured)
"""
import json
import os
import shutil
import struct
import subprocess
import zipfile
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
SDK = os.path.join(ROOT, "sdk")
BT = os.path.join(SDK, "android-14")
ANDROID_JAR = os.path.join(SDK, "platform", "android-34", "android.jar")
AAPT2 = os.path.join(SDK, "aapt2-x86", "aapt2")
LIBS = os.path.join(ROOT, "libs")
OUT = os.path.join(ROOT, "out")
PKG = "com.voiladi.app"
VERSION_CODE = int(os.environ.get("VERSION_CODE", "2"))
VERSION_NAME = os.environ.get("VERSION_NAME", "1.1.0")
ICON_SRC = os.path.join(ROOT, "..", "frontend", "public", "icon-512.png")
GOOGLE_SERVICES = os.path.join(ROOT, "firebase", "google-services.json")

# ComponentRegistrars discovered by Firebase at startup. Only the Java ones: the *Ktx* registrars need kotlinx-coroutines,
# which we deliberately don't ship (FirebaseApp adds FirebaseCommonRegistrar/ExecutorsRegistrar itself).
FIREBASE_REGISTRARS = [
    "com.google.firebase.messaging.FirebaseMessagingRegistrar",
    "com.google.firebase.installations.FirebaseInstallationsRegistrar",
    "com.google.firebase.datatransport.TransportRegistrar",
]


def run(cmd, **kw):
    print("+", " ".join(str(c) for c in cmd))
    subprocess.run(cmd, check=True, **kw)


def aapt2(*args):
    if os.path.exists("/usr/bin/qemu-x86_64-static") and os.uname().machine != "x86_64":
        run(["/usr/bin/qemu-x86_64-static", AAPT2] + list(args))
    else:
        run([AAPT2] + list(args))


# ------------------------------------------------------------------ libraries
def unpack_libs():
    """Returns (jars, res_dirs, lib_packages)."""
    work = os.path.join(OUT, "libs")
    shutil.rmtree(work, ignore_errors=True)
    os.makedirs(work)
    jars, res_dirs, packages = [], [], []
    for fn in sorted(os.listdir(LIBS)):
        path = os.path.join(LIBS, fn)
        if fn.endswith(".jar"):
            jars.append(path)
        elif fn.endswith(".aar"):
            dst = os.path.join(work, fn[:-4])
            with zipfile.ZipFile(path) as z:
                z.extractall(dst)
            cj = os.path.join(dst, "classes.jar")
            if os.path.exists(cj):
                jars.append(cj)
            inner = os.path.join(dst, "libs")
            if os.path.isdir(inner):
                jars += [os.path.join(inner, j) for j in sorted(os.listdir(inner)) if j.endswith(".jar")]
            res = os.path.join(dst, "res")
            if os.path.isdir(res) and any(os.scandir(res)):
                res_dirs.append(res)
            man = os.path.join(dst, "AndroidManifest.xml")
            if os.path.exists(man):
                import re
                m = re.search(r'package="([^"]+)"', open(man, encoding="utf-8").read())
                if m:
                    packages.append(m.group(1))
    return jars, res_dirs, packages


def dedupe_jars(jars):
    """d8 refuses duplicate classes: drop jars whose classes are all already provided (annotation/collection wrappers)."""
    seen, keep = set(), []
    for j in jars:
        with zipfile.ZipFile(j) as z:
            names = [n for n in z.namelist() if n.endswith(".class") and not n.startswith("META-INF/")]
        fresh = [n for n in names if n not in seen]
        if not names or fresh:
            keep.append(j)
            seen.update(names)
        else:
            print("  skipping duplicate jar", os.path.basename(j))
    return keep


# ------------------------------------------------------------------ resources
def write_app_res():
    res = os.path.join(OUT, "res")
    shutil.rmtree(res, ignore_errors=True)
    os.makedirs(os.path.join(res, "mipmap"))
    os.makedirs(os.path.join(res, "values"))
    Image.open(ICON_SRC).convert("RGBA").resize((192, 192), Image.LANCZOS).save(os.path.join(res, "mipmap", "ic_launcher.png"))
    make_small_icon(os.path.join(res, "mipmap", "ic_notification.png"))

    gs = json.load(open(GOOGLE_SERVICES))
    client = next(c for c in gs["client"] if c["client_info"]["android_client_info"]["package_name"] == PKG)
    values = {
        "google_app_id": client["client_info"]["mobilesdk_app_id"],
        "gcm_defaultSenderId": gs["project_info"]["project_number"],
        "google_api_key": client["api_key"][0]["current_key"],
        "google_crash_reporting_api_key": client["api_key"][0]["current_key"],
        "project_id": gs["project_info"]["project_id"],
    }
    if gs["project_info"].get("storage_bucket"):
        values["google_storage_bucket"] = gs["project_info"]["storage_bucket"]
    xml = ['<?xml version="1.0" encoding="utf-8"?>', "<resources>", '    <string name="app_name">Voiladi</string>',
           '    <color name="notification_accent">#111111</color>']
    for k, v in values.items():
        xml.append(f'    <string name="{k}" translatable="false">{v}</string>')
    xml.append("</resources>")
    with open(os.path.join(res, "values", "values.xml"), "w", encoding="utf-8") as f:
        f.write("\n".join(xml) + "\n")
    return res


def make_small_icon(path, size=96):
    """Status-bar icon: the two V strokes in white on a transparent canvas (Android tints by alpha)."""
    from PIL import ImageDraw
    S = size * 4
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def stroke(p1, p2, w, a):
        (x1, y1), (x2, y2) = [(p[0] * S / 100, p[1] * S / 100) for p in (p1, p2)]
        w = w * S / 100
        d.line((x1, y1, x2, y2), fill=(255, 255, 255, a), width=int(w))
        for (x, y) in ((x1, y1), (x2, y2)):
            d.ellipse((x - w / 2, y - w / 2, x + w / 2, y + w / 2), fill=(255, 255, 255, a))

    stroke((78, 18), (56, 66), 15, 150)
    stroke((22, 18), (47, 80), 19, 255)
    img.resize((size, size), Image.LANCZOS).save(path)


# ------------------------------------------------------------------ manifest
def build_manifest_xml():
    perms = ["android.permission.INTERNET", "android.permission.ACCESS_NETWORK_STATE", "android.permission.ACCESS_FINE_LOCATION",
             "android.permission.ACCESS_COARSE_LOCATION", "android.permission.CAMERA", "android.permission.RECORD_AUDIO",
             "android.permission.MODIFY_AUDIO_SETTINGS", "android.permission.POST_NOTIFICATIONS", "android.permission.RECEIVE_BOOT_COMPLETED",
             "android.permission.VIBRATE", "android.permission.WAKE_LOCK", "com.google.android.c2dm.permission.RECEIVE",
             f"{PKG}.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION"]
    registrars = "\n".join(
        f'            <meta-data android:name="com.google.firebase.components:{r}" android:value="com.google.firebase.components.ComponentRegistrar" />'
        for r in FIREBASE_REGISTRARS)
    uses = "\n".join(f'    <uses-permission android:name="{p}" />' for p in perms)
    return f'''<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="{PKG}"
    android:versionCode="{VERSION_CODE}"
    android:versionName="{VERSION_NAME}">

    <uses-sdk android:minSdkVersion="24" android:targetSdkVersion="34" />

{uses}
    <permission android:name="{PKG}.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION" android:protectionLevel="signature" />

    <application
        android:name="{PKG}.VoiladiApp"
        android:appComponentFactory="androidx.core.app.CoreComponentFactory"
        android:label="@string/app_name"
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher"
        android:theme="@android:style/Theme.DeviceDefault.Light.NoActionBar"
        android:allowBackup="false"
        android:hardwareAccelerated="true"
        android:supportsRtl="true"
        android:usesCleartextTraffic="false">

        <activity
            android:name="{PKG}.MainActivity"
            android:theme="@android:style/Theme.DeviceDefault.Light.NoActionBar"
            android:exported="true"
            android:launchMode="singleTask"
            android:screenOrientation="portrait"
            android:configChanges="orientation|keyboardHidden|screenSize|smallestScreenSize|uiMode|screenLayout"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- 15-minute fallback poller (only scheduled when Google Play services / FCM are unavailable) -->
        <service
            android:name="{PKG}.PollService"
            android:permission="android.permission.BIND_JOB_SERVICE"
            android:exported="true" />

        <!-- our FCM receiver: tokens + data messages -->
        <service
            android:name="{PKG}.PushService"
            android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>

        <!-- inline "Reply" from a chat notification -->
        <receiver
            android:name="{PKG}.ReplyReceiver"
            android:exported="false">
            <intent-filter>
                <action android:name="com.voiladi.app.REPLY" />
            </intent-filter>
        </receiver>

        <!-- ===== merged from the Firebase / Play services libraries ===== -->
        <meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="voiladi_activity" />
        <meta-data android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@mipmap/ic_notification" />
        <meta-data android:name="com.google.firebase.messaging.default_notification_color" android:resource="@color/notification_accent" />
        <meta-data android:name="com.google.android.gms.version" android:value="@integer/google_play_services_version" />

        <provider
            android:name="com.google.firebase.provider.FirebaseInitProvider"
            android:authorities="{PKG}.firebaseinitprovider"
            android:directBootAware="true"
            android:exported="false"
            android:initOrder="100" />

        <service
            android:name="com.google.firebase.components.ComponentDiscoveryService"
            android:directBootAware="true"
            android:exported="false">
{registrars}
        </service>

        <receiver
            android:name="com.google.firebase.iid.FirebaseInstanceIdReceiver"
            android:exported="true"
            android:permission="com.google.android.c2dm.permission.SEND">
            <intent-filter>
                <action android:name="com.google.android.c2dm.intent.RECEIVE" />
            </intent-filter>
            <meta-data android:name="com.google.android.gms.cloudmessaging.FINISHED_AFTER_HANDLED" android:value="true" />
        </receiver>

        <service
            android:name="com.google.firebase.messaging.FirebaseMessagingService"
            android:directBootAware="true"
            android:exported="false">
            <intent-filter android:priority="-500">
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>

        <activity
            android:name="com.google.android.gms.common.api.GoogleApiActivity"
            android:theme="@android:style/Theme.Translucent.NoTitleBar"
            android:exported="false" />

        <service
            android:name="com.google.android.datatransport.runtime.backends.TransportBackendDiscovery"
            android:exported="false">
            <meta-data android:name="backend:com.google.android.datatransport.cct.CctBackendFactory" android:value="cct" />
        </service>
        <service
            android:name="com.google.android.datatransport.runtime.scheduling.jobscheduling.JobInfoSchedulerService"
            android:exported="false"
            android:permission="android.permission.BIND_JOB_SERVICE" />
        <receiver
            android:name="com.google.android.datatransport.runtime.scheduling.jobscheduling.AlarmManagerSchedulerBroadcastReceiver"
            android:exported="false" />
    </application>
</manifest>
'''


# ------------------------------------------------------------------ build
def main():
    os.makedirs(OUT, exist_ok=True)
    for d in ("classes", "compiled", "gen", "dex"):
        shutil.rmtree(os.path.join(OUT, d), ignore_errors=True)
        os.makedirs(os.path.join(OUT, d))

    jars, lib_res, lib_packages = unpack_libs()
    jars = dedupe_jars(jars)
    print(len(jars), "library jars,", len(lib_res), "library res dirs")

    # 1) resources
    app_res = write_app_res()
    compiled = []
    for i, res in enumerate([app_res] + lib_res):
        out_zip = os.path.join(OUT, "compiled", f"res{i}.zip")
        aapt2("compile", "--dir", res, "-o", out_zip)
        compiled.append(out_zip)

    manifest = os.path.join(OUT, "AndroidManifest.xml")
    with open(manifest, "w", encoding="utf-8") as f:
        f.write(build_manifest_xml())

    base = os.path.join(OUT, "base.apk")
    if os.path.exists(base):
        os.remove(base)
    aapt2("link", "-o", base, "--manifest", manifest, "-I", ANDROID_JAR, "--java", os.path.join(OUT, "gen"),
          "--auto-add-overlay", "--no-version-vectors", "--extra-packages", ":".join(sorted(set(lib_packages))),
          "--min-sdk-version", "24", "--target-sdk-version", "34",
          "--version-code", str(VERSION_CODE), "--version-name", VERSION_NAME, *compiled)

    # 2) java -> class -> dex
    sources = [os.path.join(dp, f) for dp, _, fs in os.walk(os.path.join(ROOT, "src")) for f in fs if f.endswith(".java")]
    sources += [os.path.join(dp, f) for dp, _, fs in os.walk(os.path.join(OUT, "gen")) for f in fs if f.endswith(".java")]
    classes = os.path.join(OUT, "classes")
    run(["javac", "-source", "8", "-target", "8", "-nowarn", "-encoding", "UTF-8", "-bootclasspath", ANDROID_JAR,
         "-cp", ":".join(jars), "-d", classes] + sources)
    class_files = [os.path.join(dp, f) for dp, _, fs in os.walk(classes) for f in fs if f.endswith(".class")]
    dex_out = os.path.join(OUT, "dex")
    run(["java", "-Xmx2g", "-cp", os.path.join(BT, "lib", "d8.jar"), "com.android.tools.r8.D8", "--release", "--min-api", "24",
         "--lib", ANDROID_JAR, "--output", dex_out] + class_files + jars)
    dex_files = sorted(f for f in os.listdir(dex_out) if f.endswith(".dex"))
    print("dex files:", dex_files)

    # 3) assemble: base.apk (manifest + resources) + dex
    unsigned = os.path.join(OUT, "voiladi-unsigned.apk")
    with zipfile.ZipFile(base) as zin, zipfile.ZipFile(unsigned, "w") as zout:
        for info in zin.infolist():
            data = zin.read(info.filename)
            stored = info.filename == "resources.arsc" or info.filename.endswith((".png", ".webp"))
            zout.writestr(info.filename, data, compress_type=zipfile.ZIP_STORED if stored else zipfile.ZIP_DEFLATED)
        for dex in dex_files:
            zout.write(os.path.join(dex_out, dex), dex, compress_type=zipfile.ZIP_DEFLATED)

    # 4) align + sign
    aligned = os.path.join(OUT, "voiladi-aligned.apk")
    zipalign_py(unsigned, aligned)
    release_env = os.path.join(ROOT, "release.env")
    if os.path.exists(release_env):
        for line in open(release_env):
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.strip().split("=", 1)
                os.environ.setdefault(k, v)
    ks_path = os.environ.get("RELEASE_KEYSTORE")
    ks_pass = os.environ.get("RELEASE_KEYSTORE_PASSWORD")
    ks_alias = os.environ.get("RELEASE_KEY_ALIAS", "voiladi")
    if ks_path and ks_pass:
        keystore = ks_path if os.path.isabs(ks_path) else os.path.join(ROOT, ks_path)
        if not os.path.exists(keystore):
            run(["keytool", "-genkeypair", "-v", "-keystore", keystore, "-storepass", ks_pass, "-keypass", ks_pass,
                 "-alias", ks_alias, "-keyalg", "RSA", "-keysize", "4096", "-validity", "10000", "-dname", "CN=Voiladi, O=Voiladi, C=IN"])
        print("signing with RELEASE keystore", os.path.basename(keystore))
    else:
        keystore = os.path.join(ROOT, "voiladi-debug.keystore")
        ks_pass, ks_alias = "voiladi123", "voiladi"
        if not os.path.exists(keystore):
            run(["keytool", "-genkeypair", "-v", "-keystore", keystore, "-storepass", ks_pass, "-keypass", ks_pass,
                 "-alias", ks_alias, "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000", "-dname", "CN=Voiladi, O=Voiladi, C=IN"])
        print("WARNING: signing with the DEBUG keystore (configure android-build/release.env for release builds)")
    final = os.path.join(OUT, "voiladi.apk")
    run(["java", "-jar", os.path.join(BT, "lib", "apksigner.jar"), "sign", "--ks", keystore, "--ks-pass", f"pass:{ks_pass}",
         "--key-pass", f"pass:{ks_pass}", "--ks-key-alias", ks_alias, "--min-sdk-version", "24", "--out", final, aligned])
    run(["java", "-jar", os.path.join(BT, "lib", "apksigner.jar"), "verify", "--verbose", final])
    print("APK:", final, os.path.getsize(final), "bytes")


def zipalign_py(src, dst):
    """4-byte align stored (uncompressed) entries, like zipalign -p 4 (resources.arsc must be uncompressed + aligned)."""
    import zlib
    with zipfile.ZipFile(src) as zin, open(dst, "wb") as out:
        entries = []
        offset = 0
        for info in zin.infolist():
            data = zin.read(info.filename)
            name = info.filename.encode("utf-8")
            if info.compress_type == zipfile.ZIP_STORED:
                comp = data
            else:
                c = zlib.compressobj(9, zlib.DEFLATED, -15)
                comp = c.compress(data) + c.flush()
            header_len = 30 + len(name)
            extra = b""
            if info.compress_type == zipfile.ZIP_STORED:
                pad = (4 - (offset + header_len) % 4) % 4
                extra = b"\x00" * pad
            crc = zipfile.crc32(data) & 0xFFFFFFFF
            local = struct.pack("<IHHHHHIIIHH", 0x04034B50, 20, 0, info.compress_type, 0, 0, crc, len(comp), len(data), len(name), len(extra)) + name + extra
            out.write(local + comp)
            entries.append((info, name, crc, len(comp), len(data), offset, extra))
            offset += len(local) + len(comp)
        cd_start = offset
        cd = b""
        for info, name, crc, clen, ulen, off, extra in entries:
            cd += struct.pack("<IHHHHHHIIIHHHHHII", 0x02014B50, 20, 20, 0, info.compress_type, 0, 0, crc, clen, ulen, len(name), 0, 0, 0, 0, 0, off) + name
        out.write(cd)
        out.write(struct.pack("<IHHHHIIH", 0x06054B50, 0, 0, len(entries), len(entries), len(cd), cd_start, 0))


if __name__ == "__main__":
    main()
