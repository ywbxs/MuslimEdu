# android-config/

`google-services.json` here is a **placeholder** so the CI build (which
scaffolds a fresh Android project on every run) has a structurally valid
file to satisfy the Google Services Gradle plugin and produce an APK. It
points at a fake project (`muslimedu-placeholder`) and will never actually
receive push notifications.

To make push notifications work on real devices:

1. Create/open the app's project at https://console.firebase.google.com
2. Add an Android app with package name `com.muslimeduu`
3. Download the real `google-services.json` from Project Settings
4. Replace this file with it and push - the next CI build will bundle the
   real config

The server-side piece (the credentials the Laravel backend uses to actually
*send* a push through Firebase) is configured separately, in-app, via
Superadmin -> Firebase Configuration - see `src/screens/superadmin/FirebaseConfigScreen.tsx`.
