#!/usr/bin/env python3
"""
Comprehensive APK validation test for Voiladi Android app.
Tests APK structure, manifest, resources, dex, signature, alignment, and download.
"""
import sys
import os
import struct
import zipfile
import hashlib
import subprocess
from io import BytesIO

# Ensure we're using the venv with androguard
sys.path.insert(0, '/root/.venv/lib/python3.11/site-packages')

try:
    from androguard.core.apk import APK
    from androguard.core.axml import AXMLPrinter
    from androguard.core.dex import DEX
    from PIL import Image
    import requests
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("Please ensure androguard, Pillow, and requests are installed")
    sys.exit(1)

# Try importing pyaxml for secondary validation
try:
    from pyaxml import AXML
    PYAXML_AVAILABLE = True
except ImportError:
    PYAXML_AVAILABLE = False
    print("⚠️  pyaxml not available for secondary manifest parsing")

APK_PATH = "/app/frontend/public/voiladi.apk"
EXPECTED_PACKAGE = "com.voiladi.app"
EXPECTED_APP_NAME = "Voiladi"
EXPECTED_MAIN_ACTIVITY = "com.voiladi.app.MainActivity"
EXPECTED_VERSION_NAME = "1.0.0"
EXPECTED_MIN_SDK = 24
EXPECTED_TARGET_SDK = 34
EXPECTED_ICON_PATH = "res/mipmap/ic_launcher.png"
EXPECTED_ICON_SIZE = (192, 192)
EXPECTED_PERMISSIONS = [
    "android.permission.INTERNET",
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.CAMERA"
]
PRODUCTION_URL = "https://www.voiladi.com/voiladi.apk"

class APKValidator:
    def __init__(self, apk_path):
        self.apk_path = apk_path
        self.apk = None
        self.tests_run = 0
        self.tests_passed = 0
        self.issues = []
        
    def log_test(self, name, passed, details=""):
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
            print(f"✅ {name}")
            if details:
                print(f"   {details}")
        else:
            self.issues.append(f"{name}: {details}")
            print(f"❌ {name}")
            if details:
                print(f"   {details}")
    
    def test_apk_structure(self):
        """Test 1: APK structure validation with androguard"""
        print("\n" + "="*60)
        print("TEST 1: APK Structure Validation")
        print("="*60)
        
        try:
            self.apk = APK(self.apk_path)
            self.log_test("APK loads successfully", True)
        except Exception as e:
            self.log_test("APK loads successfully", False, str(e))
            return False
        
        # Validate APK
        try:
            is_valid = self.apk.is_valid_APK()
            self.log_test("is_valid_APK() returns True", is_valid)
        except Exception as e:
            self.log_test("is_valid_APK() returns True", False, str(e))
        
        # Package name
        package = self.apk.get_package()
        self.log_test(
            f"Package name is '{EXPECTED_PACKAGE}'",
            package == EXPECTED_PACKAGE,
            f"Got: {package}"
        )
        
        # App name
        app_name = self.apk.get_app_name()
        self.log_test(
            f"App name is '{EXPECTED_APP_NAME}'",
            app_name == EXPECTED_APP_NAME,
            f"Got: {app_name}"
        )
        
        # Main activity
        main_activity = self.apk.get_main_activity()
        self.log_test(
            f"Main activity is '{EXPECTED_MAIN_ACTIVITY}'",
            main_activity == EXPECTED_MAIN_ACTIVITY,
            f"Got: {main_activity}"
        )
        
        # SDK versions
        min_sdk = self.apk.get_min_sdk_version()
        self.log_test(
            f"Min SDK is {EXPECTED_MIN_SDK}",
            str(min_sdk) == str(EXPECTED_MIN_SDK),
            f"Got: {min_sdk}"
        )
        
        target_sdk = self.apk.get_target_sdk_version()
        self.log_test(
            f"Target SDK is {EXPECTED_TARGET_SDK}",
            str(target_sdk) == str(EXPECTED_TARGET_SDK),
            f"Got: {target_sdk}"
        )
        
        # Version name
        version_name = self.apk.get_androidversion_name()
        self.log_test(
            f"Version name is '{EXPECTED_VERSION_NAME}'",
            version_name == EXPECTED_VERSION_NAME,
            f"Got: {version_name}"
        )
        
        # Permissions
        permissions = self.apk.get_permissions()
        for perm in EXPECTED_PERMISSIONS:
            has_perm = perm in permissions
            self.log_test(
                f"Has permission {perm}",
                has_perm,
                f"All permissions: {permissions}" if not has_perm else ""
            )
        
        # Icon
        icon_path = self.apk.get_app_icon()
        self.log_test(
            f"Icon path is '{EXPECTED_ICON_PATH}'",
            icon_path == EXPECTED_ICON_PATH,
            f"Got: {icon_path}"
        )
        
        # Verify icon file exists in zip and is valid PNG
        try:
            with zipfile.ZipFile(self.apk_path, 'r') as z:
                icon_exists = EXPECTED_ICON_PATH in z.namelist()
                self.log_test(
                    f"Icon file exists in APK",
                    icon_exists,
                    f"Files: {z.namelist()}" if not icon_exists else ""
                )
                
                if icon_exists:
                    icon_data = z.read(EXPECTED_ICON_PATH)
                    img = Image.open(BytesIO(icon_data))
                    is_png = img.format == 'PNG'
                    self.log_test("Icon is PNG format", is_png, f"Got: {img.format}")
                    
                    correct_size = img.size == EXPECTED_ICON_SIZE
                    self.log_test(
                        f"Icon size is {EXPECTED_ICON_SIZE}",
                        correct_size,
                        f"Got: {img.size}"
                    )
        except Exception as e:
            self.log_test("Icon validation", False, str(e))
        
        # Signature checks
        try:
            is_signed_v2 = self.apk.is_signed_v2()
            self.log_test("is_signed_v2() returns True", is_signed_v2)
        except Exception as e:
            self.log_test("is_signed_v2() returns True", False, str(e))
        
        try:
            is_signed_v3 = self.apk.is_signed_v3()
            self.log_test("is_signed_v3() returns True", is_signed_v3)
        except Exception as e:
            self.log_test("is_signed_v3() returns True", False, str(e))
        
        return True
    
    def test_manifest_typed_values(self):
        """Test 2: Manifest typed values parsing"""
        print("\n" + "="*60)
        print("TEST 2: Manifest Typed Values")
        print("="*60)
        
        try:
            with zipfile.ZipFile(self.apk_path, 'r') as z:
                manifest_data = z.read('AndroidManifest.xml')
                
                # Parse with androguard AXMLPrinter
                try:
                    printer = AXMLPrinter(manifest_data)
                    xml_bytes = printer.get_xml()
                    xml_str = xml_bytes.decode('utf-8') if isinstance(xml_bytes, bytes) else xml_bytes
                    self.log_test("AXMLPrinter parses manifest", True, f"XML length: {len(xml_str)}")
                    
                    # Check for key attributes in the XML
                    checks = [
                        ("theme attribute present", "android:theme" in xml_str),
                        ("icon attribute present", "android:icon" in xml_str),
                        ("roundIcon attribute present", "android:roundIcon" in xml_str),
                        ("exported attribute present", "android:exported" in xml_str),
                        ("launchMode attribute present", "android:launchMode" in xml_str),
                        ("screenOrientation attribute present", "android:screenOrientation" in xml_str),
                        ("configChanges attribute present", "android:configChanges" in xml_str),
                        ("windowSoftInputMode attribute present", "android:windowSoftInputMode" in xml_str),
                        ("usesCleartextTraffic attribute present", "android:usesCleartextTraffic" in xml_str),
                    ]
                    
                    for check_name, result in checks:
                        self.log_test(check_name, result)
                    
                    # Check specific values
                    # Theme should be a reference (0x0103012c = 16974124 = Theme_DeviceDefault_Light_NoActionBar)
                    theme_present = "@android:" in xml_str or "0x0103012c" in xml_str or "16974124" in xml_str
                    self.log_test("Theme is a reference (@android: or hex)", theme_present)
                    
                    # Icon should be a reference (0x7f010000)
                    icon_ref = "@7F010000" in xml_str or "@0x7f010000" in xml_str or "0x7f010000" in xml_str or "@7f010000" in xml_str
                    self.log_test("Icon is a reference (0x7f010000)", icon_ref)
                    
                    # exported should be true
                    exported_true = 'android:exported="true"' in xml_str
                    self.log_test("exported is true", exported_true)
                    
                    # launchMode should be 2 (singleTask)
                    launch_mode = 'launchMode="2"' in xml_str or 'launchMode="singleTask"' in xml_str
                    self.log_test("launchMode is 2 (singleTask)", launch_mode)
                    
                    # screenOrientation should be 1 (portrait)
                    screen_orient = 'screenOrientation="1"' in xml_str or 'screenOrientation="portrait"' in xml_str
                    self.log_test("screenOrientation is 1 (portrait)", screen_orient)
                    
                    # configChanges should be 0xfa0 (4000)
                    config_changes = 'configChanges="0x' in xml_str or 'configChanges="4000"' in xml_str
                    self.log_test("configChanges has hex value", config_changes)
                    
                    # windowSoftInputMode should be 0x10 (16)
                    window_soft = 'windowSoftInputMode="0x' in xml_str or 'windowSoftInputMode="16"' in xml_str
                    self.log_test("windowSoftInputMode is 0x10 (16)", window_soft)
                    
                    # usesCleartextTraffic should be false
                    cleartext = 'usesCleartextTraffic="false"' in xml_str
                    self.log_test("usesCleartextTraffic is false", cleartext)
                    
                except Exception as e:
                    self.log_test("AXMLPrinter parses manifest", False, str(e))
                
                # Parse with pyaxml if available
                if PYAXML_AVAILABLE:
                    try:
                        axml = AXML.from_axml(manifest_data)
                        xml_str2 = axml.to_xml()
                        self.log_test("pyaxml parses manifest", True, f"XML length: {len(xml_str2)}")
                    except Exception as e:
                        self.log_test("pyaxml parses manifest", False, str(e))
                
        except Exception as e:
            self.log_test("Manifest parsing", False, str(e))
    
    def test_resources_arsc(self):
        """Test 3: resources.arsc validation"""
        print("\n" + "="*60)
        print("TEST 3: resources.arsc Validation")
        print("="*60)
        
        try:
            # Get android resources
            arsc = self.apk.get_android_resources()
            self.log_test("ARSCParser loads resources", arsc is not None)
            
            if arsc:
                # Resolve icon resource ID 0x7f010000
                try:
                    # Try to resolve the resource
                    res_id = 0x7f010000
                    
                    # Method 1: get_resource_xml_name
                    try:
                        xml_name = arsc.get_resource_xml_name(res_id)
                        self.log_test(
                            f"Resource 0x7f010000 resolves",
                            xml_name is not None,
                            f"Resolved to: {xml_name}"
                        )
                    except Exception as e:
                        self.log_test("Resource 0x7f010000 resolves", False, str(e))
                    
                    # Method 2: get_res_id_by_key
                    try:
                        resolved_id = arsc.get_res_id_by_key(EXPECTED_PACKAGE, 'mipmap', 'ic_launcher')
                        matches = resolved_id == res_id
                        self.log_test(
                            f"get_res_id_by_key('com.voiladi.app','mipmap','ic_launcher') == 0x7f010000",
                            matches,
                            f"Got: 0x{resolved_id:08x}" if resolved_id else "Got: None"
                        )
                    except Exception as e:
                        self.log_test("get_res_id_by_key resolves", False, str(e))
                    
                except Exception as e:
                    self.log_test("Resource resolution", False, str(e))
        except Exception as e:
            self.log_test("resources.arsc validation", False, str(e))
    
    def test_classes_dex(self):
        """Test 4: classes.dex validation"""
        print("\n" + "="*60)
        print("TEST 4: classes.dex Validation")
        print("="*60)
        
        try:
            # Get DEX bytes and create DEX object
            dex_bytes = self.apk.get_dex()
            dex = DEX(dex_bytes)
            self.log_test("DEX parses successfully", dex is not None)
            
            if dex:
                # Check for MainActivity class
                main_activity_class = "Lcom/voiladi/app/MainActivity;"
                found_main = False
                main_class = None
                
                for cls in dex.get_classes():
                    if cls.get_name() == main_activity_class:
                        found_main = True
                        main_class = cls
                        break
                
                self.log_test(
                    f"Class {main_activity_class} exists",
                    found_main
                )
                
                if found_main and main_class:
                    # Check for required methods
                    methods = [m.get_name() for m in main_class.get_methods()]
                    required_methods = [
                        'onCreate',
                        'onBackPressed',
                        'onActivityResult',
                        'onRequestPermissionsResult'
                    ]
                    
                    for method_name in required_methods:
                        has_method = method_name in methods
                        self.log_test(
                            f"MainActivity has method {method_name}",
                            has_method,
                            f"Available methods: {methods}" if not has_method else ""
                        )
                
                # Check for the URL string in dex
                url_string = "https://www.voiladi.com/"
                strings = dex.get_strings()
                found_url = url_string in strings
                
                self.log_test(
                    f"DEX contains string '{url_string}'",
                    found_url
                )
                    
        except Exception as e:
            self.log_test("classes.dex validation", False, str(e))
    
    def test_signature_verification(self):
        """Test 5: Signature verification with apksigner"""
        print("\n" + "="*60)
        print("TEST 5: Signature Verification")
        print("="*60)
        
        try:
            apksigner_jar = "/app/android-build/sdk/android-14/lib/apksigner.jar"
            
            if not os.path.exists(apksigner_jar):
                self.log_test("apksigner.jar exists", False, f"Not found at {apksigner_jar}")
                return
            
            # Run apksigner verify
            result = subprocess.run(
                ["java", "-jar", apksigner_jar, "verify", "--verbose", self.apk_path],
                capture_output=True,
                text=True
            )
            
            output = result.stdout + result.stderr
            
            # Check for "Verifies"
            verifies = "Verifies" in output
            self.log_test("apksigner reports 'Verifies'", verifies, output if not verifies else "")
            
            # Check for v2 signature
            v2_verified = "Verified using v2 scheme" in output or "v2 scheme: true" in output.lower()
            self.log_test("v2 signature verified", v2_verified, output if not v2_verified else "")
            
            # Check for v3 signature
            v3_verified = "Verified using v3 scheme" in output or "v3 scheme: true" in output.lower()
            self.log_test("v3 signature verified", v3_verified, output if not v3_verified else "")
            
            # Check for errors (warnings are OK)
            has_errors = "ERROR" in output.upper() and "error" in output.lower()
            self.log_test("No signature errors", not has_errors, output if has_errors else "")
            
            if result.returncode != 0:
                self.log_test("apksigner exit code is 0", False, f"Exit code: {result.returncode}")
            else:
                self.log_test("apksigner exit code is 0", True)
            
        except Exception as e:
            self.log_test("Signature verification", False, str(e))
    
    def test_zip_alignment(self):
        """Test 6: Zip alignment check"""
        print("\n" + "="*60)
        print("TEST 6: Zip Alignment")
        print("="*60)
        
        try:
            with zipfile.ZipFile(self.apk_path, 'r') as z:
                # Find resources.arsc
                arsc_info = None
                for info in z.infolist():
                    if info.filename == 'resources.arsc':
                        arsc_info = info
                        break
                
                if not arsc_info:
                    self.log_test("resources.arsc found in APK", False)
                    return
                
                self.log_test("resources.arsc found in APK", True)
                
                # Check if it's STORED (uncompressed)
                is_stored = arsc_info.compress_type == zipfile.ZIP_STORED
                self.log_test(
                    "resources.arsc is STORED (uncompressed)",
                    is_stored,
                    f"Compress type: {arsc_info.compress_type}"
                )
                
                # Check 4-byte alignment
                # The data offset is: header_offset + 30 (fixed header) + len(filename) + len(extra)
                header_offset = arsc_info.header_offset
                filename_len = len(arsc_info.filename.encode('utf-8'))
                extra_len = len(arsc_info.extra)
                data_offset = header_offset + 30 + filename_len + extra_len
                
                is_aligned = (data_offset % 4) == 0
                self.log_test(
                    "resources.arsc data is 4-byte aligned",
                    is_aligned,
                    f"Data offset: {data_offset}, modulo 4: {data_offset % 4}"
                )
                
        except Exception as e:
            self.log_test("Zip alignment check", False, str(e))
    
    def test_download(self):
        """Test 7: Download from production URL"""
        print("\n" + "="*60)
        print("TEST 7: Production Download")
        print("="*60)
        
        try:
            response = requests.get(PRODUCTION_URL, timeout=30)
            
            # Check status code
            is_200 = response.status_code == 200
            self.log_test(
                "GET returns 200",
                is_200,
                f"Status: {response.status_code}"
            )
            
            # Check Content-Type
            content_type = response.headers.get('Content-Type', '')
            correct_type = 'application/vnd.android.package-archive' in content_type
            self.log_test(
                "Content-Type is application/vnd.android.package-archive",
                correct_type,
                f"Got: {content_type}"
            )
            
            # Check Content-Disposition
            content_disp = response.headers.get('Content-Disposition', '')
            has_attachment = 'attachment' in content_disp
            self.log_test(
                "Content-Disposition includes 'attachment'",
                has_attachment,
                f"Got: {content_disp}"
            )
            
            # Check SHA256 match
            if is_200:
                downloaded_hash = hashlib.sha256(response.content).hexdigest()
                
                with open(self.apk_path, 'rb') as f:
                    local_hash = hashlib.sha256(f.read()).hexdigest()
                
                hashes_match = downloaded_hash == local_hash
                self.log_test(
                    "Downloaded APK SHA256 matches local file",
                    hashes_match,
                    f"Downloaded: {downloaded_hash}\nLocal: {local_hash}"
                )
            
        except Exception as e:
            self.log_test("Production download", False, str(e))
    
    def test_rebuild_reproducibility(self):
        """Test 8: Rebuild reproducibility"""
        print("\n" + "="*60)
        print("TEST 8: Rebuild Reproducibility")
        print("="*60)
        
        try:
            build_dir = "/app/android-build"
            build_script = os.path.join(build_dir, "build_apk.py")
            
            if not os.path.exists(build_script):
                self.log_test("build_apk.py exists", False, f"Not found at {build_script}")
                return
            
            self.log_test("build_apk.py exists", True)
            
            # Run the build script
            result = subprocess.run(
                ["python3", "build_apk.py"],
                cwd=build_dir,
                capture_output=True,
                text=True,
                timeout=120
            )
            
            output = result.stdout + result.stderr
            
            # Check exit code
            success = result.returncode == 0
            self.log_test(
                "build_apk.py exits with code 0",
                success,
                f"Exit code: {result.returncode}\nOutput: {output}" if not success else ""
            )
            
            # Check if output APK was created
            output_apk = os.path.join(build_dir, "out", "voiladi.apk")
            apk_created = os.path.exists(output_apk)
            self.log_test(
                "out/voiladi.apk is created",
                apk_created,
                f"Not found at {output_apk}" if not apk_created else ""
            )
            
            if success and apk_created:
                print(f"\n📦 Build output:\n{output}")
            
        except subprocess.TimeoutExpired:
            self.log_test("build_apk.py completes within timeout", False, "Build timed out after 120s")
        except Exception as e:
            self.log_test("Rebuild reproducibility", False, str(e))
    
    def run_all_tests(self):
        """Run all validation tests"""
        print("\n" + "="*60)
        print("VOILADI APK VALIDATION TEST SUITE")
        print("="*60)
        print(f"APK Path: {self.apk_path}")
        print(f"APK Size: {os.path.getsize(self.apk_path)} bytes")
        print("="*60)
        
        self.test_apk_structure()
        self.test_manifest_typed_values()
        self.test_resources_arsc()
        self.test_classes_dex()
        self.test_signature_verification()
        self.test_zip_alignment()
        self.test_download()
        self.test_rebuild_reproducibility()
        
        # Summary
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed / self.tests_run * 100):.1f}%")
        
        if self.issues:
            print("\n❌ FAILED TESTS:")
            for issue in self.issues:
                print(f"  - {issue}")
        else:
            print("\n✅ ALL TESTS PASSED!")
        
        print("="*60)
        
        return self.tests_passed, self.tests_run, self.issues

def main():
    if not os.path.exists(APK_PATH):
        print(f"❌ APK not found at {APK_PATH}")
        return 1
    
    validator = APKValidator(APK_PATH)
    passed, total, issues = validator.run_all_tests()
    
    return 0 if passed == total else 1

if __name__ == "__main__":
    sys.exit(main())
