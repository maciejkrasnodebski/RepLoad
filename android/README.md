# RepLoad for Android

This native Android shell opens the live RepLoad app at
`https://repload.vercel.app/`. It uses Android WebView with JavaScript,
DOM storage, first-party cookies, hardware acceleration, swipe-to-refresh,
native back navigation, and a branded RepLoad launcher icon. API requests stay
on the Vercel origin and are proxied to Render by the existing frontend.

## Build

Requirements: JDK 17 or newer and Android SDK Platform 35.

From the GymLab project root, run:

```powershell
.\android\build-apk.ps1
```

The script selects a JDK 17+ (even if `java` on `PATH` is Java 8), locates
Android SDK Platform 35, builds the app, and copies the result to `RepLoad.apk`
in the project root.

To run Gradle directly instead, set `JAVA_HOME` to the JDK 17+ directory and
ensure its `bin` folder is first on `PATH` before starting Gradle. Check
`java -version` and `.\gradlew.bat --version` both report Java 17 or newer;
Gradle daemons started with Java 8 must be stopped before rebuilding:

```powershell
.\gradlew.bat --stop
.\gradlew.bat assembleDebug
```

The installable debug APK is written to `RepLoad.apk` in the project root.
Debug APKs are signed with Android's development key. A Play Store release
needs a separately managed release signing key; never commit that key.
