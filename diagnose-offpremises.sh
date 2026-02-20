#!/bin/bash

# Off-Premises Check-In System Diagnostic Script
# This script helps verify the system is working correctly

echo "=========================================="
echo "OFF-PREMISES CHECK-IN SYSTEM DIAGNOSTIC"
echo "=========================================="
echo ""

echo "1. Checking environment variables..."
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ SUPABASE_SERVICE_ROLE_KEY is missing"
else
  echo "✅ SUPABASE_SERVICE_ROLE_KEY is set"
fi

if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  echo "❌ NEXT_PUBLIC_SUPABASE_URL is missing"
else
  echo "✅ NEXT_PUBLIC_SUPABASE_URL is set"
fi

echo ""
echo "2. Verifying application structure..."

if [ -f "next.config.mjs" ]; then
  echo "✅ next.config.mjs exists"
else
  echo "❌ next.config.mjs missing"
fi

if [ -f ".env.local" ]; then
  echo "✅ .env.local exists"
else
  echo "❌ .env.local missing"
fi

if [ -d "app/api/attendance" ]; then
  echo "✅ API routes directory exists"
else
  echo "❌ API routes directory missing"
fi

echo ""
echo "3. Checking critical API routes..."

if [ -f "app/api/attendance/check-in-outside-request/route.ts" ]; then
  echo "✅ check-in-outside-request API exists"
else
  echo "❌ check-in-outside-request API missing"
fi

if [ -f "app/api/attendance/offpremises/approve/route.ts" ]; then
  echo "✅ offpremises approval API exists"
else
  echo "❌ offpremises approval API missing"
fi

echo ""
echo "4. Checking database schema..."
echo "Run these queries in Supabase SQL Editor:"
echo ""
echo "-- Check pending_offpremises_checkins table"
echo "SELECT * FROM pending_offpremises_checkins LIMIT 1;"
echo ""
echo "-- Check attendance_records with off-premises status"
echo "SELECT id, user_id, approval_status, off_premises_request_id FROM attendance_records WHERE approval_status IS NOT NULL LIMIT 5;"
echo ""
echo "=========================================="
echo "Diagnostic Complete"
echo "=========================================="
