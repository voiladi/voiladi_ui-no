"""Resolve and download the runtime dependency tree of firebase-messaging from Google Maven / Maven Central.

Writes AAR/JARs to android-build/libs/ and a manifest of what was fetched (libs/deps.json).
No Gradle here: we walk POMs ourselves (compile + runtime scopes, no optional/test deps, BOM-managed versions,
version ranges -> lower bound). Run once; the result is committed alongside the build script.
"""
import json
import os
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.abspath(__file__))
LIBS = os.path.join(ROOT, "libs")
REPOS = ["https://dl.google.com/dl/android/maven2", "https://repo1.maven.org/maven2"]
NS = {"m": "http://maven.apache.org/POM/4.0.0"}

ROOTS = [("com.google.firebase", "firebase-messaging", os.environ.get("FCM_VERSION", "24.1.1"))]
# not needed at runtime for our use / pulled transitively but heavy or unused
SKIP = {
    ("com.google.firebase", "firebase-measurement-connector"),
    ("com.google.android.gms", "play-services-measurement-base"),
    ("com.google.android.gms", "play-services-measurement-impl"),
    ("com.google.android.gms", "play-services-measurement"),
    ("com.google.android.gms", "play-services-measurement-api"),
    ("com.google.android.gms", "play-services-measurement-sdk"),
    ("com.google.android.gms", "play-services-measurement-sdk-api"),
    ("com.google.android.gms", "play-services-ads-identifier"),
    ("com.google.firebase", "firebase-analytics"),
    ("com.google.firebase", "firebase-installations-interop-ktx"),
    ("org.jetbrains.kotlinx", "kotlinx-coroutines-play-services"),
    ("org.jetbrains.kotlinx", "kotlinx-coroutines-core-jvm"),
    ("org.jetbrains.kotlinx", "kotlinx-coroutines-android"),
    ("org.jetbrains.kotlinx", "kotlinx-coroutines-core"),
    ("com.google.firebase", "firebase-common-ktx"),
    ("androidx.annotation", "annotation-experimental"),
    ("org.jetbrains", "annotations"),
    ("org.jetbrains.kotlin", "kotlin-stdlib-common"),
    ("org.jetbrains.kotlin", "kotlin-stdlib-jdk7"),
    ("org.jetbrains.kotlin", "kotlin-stdlib-jdk8"),
    ("com.google.errorprone", "error_prone_annotations"),
    ("com.google.code.findbugs", "jsr305"),
    ("javax.inject", "javax.inject"),
    ("androidx.lifecycle", "lifecycle-common-java8"),
    ("androidx.interpolator", "interpolator"),
    ("androidx.legacy", "legacy-support-core-utils"),
    ("androidx.documentfile", "documentfile"),
    ("androidx.localbroadcastmanager", "localbroadcastmanager"),
    ("androidx.print", "print"),
    ("androidx.cursoradapter", "cursoradapter"),
    ("androidx.customview", "customview"),
    ("androidx.loader", "loader"),
    ("androidx.fragment", "fragment"),
    ("androidx.activity", "activity"),
    ("androidx.viewpager", "viewpager"),
    ("androidx.drawerlayout", "drawerlayout"),
    ("androidx.profileinstaller", "profileinstaller"),
    ("androidx.startup", "startup-runtime"),
    ("androidx.tracing", "tracing"),
    ("androidx.concurrent", "concurrent-futures"),
    ("androidx.emoji2", "emoji2"),
    ("androidx.emoji2", "emoji2-views-helper"),
    ("androidx.savedstate", "savedstate"),
    ("androidx.lifecycle", "lifecycle-viewmodel"),
    ("androidx.lifecycle", "lifecycle-viewmodel-savedstate"),
    ("androidx.lifecycle", "lifecycle-livedata"),
    ("androidx.lifecycle", "lifecycle-livedata-core"),
    ("androidx.lifecycle", "lifecycle-runtime"),
    ("androidx.lifecycle", "lifecycle-process"),
    ("androidx.arch.core", "core-runtime"),
    ("androidx.arch.core", "core-common"),
    ("com.google.guava", "listenablefuture"),
    ("androidx.versionedparcelable", "versionedparcelable"),
    ("androidx.core", "core-ktx"),
}
PINS = {
    # keep the androidx surface small and API-24 friendly
    ("androidx.core", "core"): "1.13.1",
    ("androidx.annotation", "annotation"): "1.8.0",
    ("androidx.collection", "collection"): "1.4.0",
    ("androidx.lifecycle", "lifecycle-common"): "2.6.2",
    ("org.jetbrains.kotlin", "kotlin-stdlib"): "1.9.24",
}


def fetch(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": "voiladi-build/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read() if binary else r.read().decode("utf-8", "replace")


def repo_get(path, binary=False):
    last = None
    for repo in REPOS:
        try:
            return fetch(f"{repo}/{path}", binary)
        except Exception as e:  # noqa: BLE001
            last = e
    raise last


def base_path(g, a, v):
    return f"{g.replace('.', '/')}/{a}/{v}/{a}-{v}"


def pick_version(spec, managed):
    spec = (spec or "").strip()
    if not spec and managed:
        return managed
    if spec.startswith("[") or spec.startswith("("):
        # [18.0.1, 19.0.0) -> lower bound
        low = re.split(r"[,\]\)]", spec[1:])[0].strip()
        return low or managed
    if spec.startswith("${"):
        return managed
    return spec or managed


def pom_props(root):
    props = {}
    for p in root.findall("m:properties/*", NS):
        props[p.tag.split("}")[1]] = (p.text or "").strip()
    return props


def subst(v, props):
    if not v:
        return v
    return re.sub(r"\$\{([^}]+)\}", lambda m: props.get(m.group(1), m.group(0)), v)


def parse_pom(g, a, v):
    xml = repo_get(base_path(g, a, v) + ".pom")
    root = ET.fromstring(xml)
    props = pom_props(root)
    props.setdefault("project.version", v)
    packaging = (root.findtext("m:packaging", default="jar", namespaces=NS) or "jar").strip()
    managed = {}
    for d in root.findall("m:dependencyManagement/m:dependencies/m:dependency", NS):
        dg, da = d.findtext("m:groupId", namespaces=NS), d.findtext("m:artifactId", namespaces=NS)
        dv = subst(d.findtext("m:version", namespaces=NS), props)
        if (d.findtext("m:type", namespaces=NS) or "") == "pom" and (d.findtext("m:scope", namespaces=NS) or "") == "import" and dv:
            # BOM import
            try:
                bom = ET.fromstring(repo_get(base_path(dg, da, dv) + ".pom"))
                bprops = pom_props(bom)
                for bd in bom.findall("m:dependencyManagement/m:dependencies/m:dependency", NS):
                    managed[(bd.findtext("m:groupId", namespaces=NS), bd.findtext("m:artifactId", namespaces=NS))] = subst(bd.findtext("m:version", namespaces=NS), bprops)
            except Exception as e:  # noqa: BLE001
                print("  bom failed", dg, da, dv, e)
        elif dv:
            managed[(dg, da)] = dv
    deps = []
    for d in root.findall("m:dependencies/m:dependency", NS):
        scope = (d.findtext("m:scope", namespaces=NS) or "compile").strip()
        if scope not in ("compile", "runtime"):
            continue
        if (d.findtext("m:optional", namespaces=NS) or "false").strip() == "true":
            continue
        dg = subst(d.findtext("m:groupId", namespaces=NS), props)
        da = subst(d.findtext("m:artifactId", namespaces=NS), props)
        dv = pick_version(subst(d.findtext("m:version", namespaces=NS), props), managed.get((dg, da)))
        dt = (d.findtext("m:type", namespaces=NS) or "").strip()
        if dt == "pom":
            continue
        deps.append((dg, da, dv))
    return packaging, deps


def main():
    os.makedirs(LIBS, exist_ok=True)
    seen = {}
    queue = list(ROOTS)
    while queue:
        g, a, v = queue.pop(0)
        if (g, a) in SKIP:
            continue
        v = PINS.get((g, a), v)
        if (g, a) in seen:
            continue
        if not v:
            print("!! no version for", g, a)
            continue
        print(f"{g}:{a}:{v}")
        packaging, deps = parse_pom(g, a, v)
        seen[(g, a)] = (v, packaging)
        for dep in deps:
            if dep[:2] not in seen and dep[:2] not in SKIP:
                queue.append(dep)
    out = {}
    for (g, a), (v, packaging) in sorted(seen.items()):
        ext = "aar" if packaging == "aar" else "jar"
        fn = f"{a}-{v}.{ext}"
        dst = os.path.join(LIBS, fn)
        if not os.path.exists(dst):
            try:
                data = repo_get(base_path(g, a, v) + "." + ext, binary=True)
            except Exception:
                ext = "jar" if ext == "aar" else "aar"
                fn = f"{a}-{v}.{ext}"
                dst = os.path.join(LIBS, fn)
                data = repo_get(base_path(g, a, v) + "." + ext, binary=True)
            with open(dst, "wb") as f:
                f.write(data)
            print("  downloaded", fn, len(data) // 1024, "KB")
        out[f"{g}:{a}"] = {"version": v, "file": fn}
    with open(os.path.join(LIBS, "deps.json"), "w") as f:
        json.dump(out, f, indent=1, sort_keys=True)
    print(len(out), "artifacts")


if __name__ == "__main__":
    sys.exit(main())
