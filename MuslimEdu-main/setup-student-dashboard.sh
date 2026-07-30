#!/bin/bash

# Navigate to project root
cd /workspaces/MuslimEdu || exit 1

echo "📦 Extracting student dashboard redesign..."
unzip -o student-dashboard-redesign.zip

echo "📋 Copying source files..."
cp -r student-dashboard-redesign/src/* ./src/

echo "🧹 Cleaning up..."
rm -rf student-dashboard-redesign student-dashboard-redesign.zip

echo "📝 Staging changes..."
git add .

echo "💾 Committing changes..."
git commit -m "feat: redesign student dashboard with parallax hero, profile glass card, monthly report hero, quick actions, and month overview stats"

echo "🚀 Pushing to remote..."
git push

echo "✅ Complete! Student dashboard redesign deployed."
