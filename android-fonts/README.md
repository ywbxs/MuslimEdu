# android-fonts/

Custom fonts bundled into the Android build. Same pattern as
`android-icons/` and `android-config/` - these files don't live in `src/`
(which is copied wholesale into the CI-scaffolded project) so each build
workflow has an explicit "copy fonts" step that drops them into
`android/app/src/main/assets/fonts/`. Android resolves a `fontFamily` value
to a file in that folder by filename (no linking step needed), so
`fontFamily: 'PlayfairDisplay-SemiBoldItalic'` in a `StyleSheet` maps
directly to `PlayfairDisplay-SemiBoldItalic.ttf` here.

## PlayfairDisplay-SemiBoldItalic.ttf

The italic serif accent font from the login redesign mockup (`em`/accent
text set in `'Playfair Display', serif` at weight 600 italic). Google
Fonts only publishes Playfair Display as a variable font now (no static
per-weight files), so this is a static weight-600 italic instance
generated from the variable font with `fonttools`:

```
curl -L -o PlayfairDisplay-Italic[wght].ttf \
  "https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/PlayfairDisplay-Italic%5Bwght%5D.ttf"
fonttools varLib.instancer -o PlayfairDisplay-SemiBoldItalic.ttf \
  "PlayfairDisplay-Italic[wght].ttf" wght=600
```

`OFL.txt` is the SIL Open Font License this font ships under (required
alongside the font file for redistribution) - sourced from the same
`google/fonts` repo path.

This app is Android-only (see the build workflows - no iOS project is
scaffolded), so only the Android assets/fonts path is wired up. If an iOS
build is ever added, this same .ttf also needs to be added to the Xcode
project and listed under `UIAppFonts` in `Info.plist`.
