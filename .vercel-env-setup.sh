#!/bin/bash
# Helper script to display environment variables for Vercel setup
# Usage: bash .vercel-env-setup.sh

echo "=========================================="
echo "Firebase Environment Variables for Vercel"
echo "=========================================="
echo ""
echo "Copy these from your .env.local file and add them to Vercel:"
echo ""
echo "Variable Names:"
echo "  1. VITE_FIREBASE_API_KEY"
echo "  2. VITE_FIREBASE_AUTH_DOMAIN"
echo "  3. VITE_FIREBASE_PROJECT_ID"
echo "  4. VITE_FIREBASE_STORAGE_BUCKET"
echo "  5. VITE_FIREBASE_MESSAGING_SENDER_ID"
echo "  6. VITE_FIREBASE_APP_ID"
echo "  7. VITE_FIREBASE_MEASUREMENT_ID"
echo ""
echo "Current values from .env.local:"
echo ""

if [ -f .env.local ]; then
    echo "VITE_FIREBASE_API_KEY=$(grep VITE_FIREBASE_API_KEY .env.local | cut -d'=' -f2)"
    echo "VITE_FIREBASE_AUTH_DOMAIN=$(grep VITE_FIREBASE_AUTH_DOMAIN .env.local | cut -d'=' -f2)"
    echo "VITE_FIREBASE_PROJECT_ID=$(grep VITE_FIREBASE_PROJECT_ID .env.local | cut -d'=' -f2)"
    echo "VITE_FIREBASE_STORAGE_BUCKET=$(grep VITE_FIREBASE_STORAGE_BUCKET .env.local | cut -d'=' -f2)"
    echo "VITE_FIREBASE_MESSAGING_SENDER_ID=$(grep VITE_FIREBASE_MESSAGING_SENDER_ID .env.local | cut -d'=' -f2)"
    echo "VITE_FIREBASE_APP_ID=$(grep VITE_FIREBASE_APP_ID .env.local | cut -d'=' -f2)"
    echo "VITE_FIREBASE_MEASUREMENT_ID=$(grep VITE_FIREBASE_MEASUREMENT_ID .env.local | cut -d'=' -f2)"
    echo ""
    echo "✅ Found .env.local file"
else
    echo "⚠️  .env.local not found"
    echo "Please create it first using .env.example as template"
fi

echo ""
echo "Next steps:"
echo "1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables"
echo "2. Add each variable above (copy name and value)"
echo "3. Select Production, Preview, and Development for each"
echo "4. Save and redeploy"
echo ""

