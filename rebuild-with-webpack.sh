#!/bin/bash

# COMPLETE FIX FOR TURBOPACK CRASH
# This script clears all Next.js and Node cache, then rebuilds using webpack

set -e

echo "==============================================="
echo "TURBOPACK FIX - Complete System Reset"
echo "==============================================="
echo ""

# Step 1: Stop any running dev server
echo "[1/5] Stopping any running dev server..."
pkill -f "next dev" || true
pkill -f "node" || true
sleep 2

# Step 2: Clear all cache and build artifacts
echo "[2/5] Clearing all cache and build artifacts..."
rm -rf .next
rm -rf .turbo
rm -rf node_modules/.cache
rm -rf dist
rm -rf build

# Step 3: Clean npm cache
echo "[3/5] Cleaning npm cache..."
npm cache clean --force

# Step 4: Reinstall dependencies fresh
echo "[4/5] Reinstalling dependencies (this may take 2-3 minutes)..."
npm ci

# Step 5: Start dev server with webpack (no Turbopack)
echo "[5/5] Starting dev server with webpack compiler..."
export NEXT_SKIP_TURBOPACK_TESTS=true
export TURBOPACK=false
npm run dev

echo ""
echo "==============================================="
echo "Rebuild complete! Dev server is now running."
echo "Open http://localhost:3000 in your browser"
echo "==============================================="
