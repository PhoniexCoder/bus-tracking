# 🚀 Deployment Fix - File Download Issue Resolved

## Problem
Website was downloading `/app/page.tsx` instead of rendering it because:
1. The Next.js build was failing due to corrupted camera page file
2. The server was serving files as static content instead of Next.js routes

## Solution
✅ Fixed corrupted `app/admin/cameras/page.tsx` file  
✅ Build now completes successfully  
✅ All routes are properly configured

---

## 📋 Deployment Checklist for Production

### 1. Build the Application
```bash
cd /var/www/bus-tracking
npm run build
# or
pnpm build
```

**Verify build success:**
- Should see "Compiled successfully"
- No errors in the build output
- `.next` folder should be created

### 2. Restart Frontend Service
```bash
sudo systemctl restart bus-tracking-frontend
sudo systemctl status bus-tracking-frontend
```

### 3. Clear Nginx Cache (if using caching)
```bash
sudo systemctl reload nginx
```

### 4. Test the Routes

**Test home page:**
```bash
curl -I https://yourdomain.com/
```

**Test admin dashboard:**
```bash
curl -I https://yourdomain.com/admin/dashboard
```

**Test camera page:**
```bash
curl -I https://yourdomain.com/admin/cameras
```

All should return `200 OK` and `Content-Type: text/html`

---

## 🔧 If Still Experiencing Issues

### Check Next.js is Running
```bash
# Should see Next.js running on port 3000
sudo netstat -tulpn | grep 3000
```

### Check Nginx Configuration
```bash
# Test config
sudo nginx -t

# View error logs
sudo tail -f /var/log/nginx/bus-tracking-error.log
```

### Check Frontend Logs
```bash
sudo journalctl -u bus-tracking-frontend -f
```

### Verify Build Output
```bash
ls -la /var/www/bus-tracking/.next/
# Should see: server/, static/, BUILD_ID, package.json, etc.
```

---

## 🌐 Nginx Configuration Key Points

Your Nginx config should proxy to Next.js for all routes:

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

**NOT like this** (this would cause download issues):
```nginx
location / {
    root /var/www/bus-tracking;  # ❌ Wrong! Don't serve files directly
}
```

---

## ✅ Final Verification

1. **Visit in browser:** `https://yourdomain.com`
   - Should load the home page
   - Should NOT download any files

2. **Visit:** `https://yourdomain.com/admin/dashboard`
   - Should load the dashboard
   - Should require login

3. **Visit:** `https://yourdomain.com/admin/cameras`
   - Should load cameras page
   - Shows "Coming Soon" message

4. **Check Developer Console (F12)**
   - No 404 errors for JS/CSS files
   - No CORS errors
   - API calls to `/api/*` should work

---

## 🔄 Update Deployment Process

When you make changes and need to redeploy:

```bash
# 1. Pull latest code
cd /var/www/bus-tracking
git pull origin main

# 2. Install dependencies if package.json changed
npm install
# or
pnpm install

# 3. Rebuild
npm run build

# 4. Restart frontend
sudo systemctl restart bus-tracking-frontend

# 5. Verify
sudo systemctl status bus-tracking-frontend
```

---

## 🎯 Current Status

✅ Build successful  
✅ Camera page simplified (no streaming for now)  
✅ All routes properly configured  
✅ Ready for deployment

Your application is now ready to be deployed without the file download issue!
