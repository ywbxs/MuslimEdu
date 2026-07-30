# Compact Login Redesign – Install Guide

## What changed

- **Removed the illustration image** (`students-illustration-green.png`) -
  it was the single biggest thing taking up vertical space, and was the
  direct cause of "Register your school" / "Create your Alumni Account"
  getting cut off at the bottom on real devices.
- **Tightened spacing** throughout (title, field gaps, button heights,
  divider margins) so the remaining content - header, greeting, both
  fields, remember me / forgot password, the Log In button, the OR
  divider, and both outlined buttons - fits on one screen with no
  scrolling required, on essentially any phone size.
- The greeting now reads on a single line ("Peace be **upon you!**")
  instead of wrapping, since there's no illustration below it forcing a
  tall two-line title anymore.
- No `ScrollView` was added. The layout is sized to fit outright rather
  than relying on scroll as a safety net.

## Install

### Option A: Automated
```bash
cd /workspaces/MuslimEdu
bash setup-login-compact.sh
```

### Option B: Manual
```bash
cd /workspaces/MuslimEdu
unzip -o login-compact-redesign.zip
cp -r login-compact-redesign/src/* ./src/
rm -f ./src/assets/images/students-illustration-green.png
rm -rf login-compact-redesign login-compact-redesign.zip

git add .
git commit -m "feat: remove login illustration, tighten layout so it fits on one screen without scrolling"
git push
```

## Note

If you'd rather keep the illustration asset around for future use
elsewhere in the app, skip the `rm -f .../students-illustration-green.png`
line - it's optional cleanup, not required for the screen to work.
