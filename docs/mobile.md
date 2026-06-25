# Ajosave Mobile App (Capacitor)

Ajosave ships as a native iOS and Android app via [Capacitor](https://capacitorjs.com/), wrapping the Next.js web app.

## Setup

### Prerequisites

- Node.js ≥ 20
- Xcode ≥ 15 (iOS)
- Android Studio + JDK 17 (Android)
- Capacitor CLI: `npm install @capacitor/cli @capacitor/core`
- Plugins: `npm install @capacitor/push-notifications @capacitor/status-bar @capacitor/splash-screen`

### Initialise native projects

```bash
npx cap add ios
npx cap add android
```

### Build and sync

```bash
npm run build:mobile   # Next.js static export → out/
npm run cap:sync       # Copy web assets + update plugins
```

Open in IDE:

```bash
npm run cap:open:ios      # Opens Xcode
npm run cap:open:android  # Opens Android Studio
```

## Capacitor plugins configured

| Plugin | Purpose |
|--------|---------|
| `@capacitor/push-notifications` | FCM / APNs push notifications |
| `@capacitor/splash-screen` | Launch splash screen (2 s, dark background) |
| `@capacitor/status-bar` | Dark status bar, `#0f172a` background |

Configuration lives in `capacitor.config.ts` at the project root.

## Mobile-specific layout

Safe-area CSS variables are defined in `src/styles/globals.css`:

```css
.capacitor-app .navbar { padding-top: calc(var(--space-4) + env(safe-area-inset-top)); }
.capacitor-app main    { padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom)); }
```

Add the `capacitor-app` class to `<body>` when running inside Capacitor:

```ts
import { Capacitor } from '@capacitor/core';
if (Capacitor.isNativePlatform()) document.body.classList.add('capacitor-app');
```

## GitHub Secrets required

Add these in **Settings → Secrets → Actions** on the repository:

### Android

| Secret | Description |
|--------|-------------|
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded `.jks` / `.keystore` file |
| `ANDROID_STORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias inside the keystore |
| `ANDROID_KEY_PASSWORD` | Key password |

Generate a keystore:

```bash
keytool -genkey -v -keystore ajosave.keystore \
  -alias ajosave -keyalg RSA -keysize 2048 -validity 10000
base64 ajosave.keystore | pbcopy   # macOS — paste into secret
```

### iOS

| Secret | Description |
|--------|-------------|
| `IOS_CERTIFICATE_BASE64` | Base64-encoded Apple Distribution `.p12` certificate |
| `IOS_CERTIFICATE_PASSWORD` | Password for the `.p12` file |
| `IOS_PROVISIONING_PROFILE_BASE64` | Base64-encoded `.mobileprovision` file |

Export from Keychain Access → export `.p12`, then:

```bash
base64 -i certificate.p12 | pbcopy
base64 -i profile.mobileprovision | pbcopy
```

## CI/CD

The workflow `.github/workflows/mobile.yml` runs on every push/PR to `main`:

- **Android** — debug APK always; signed release APK on `main` merges
- **iOS** — Release archive (`App.xcarchive`) on every run; signing imported on `main` merges

Artifacts are retained for 30 days.

## App Store submission (iOS)

1. In Xcode: **Product → Archive** (or use the CI archive artifact).
2. Open **Xcode Organizer**, select the archive, click **Distribute App**.
3. Choose **App Store Connect**, follow the wizard (automatic or manual signing).
4. Log in to [App Store Connect](https://appstoreconnect.apple.com), complete metadata, screenshots, and submit for review.

> Bundle ID must match `appId` in `capacitor.config.ts`: `app.ajosave.mobile`

## Play Store submission (Android)

1. The CI release step produces a signed APK at `android/app/build/outputs/apk/release/`.
2. For Play Store, prefer AAB: replace `assembleRelease` with `bundleRelease` — output is at `android/app/build/outputs/bundle/release/app-release.aab`.
3. Log in to [Google Play Console](https://play.google.com/console), create the app, upload the AAB under **Production → Releases**.
4. Complete store listing (description, screenshots, content rating) and submit for review.

> Package name must match `appId`: `app.ajosave.mobile`
