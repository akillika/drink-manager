# Deployment Guide - Vercel

This guide walks you through deploying the Alcohol Tracker app to Vercel.

## Prerequisites

- A Vercel account (free tier works)
- Your Firebase project credentials ready
- Git repository (GitHub recommended)

## Method 1: Deploy via Vercel Dashboard (Easiest)

### Step 1: Push to GitHub

```bash
# Initialize git if not already done
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo-url>
git push -u origin main
```

### Step 2: Import to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository
4. Vercel will auto-detect Vite settings

### Step 3: Configure Environment Variables

1. In the Vercel project settings, go to **Settings** → **Environment Variables**
2. Add these 7 variables (copy values from your `.env.local` file):

| Variable Name | Value |
|--------------|-------|
| `VITE_FIREBASE_API_KEY` | Your Firebase API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Your Firebase Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | `your-project.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Your Messaging Sender ID |
| `VITE_FIREBASE_APP_ID` | Your App ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | Your Measurement ID (optional) |

3. Select **Production**, **Preview**, and **Development** for each variable
4. Click **Save**

### Step 4: Deploy

1. Click **"Deploy"** button
2. Wait for the build to complete
3. Your app will be live at `your-project.vercel.app`

### Step 5: Update Firebase Settings

1. Go to Firebase Console → Authentication → Settings
2. Under "Authorized domains", click **"Add domain"**
3. Add: `your-project.vercel.app`
4. Also add your custom domain if you set one up

## Method 2: Deploy via Vercel CLI

### Step 1: Install Vercel CLI

```bash
npm i -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

### Step 3: Deploy

```bash
# First deployment (preview)
vercel

# Production deployment
vercel --prod
```

### Step 4: Add Environment Variables

```bash
# Add each environment variable
vercel env add VITE_FIREBASE_API_KEY production
# Paste your value when prompted, press Enter

vercel env add VITE_FIREBASE_AUTH_DOMAIN production
vercel env add VITE_FIREBASE_PROJECT_ID production
vercel env add VITE_FIREBASE_STORAGE_BUCKET production
vercel env add VITE_FIREBASE_MESSAGING_SENDER_ID production
vercel env add VITE_FIREBASE_APP_ID production
vercel env add VITE_FIREBASE_MEASUREMENT_ID production

# Add for preview and development too (repeat for each environment)
vercel env add VITE_FIREBASE_API_KEY preview
vercel env add VITE_FIREBASE_API_KEY development
# ... repeat for all variables
```

### Step 5: Redeploy with Environment Variables

```bash
vercel --prod
```

## Quick Copy-Paste Commands

If you have your `.env.local` file ready:

```bash
# From your .env.local, copy values and add them via CLI
# Example:
vercel env add VITE_FIREBASE_API_KEY production
# Then paste: your-actual-api-key-here
# Press Enter
```

## Verification Checklist

After deployment, verify:

- [ ] Build completes successfully
- [ ] App loads at Vercel URL
- [ ] No "Missing Firebase configuration" errors in browser console
- [ ] Google Sign-In button appears
- [ ] Can sign in successfully
- [ ] Can add entries
- [ ] Data persists (Firestore working)

## Custom Domain (Optional)

1. Go to Vercel Dashboard → Settings → Domains
2. Add your custom domain
3. Follow DNS setup instructions
4. Update Firebase Authorized Domains with your custom domain

## Troubleshooting

### Build Fails
```bash
# Test build locally first
npm run build

# Check Vercel build logs for specific errors
```

### Environment Variables Not Working
- Ensure variable names start with `VITE_`
- Redeploy after adding variables
- Check variable names match exactly (case-sensitive)

### Google Sign-In Fails
- Verify Vercel domain is in Firebase Authorized Domains
- Check browser console for specific errors

### App Shows "Missing Firebase configuration"
- Verify all 7 environment variables are set in Vercel
- Ensure they're set for the correct environment (Production/Preview)
- Redeploy after adding variables

## Updating the Deployment

After pushing code changes:

```bash
git push origin main
```

Vercel will automatically deploy if GitHub integration is enabled.

Or manually:

```bash
vercel --prod
```

