#!/bin/bash

cd /workspaces/MuslimEdu || exit 1

echo "📦 Extracting skeleton loading redesign..."
unzip -o skeleton-loading-redesign.zip

echo "📋 Copying source files..."
cp -r skeleton-loading-redesign/src/* ./src/

echo "🧹 Cleaning up..."
rm -rf skeleton-loading-redesign skeleton-loading-redesign.zip

echo "📝 Staging changes..."
git add .

echo "💾 Committing changes..."
git commit -m "feat: replace loading spinners and launch splash with skeleton loaders"

echo "🚀 Pushing to remote..."
git push

echo "✅ Complete! Skeleton loading deployed."
