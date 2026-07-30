#!/bin/bash

cd /workspaces/MuslimEdu || exit 1

echo "📦 Extracting compact login redesign..."
unzip -o login-compact-redesign.zip

echo "📋 Copying source files..."
cp -r login-compact-redesign/src/* ./src/

echo "🗑️  Removing the now-unused illustration asset..."
rm -f ./src/assets/images/students-illustration-green.png

echo "🧹 Cleaning up..."
rm -rf login-compact-redesign login-compact-redesign.zip

echo "📝 Staging changes..."
git add .

echo "💾 Committing changes..."
git commit -m "feat: remove login illustration, tighten layout so it fits on one screen without scrolling"

echo "🚀 Pushing to remote..."
git push

echo "✅ Complete! Compact login deployed."
