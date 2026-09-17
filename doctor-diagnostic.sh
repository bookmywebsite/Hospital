#!/bin/bash

# Quick Diagnostic for Doctor Selection Issues

echo "🏥 Doctor Selection Diagnostic"
echo "==============================="
echo ""
echo "This script checks why doctor selection might not be showing."
echo ""

API_BASE="http://localhost:3000"

# Test 1: Check if API endpoint exists
echo "1️⃣  Testing Doctor API Endpoint..."
response=$(curl -s "$API_BASE/api/doctors/available?date=2026-04-15")
echo "Response: $response"
echo ""

if echo "$response" | grep -q "success"; then
    echo "✅ API is returning data"
    if echo "$response" | grep -q '"doctors":\[\]'; then
        echo "⚠️  But doctors array is EMPTY"
        echo "   → Run: npm run seed-doctors"
        echo "   → Or manually add doctors to database"
    else
        echo "✅ Doctors found in response"
    fi
else
    echo "❌ API not responding correctly"
    echo "   → Check if Next.js server is running"
    echo "   → Check if API endpoint exists at /api/doctors/available"
fi

echo ""
echo "2️⃣  Database Check (run these SQL queries):"
echo ""
echo "Check if doctors exist:"
echo "   SELECT COUNT(*) as total, isActive FROM \"Doctor\" GROUP BY isActive;"
echo ""
echo "Check doctor details:"
echo "   SELECT id, name, specialization, isActive FROM \"Doctor\" LIMIT 5;"
echo ""
echo "Check doctor availability JSON:"
echo "   SELECT name, availability FROM \"Doctor\" LIMIT 1;"
echo ""
echo "3️⃣  If no doctors:"
echo "   → Run in terminal: npm run seed-doctors"
echo ""
echo "4️⃣  To test BookAppointmentModal:"
echo "   1. Go to CRM Tab"
echo "   2. Click on a patient name to expand"
echo "   3. Click 'Book Appointment' button"
echo "   4. Select a FUTURE date"
echo "   5. Doctor dropdown should populate"
echo ""
echo "5️⃣  If doctor dropdown still doesn't show:"
echo "   → Check browser console for errors (F12)"
echo "   → Look for fetch errors in Network tab"
echo "   → Check server terminal for [Doctors Available API] errors"
echo ""
