# Vercel Deployment Troubleshooting

## SSL Certificate Error: "unable to get local issuer certificate"

This error typically occurs due to:
1. Corporate proxy/firewall blocking SSL certificates
2. System certificate store issues
3. Network configuration problems

### Solution 1: Use Vercel Dashboard (Recommended)

Instead of CLI, deploy via GitHub + Vercel Dashboard:

1. **Push your code to GitHub:**
   ```bash
   git add .
   git commit -m "Initial commit for Vercel deployment"
   git push origin main
   ```

2. **Deploy via Dashboard:**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New..." → "Project"
   - Import your GitHub repository
   - Vercel will auto-detect settings
   - Add environment variables in Settings → Environment Variables
   - Click Deploy

This bypasses CLI SSL issues entirely.

### Solution 2: Fix SSL Certificate (Corporate Networks)

If you're on a corporate network:

1. **Get the corporate certificate:**
   - Contact your IT department
   - They should provide the CA certificate file

2. **Add to Node.js:**
   ```bash
   # On macOS/Linux
   export NODE_EXTRA_CA_CERTS=/path/to/corporate-cert.pem
   
   # Or set in your shell profile (~/.zshrc or ~/.bashrc)
   echo 'export NODE_EXTRA_CA_CERTS=/path/to/corporate-cert.pem' >> ~/.zshrc
   source ~/.zshrc
   ```

3. **Try deploying again:**
   ```bash
   vercel
   ```

### Solution 3: Temporary SSL Bypass (Not Recommended for Production)

⚠️ **Only use this if you understand the security implications**

```bash
# Set environment variable to bypass SSL verification
export NODE_TLS_REJECT_UNAUTHORIZED=0

# Then try vercel
vercel

# Unset after deployment
unset NODE_TLS_REJECT_UNAUTHORIZED
```

**Security Warning:** This makes your connection insecure. Only use temporarily.

### Solution 4: Update Certificates (macOS)

If you're on macOS and not on a corporate network:

```bash
# Update certificates
brew update
brew install ca-certificates

# Or try updating Node.js
brew upgrade node
```

### Solution 5: Use Different Network

- Try from a different network (home vs office)
- Try using mobile hotspot
- This will help identify if it's network-specific

## Recommended Approach

**Best option: Deploy via Vercel Dashboard**

1. Push code to GitHub
2. Import to Vercel Dashboard
3. Add environment variables in dashboard
4. Deploy

This is actually easier and more reliable than CLI for most users!

## Still Having Issues?

1. Check Vercel status: https://status.vercel.com
2. Check your firewall/antivirus settings
3. Try from a different network
4. Contact Vercel support: support@vercel.com

