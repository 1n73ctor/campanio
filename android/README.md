# Companio Android app

A Trusted Web Activity: the Play Store app opens https://getcompanio.in full-screen in Chrome. Website changes reach
the app instantly; you only rebuild for app-level changes (name, icon, colours, version, permissions).

- App ID: `in.getcompanio.app` · settings live in `twa-manifest.json`
- Signing (upload) key: `~/companio-android-signing/upload-key.jks` + `PASSWORDS.txt` — **never commit; back both up**
- The website proves it owns the app via `apps/web/public/.well-known/assetlinks.json` (package + key fingerprints).
  After the first Play upload, add Play's **App signing key** SHA-256 (Play Console → Test and release → App integrity)
  to that file, or the Play-installed app shows a browser address bar.

## Build a new version

Tools live in `~/.bubblewrap` (Java 17, Android SDK, Bubblewrap CLI).

```bash
cd android
# bump appVersionCode (+1) and appVersionName in twa-manifest.json, then:
export JAVA_HOME=~/.bubblewrap/jdk/Contents/Home
~/.bubblewrap/cli/node_modules/.bin/bubblewrap update --skipVersionUpgrade
BUBBLEWRAP_KEYSTORE_PASSWORD='…' BUBBLEWRAP_KEY_PASSWORD='…' ~/.bubblewrap/cli/node_modules/.bin/bubblewrap build --skipPwaValidation
```

Outputs: `app-release-bundle.aab` (upload to Play) and `app-release-signed.apk` (install directly on a phone for testing).
