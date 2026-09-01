# Super Toto Local — Google Play Upload Guide (Internal / Closed Testing)

This project is prepared for **Google Play internal / closed testing** — NOT a public
production listing. The app talks to a **local backend (`127.0.0.1:5000`)** so it will
only function within your own test environment.

---

## 1. What's already prepared

| Item | Location | Status |
|---|---|---|
| **Signed App Bundle (.aab)** | `client/android/app/build/outputs/bundle/release/app-release.aab` | ✅ signed, ready to upload |
| **Upload keystore** | `PLAY_STORE/keys/supertoto-release.jks` | ✅ created (alias `supertoto`) |
| **Keystore passwords** | `PLAY_STORE/keys/keystore.password`, `PLAY_STORE/keys/alias.password` | ✅ generated (alias = store pwd, PKCS12) |
| **Certificate (PEM)** | `PLAY_STORE/keys/supertoto-release-cert.pem` | ✅ |
| **Privacy Policy (hostable HTML)** | `PLAY_STORE/PRIVACY_POLICY.html` | ✅ rewrite/neutral-ready |
| **Data Safety form answers** | `PLAY_STORE/DATA_SAFETY_FORM.md` | ✅ |
| **Store listing copy** | `PLAY_STORE/PLAY_LISTING.md` | ✅ |

> **⚠️ KEEP THE KEYSTORE SAFE.** If you lose `supertoto-release.jks` + passwords you
> cannot release updates with the same identity. Store a backup copy in a separate,
> secure location. **Never commit the keystore or the `keystore.properties` file** —
> both are git-ignored.

---

## 2. Signing is already configured

`client/android/app/build.gradle` reads `client/android/keystore.properties` (git-ignored)
and signs the `release` build type. To produce a fresh signed bundle after code changes:

```powershell
cd H:\Super Toto Local\client
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run build
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" exec capacitor sync android

$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot"
cd android
.\gradlew.bat bundleRelease           # -> app/build/outputs/bundle/release/app-release.aab
```

### Signing details
- Application ID: `in.tsa.supertotolocal`
- Keystore type: PKCS12, RSA 4096, SHA256withRSA
- Alias: `supertoto` | Validity: until **2054-01-16**
- Cert SHA-256 fingerprint:
  `19:4F:1C:E4:C0:AD:9E:CA:1A:FD:84:2A:DD:6C:9A:99:CC:61:F7:F1:DE:6D:88:2D:9D:8C:36:06:43:86:31:B1`
- Owner: `CN=TSA Enterprises, OU=Mobile, O=TSA Enterprises, L=New Delhi, ST=Delhi, C=IN`
- Target/compile SDK: **36** · Min SDK: **24** · VersionCode **1** · VersionName **1.0.0**

---

## 3. Before you upload — one-time Play Console setup

1. Create a **Google Play Console** account (one-time US$25).
2. **Create app**: App name `Super Toto Local`, default language English, app or game → App, free.
3. **Set up Play App Signing** (recommended):
   - Either upload your existing upload key (the project's private key as the **upload key**)
     or let Google generate one (they sign the app with their own app-signing key).
   - You will be asked for the SHA-256 of the upload certificate. You can either:
     - upload the `supertoto-release.jks` / the certificate directly, **or**
     - paste the SHA-256 fingerprint above.
4. **All apps content / Data safety** → follow `PLAY_STORE/DATA_SAFETY_FORM.md`.
5. **Privacy policy URL** → host `PLAY_STORE/PRIVACY_POLICY.html` at a public HTTPS
   URL (e.g. GitHub Pages / your own domain) and paste the link.
6. **Store listing** → use `PLAY_STORE/PLAY_LISTING.md` for title, description, images,
   category, content rating, contact email.
7. **Track selection** → choose **Internal testing** or **Closed testing** and add your
   Google account (the one signed in) as a tester.

---

## 4. Upload the AAB

1. In Play Console → your app → **Release → Testing → Internal testing** (or Closed).
2. **Create new release** → **Upload** `app-release.aab`.
3. Set a release name (e.g. `1.0.0 (1)`) and release notes.
4. **Review** and **Rollout**.
5. Install the test build via the **opt-in link** (requires the tester account to accept).

---

## 5. Gotchas specific to this app

- **Backend.** The app calls `http://127.0.0.1:5000` (natively) or the same-origin dev
  server (web). It will **not** work for a tester unless the Node backend is running on
  their device/emulator. For a real closed test on devices, run the backend on your LAN
  and point the app at it (edit `client/src/api/config.js` `NATIVE_API`) BEFORE building,
  then rebuild + re-sync + re-bundle.
- **Cleartext.** Cleartext traffic is restricted by `network_security_config.xml` to
  localhost / 10.0.2.2 only (dev). The manifest `usesCleartextTraffic` flag was removed.
  Bake the real `https://` endpoint into `NATIVE_API` for any release you hand to testers.
- **In-memory DB.** The backend resets + reseeds on every restart. Demo accounts and
  admin/data (GSTIN, grievance officer, fare policies) reset — re-enter them from the
  admin UI after a restart.
- **Version bumps.** Increase `versionCode` (and bump `versionName`) in
  `client/android/app/build.gradle` for each new release.
- **Ride-hailing policy.** A production-public listing of a ride-hailing app triggers
  heavy licensing/permit checks. Keep to **internal/closed testing** as decided.
- **State-wise fares.** On every start the server ensures all 36 Indian states/UTs
  have an explicit **active** fare-policy record, seeded from the national defaults and
  clearly labelled **"Framework default — verify against state notified fare order"**.
  These are placeholders, **not** verified regulatory rates: before any public listing,
  replace each state's `vehicleRates`, `surgeCap`, and `cancellationFee` in the admin
  **State Fares** page with the state transport dept's notified figures (and cite the
  `sourceLabel`/`sourceUrl`). The fare state is derived **server-side from the pickup
  coordinates** (a self-contained, keyless lat/lng→state lookup in
  `server/src/services/settings.js`), so a rider's manual state pick is only a
  cross-check and cannot apply the wrong fare regime.

---

## 6. Renewal / disaster checklist

- Back up `PLAY_STORE/keys/supertoto-release.jks` + both password files off-machine.
- Never lose the keystore; if you switch upload keys, Play App Signing supports key
  reset, but the app-signing key (Google's) is what must be kept.

---

## 7. Making the app reach a real backend (required for device testers)

The app is hardcoded to `127.0.0.1:5000`, which only works on the machine/emulator
hosting the backend. A tester on a physical phone **cannot reach your laptop's
localhost**. To run a real closed test on devices you must point the app at a
LAN-reachable or hosted backend **before building**, then rebuild + re-bundle.

The single file to change is `client/src/api/config.js` — both the HTTP API base and
the Socket.IO base come from `NATIVE_API`:

```js
// client/src/api/config.js
const NATIVE_API = 'http://127.0.0.1:5000';   // ← change this
```

- `apiBase()` returns `NATIVE_API` when running inside the Android app (native).
- `socketBase()` uses the same `NATIVE_API` for the Socket.IO connection.
- On the **web** (Vite) both return the same-origin/relative paths and are proxied to
  5000 by Vite — so web builds never need this change.

### Choose your backend endpoint

| Scenario | `NATIVE_API` value | Notes |
|---|---|---|
| Emulator (dev) | `http://10.0.2.2:5000` | AVD reaches host's localhost via 10.0.2.2 |
| LAN device test | `http://<your-PC-LAN-IP>:5000` | e.g. `http://192.168.1.50:5000`; phone & PC on same Wi-Fi |
| Hosted (closest to real Play) | `https://api.yourdomain.com` | Requires TLS, a real Mongo DB, and updating `network_security_config.xml` to allow that host |

> **IMPORTANT — cleartext.** Cleartext HTTP is currently allowed only for
> `localhost` and `10.0.2.2` (see `client/android/app/src/main/res/xml/network_security_config.xml`).
> A LAN `http://192.168.x.x` endpoint will be **blocked** unless you add that IP to the
> `domain-config` list (and ideally set `cleartextTrafficPermitted="true"` for dev only).
> For anything handed to testers, prefer HTTPS and bake the `https://` URL above.

### After changing `NATIVE_API` — full rebuild

```powershell
cd H:\Super Toto Local\client
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run build
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" exec capacitor sync android

# bump versionCode/versionName in android/app/build.gradle for each release first
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot"
cd android
.\gradlew.bat bundleRelease   # -> app/build/outputs/bundle/release/app-release.aab
```

### Backend also must be reachable + data caution

- Run the Node backend (`node src/index.js`) bound to `0.0.0.0` so LAN devices can
  connect (check it is not binding only to 127.0.0.1).
- The backend uses an **in-memory MongoDB that resets + reseeds on every restart**.
  Testers share this volatile dataset — demo accounts, GSTIN, grievance officer, and
  fare policies must be re-entered from the admin UI after a restart. For a long-lived
  test, point `server/.env` `MONGODB_URI` at a persistent Mongo (local or Atlas).

