"""Build the Voiladi Android APK without the Android Gradle toolchain.

The x86-only aapt2 cannot run on this aarch64 host, so the two binary resource files are written directly:
  - AndroidManifest.xml  (Android binary XML, typed attribute values, attributes sorted by resource id)
  - resources.arsc       (one package, one mipmap entry -> the launcher icon PNG)
Java sources are compiled with javac against android.jar, converted with d8, packed, zip-aligned and signed.
"""
import os
import struct
import subprocess
import zipfile
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
SDK = os.path.join(ROOT, "sdk")
BT = os.path.join(SDK, "android-14")
ANDROID_JAR = os.path.join(SDK, "platform", "android-34", "android.jar")
OUT = os.path.join(ROOT, "out")
PKG = "com.voiladi.app"
VERSION_CODE = int(os.environ.get("VERSION_CODE", "2"))
VERSION_NAME = os.environ.get("VERSION_NAME", "1.1.0")
ICON_SRC = os.path.join(ROOT, "..", "frontend", "public", "icon-512.png")

ANDROID_NS = "http://schemas.android.com/apk/res/android"
ATTR = {  # android:attr resource ids (from android.R.attr)
    "theme": 0x01010000, "label": 0x01010001, "icon": 0x01010002, "name": 0x01010003, "exported": 0x01010010,
    "launchMode": 0x0101001d, "screenOrientation": 0x0101001e, "configChanges": 0x0101001f,
    "minSdkVersion": 0x0101020c, "versionCode": 0x0101021b, "versionName": 0x0101021c, "windowSoftInputMode": 0x0101022b,
    "targetSdkVersion": 0x01010270, "allowBackup": 0x01010280, "hardwareAccelerated": 0x010102d3, "supportsRtl": 0x010103af,
    "usesCleartextTraffic": 0x010104ec, "roundIcon": 0x0101052c, "permission": 0x01010006,
}
T_REF, T_STR, T_DEC, T_HEX, T_BOOL = 0x01, 0x03, 0x10, 0x11, 0x12
ICON_ID = 0x7F010000
SMALL_ICON_ID = 0x7F010001
THEME_NO_ACTIONBAR = 16974124  # android.R.style.Theme_DeviceDefault_Light_NoActionBar


# ------------------------------------------------------------------ string pool (UTF-16, as aapt writes)
def string_pool(strings):
    data = b""
    offsets = []
    for s in strings:
        offsets.append(len(data))
        enc = s.encode("utf-16-le")
        n = len(s)
        if n > 0x7FFF:
            data += struct.pack("<HH", 0x8000 | (n >> 16), n & 0xFFFF)
        else:
            data += struct.pack("<H", n)
        data += enc + b"\x00\x00"
    while len(data) % 4:
        data += b"\x00"
    header_size = 28
    strings_start = header_size + 4 * len(strings)
    body = b"".join(struct.pack("<I", o) for o in offsets) + data
    size = header_size + len(body)
    return struct.pack("<HHIIIIII", 0x0001, header_size, size, len(strings), 0, 0, strings_start, 0) + body


# ------------------------------------------------------------------ binary XML
class Axml:
    def __init__(self):
        self.strings = []  # attribute names with ids first
        self.res_ids = []
        self.body = b""
        self.line = 1

    def s(self, text):
        if text not in self.strings:
            self.strings.append(text)
        return self.strings.index(text)

    def prepare_attr_names(self, names):
        # attribute names with resource ids MUST be the first strings, in resource-map order
        for n in sorted(set(names), key=lambda k: ATTR[k]):
            self.strings.append(n)
            self.res_ids.append(ATTR[n])

    def start_ns(self, prefix, uri):
        self.body += struct.pack("<HHIiiII", 0x0100, 16, 24, self.line, -1, self.s(prefix), self.s(uri))

    def end_ns(self, prefix, uri):
        self.body += struct.pack("<HHIiiII", 0x0101, 16, 24, self.line, -1, self.s(prefix), self.s(uri))

    def start(self, name, attrs):
        """attrs: list of (ns_uri or None, attr_name, (type, value)). Sorted by resource id (no-id attrs last)."""
        def key(a):
            ns, n, _ = a
            return (0, ATTR[n]) if ns else (1, n)
        attrs = sorted(attrs, key=key)
        name_idx = self.s(name)
        packed = b""
        for ns, n, (typ, val) in attrs:
            ns_idx = self.s(ns) if ns else -1
            n_idx = self.s(n)
            if typ == T_STR:
                raw = self.s(val)
                data = raw
            else:
                raw = -1
                data = val & 0xFFFFFFFF
            packed += struct.pack("<iiiHBBI", ns_idx, n_idx, raw, 8, 0, typ, data)
        ext = struct.pack("<iiHHHHHH", -1, name_idx, 20, 20, len(attrs), 0, 0, 0)
        size = 16 + len(ext) + len(packed)
        self.body += struct.pack("<HHIii", 0x0102, 16, size, self.line, -1) + ext + packed
        self.line += 1

    def end(self, name):
        self.body += struct.pack("<HHIiiii", 0x0103, 16, 24, self.line, -1, -1, self.s(name))
        self.line += 1

    def pack(self):
        pool = string_pool(self.strings)
        resmap = struct.pack("<HHI", 0x0180, 8, 8 + 4 * len(self.res_ids)) + b"".join(struct.pack("<I", i) for i in self.res_ids)
        content = pool + resmap + self.body
        return struct.pack("<HHI", 0x0003, 8, 8 + len(content)) + content


def build_manifest():
    A = ANDROID_NS
    x = Axml()
    x.prepare_attr_names(["versionCode", "versionName", "minSdkVersion", "targetSdkVersion", "name", "label", "icon", "roundIcon", "theme",
                          "allowBackup", "hardwareAccelerated", "supportsRtl", "usesCleartextTraffic", "exported", "launchMode",
                          "screenOrientation", "configChanges", "windowSoftInputMode", "permission"])
    # pre-register namespace strings so indices are stable
    x.s("android")
    x.s(A)
    x.start_ns("android", A)
    x.start("manifest", [
        (A, "versionCode", (T_DEC, VERSION_CODE)),
        (A, "versionName", (T_STR, VERSION_NAME)),
        (None, "package", (T_STR, PKG)),
        (None, "platformBuildVersionCode", (T_DEC, 34)),
        (None, "platformBuildVersionName", (T_DEC, 14)),
    ])
    x.start("uses-sdk", [(A, "minSdkVersion", (T_DEC, 24)), (A, "targetSdkVersion", (T_DEC, 34))])
    x.end("uses-sdk")
    for perm in ["android.permission.INTERNET", "android.permission.ACCESS_NETWORK_STATE", "android.permission.ACCESS_FINE_LOCATION",
                 "android.permission.ACCESS_COARSE_LOCATION", "android.permission.CAMERA", "android.permission.RECORD_AUDIO", "android.permission.MODIFY_AUDIO_SETTINGS", "android.permission.POST_NOTIFICATIONS",
                 "android.permission.RECEIVE_BOOT_COMPLETED", "android.permission.VIBRATE"]:
        x.start("uses-permission", [(A, "name", (T_STR, perm))])
        x.end("uses-permission")
    x.start("application", [
        (A, "theme", (T_REF, THEME_NO_ACTIONBAR)),
        (A, "label", (T_STR, "Voiladi")),
        (A, "icon", (T_REF, ICON_ID)),
        (A, "roundIcon", (T_REF, ICON_ID)),
        (A, "allowBackup", (T_BOOL, 0)),
        (A, "hardwareAccelerated", (T_BOOL, 0xFFFFFFFF)),
        (A, "supportsRtl", (T_BOOL, 0xFFFFFFFF)),
        (A, "usesCleartextTraffic", (T_BOOL, 0)),
    ])
    x.start("activity", [
        (A, "theme", (T_REF, THEME_NO_ACTIONBAR)),
        (A, "name", (T_STR, PKG + ".MainActivity")),
        (A, "exported", (T_BOOL, 0xFFFFFFFF)),
        (A, "launchMode", (T_DEC, 2)),  # singleTask
        (A, "screenOrientation", (T_DEC, 1)),  # portrait
        (A, "configChanges", (T_HEX, 0x0080 | 0x0020 | 0x0400 | 0x0800 | 0x0200 | 0x0100)),  # orientation|keyboardHidden|screenSize|smallestScreenSize|uiMode|screenLayout
        (A, "windowSoftInputMode", (T_HEX, 0x10)),  # adjustResize
    ])
    x.start("intent-filter", [])
    x.start("action", [(A, "name", (T_STR, "android.intent.action.MAIN"))])
    x.end("action")
    x.start("category", [(A, "name", (T_STR, "android.intent.category.LAUNCHER"))])
    x.end("category")
    x.end("intent-filter")
    x.end("activity")
    # background poller (JobScheduler binds it with the system-only BIND_JOB_SERVICE permission)
    x.start("service", [
        (A, "name", (T_STR, PKG + ".PollService")),
        (A, "permission", (T_STR, "android.permission.BIND_JOB_SERVICE")),
        (A, "exported", (T_BOOL, 0xFFFFFFFF)),
    ])
    x.end("service")
    x.end("application")
    x.end("manifest")
    x.end_ns("android", A)
    return x.pack()


# ------------------------------------------------------------------ resources.arsc (package 0x7f, type mipmap, entry ic_launcher)
def build_arsc(entries):
    """entries: list of (name, path_in_apk) for type mipmap -> ids 0x7f0100NN in order."""
    values = string_pool([p for _, p in entries])       # global value strings
    type_strings = string_pool(["mipmap"])              # type names (id 1)
    key_strings = string_pool([n for n, _ in entries])  # entry names
    n = len(entries)

    # ResTable_typeSpec: header 16, one u32 flag per entry
    type_spec = struct.pack("<HHIBBHI", 0x0202, 16, 16 + 4 * n, 1, 0, 0, n) + b"".join(struct.pack("<I", 0) for _ in range(n))

    # ResTable_type: default configuration (size 64, all zero)
    config = struct.pack("<I", 64) + b"\x00" * 60
    entry_blob = b""
    offsets = []
    for i in range(n):
        offsets.append(len(entry_blob))
        entry_blob += struct.pack("<HHI", 8, 0, i) + struct.pack("<HBBI", 8, 0, T_STR, i)  # key i, value = string i
    header_size = 20 + len(config)
    entries_start = header_size + 4 * n
    type_chunk = struct.pack("<HHIBBHII", 0x0201, header_size, entries_start + len(entry_blob), 1, 0, 0, n, entries_start) + config \
        + b"".join(struct.pack("<I", o) for o in offsets) + entry_blob

    pkg_header_size = 288
    name = PKG.encode("utf-16-le")
    name = name + b"\x00" * (256 - len(name))
    type_strings_off = pkg_header_size
    key_strings_off = pkg_header_size + len(type_strings)
    pkg_body = type_strings + key_strings + type_spec + type_chunk
    pkg = struct.pack("<HHII", 0x0200, pkg_header_size, pkg_header_size + len(pkg_body), 0x7F) + name \
        + struct.pack("<IIIII", type_strings_off, 1, key_strings_off, 1, 0) + pkg_body

    table_body = values + pkg
    return struct.pack("<HHII", 0x0002, 12, 12 + len(table_body), 1) + table_body


def run(cmd, **kw):
    print("+", " ".join(cmd))
    subprocess.run(cmd, check=True, **kw)


def main():
    os.makedirs(OUT, exist_ok=True)
    classes = os.path.join(OUT, "classes")
    os.makedirs(classes, exist_ok=True)

    # 1) java -> class -> dex
    sources = [os.path.join(dp, f) for dp, _, fs in os.walk(os.path.join(ROOT, "src")) for f in fs if f.endswith(".java")]
    run(["javac", "-source", "8", "-target", "8", "-nowarn", "-bootclasspath", ANDROID_JAR, "-d", classes] + sources)
    class_files = [os.path.join(dp, f) for dp, _, fs in os.walk(classes) for f in fs if f.endswith(".class")]
    run(["java", "-cp", os.path.join(BT, "lib", "d8.jar"), "com.android.tools.r8.D8", "--release", "--min-api", "24",
         "--lib", ANDROID_JAR, "--output", OUT] + class_files)

    # 2) icons: launcher (full colour) + status-bar silhouette (white V on transparent, alpha only is used by Android)
    icon_rel = "res/mipmap/ic_launcher.png"
    small_rel = "res/mipmap/ic_notification.png"
    Image.open(ICON_SRC).convert("RGBA").resize((192, 192), Image.LANCZOS).save(os.path.join(OUT, "ic_launcher.png"))
    make_small_icon(os.path.join(OUT, "ic_notification.png"))

    # 3) assemble unsigned apk
    unsigned = os.path.join(OUT, "voiladi-unsigned.apk")
    with zipfile.ZipFile(unsigned, "w") as z:
        z.writestr(zipfile.ZipInfo("AndroidManifest.xml"), build_manifest(), compress_type=zipfile.ZIP_DEFLATED)
        z.writestr(zipfile.ZipInfo("resources.arsc"), build_arsc([("ic_launcher", icon_rel), ("ic_notification", small_rel)]), compress_type=zipfile.ZIP_STORED)
        z.write(os.path.join(OUT, "classes.dex"), "classes.dex", compress_type=zipfile.ZIP_DEFLATED)
        z.write(os.path.join(OUT, "ic_launcher.png"), icon_rel, compress_type=zipfile.ZIP_STORED)
        z.write(os.path.join(OUT, "ic_notification.png"), small_rel, compress_type=zipfile.ZIP_STORED)

    # 4) align + sign
    #    Release builds use a private keystore whose password lives OUTSIDE the repo (android-build/release.env, gitignored).
    #    The old debug keystore (public password) is only used when RELEASE_KEYSTORE is not configured.
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


def zipalign_py(src, dst):
    """4-byte align stored (uncompressed) entries, like zipalign -p 4 (resources.arsc must be uncompressed + aligned)."""
    with zipfile.ZipFile(src) as zin, open(dst, "wb") as out:
        entries = []
        offset = 0
        for info in zin.infolist():
            data = zin.read(info.filename)
            raw = zin.open(info).raw if False else None
            name = info.filename.encode("utf-8")
            if info.compress_type == zipfile.ZIP_STORED:
                comp = data
            else:
                import zlib
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
