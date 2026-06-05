# Production Readiness Checklist

## CRITICAL — Must Fix Before Deployment

### Git History
- [ ] **Scrub secrets from git history** (use `git filter-repo`)
  Files to remove: `bus-tracking-7dcff-firebase-adminsdk-fbsvc-a118dbc578.json`, `backend/.env`
  ```bash
  pip install git-filter-repo
  git filter-repo --path bus-tracking-7dcff-firebase-adminsdk-fbsvc-a118dbc578.json --invert-paths
  git filter-repo --path backend/.env --invert-paths
  ```
- [ ] Force-push cleaned history to remote

### Production Configuration
- [ ] Set `ENVIRONMENT=production` in `backend/.env`
- [ ] Set `PROXY_ALLOWED_DOMAINS` to specific domains in production (not empty)
- [ ] Set `ALLOWED_ORIGINS` to production frontend URL(s) in `backend/.env`
- [ ] Generate a strong `SESSION_SECRET` (32+ random chars)
- [ ] Set `NEXT_PUBLIC_BACKEND_WS_URL` to production WebSocket URL (`wss://`)
- [ ] Set `NEXT_PUBLIC_BACKEND_URL` to production API URL (`https://`)
- [ ] Restrict Google Maps API key to production domain
- [ ] Enable Firebase App Check for production

## HIGH — Should Fix Before Go-Live

### Security
- [ ] Verify CSP header allows all required resources for production domains
- [ ] Override `CSP_HEADER` env var if default CSP needs customization
- [ ] Remove `'unsafe-inline'` and `'unsafe-eval'` from CSP if possible
- [ ] Remove `http://localhost:*` from `ALLOWED_ORIGINS` in production
- [ ] Review Firestore security rules for admin-only write access

### Firestore Security Rules
- [ ] Add admin-only write restrictions
- [ ] Test security rules with Firebase emulator
- [ ] Review and update all collection permissions

### Code Quality
- [ ] Remove all `console.log` debug statements (optional, currently used for monitoring)
- [ ] Replace `alert()` with toast notifications
- [ ] Add error boundaries for React components
- [ ] Implement proper error handling for API failures

---

## 🟢 MEDIUM PRIORITY - Recommended Improvements

### Features
- [ ] Implement JWT token refresh mechanism
- [ ] Add delete bus functionality
- [ ] Complete driver dashboard implementation
- [ ] Add loading states for all async operations
- [ ] Implement retry logic for failed API calls

### Performance
- [ ] Add Redis caching for GPS data (optional)
- [ ] Implement database indexing in Firestore
- [ ] Enable Next.js image optimization
- [ ] Add service worker caching strategy
- [ ] Implement lazy loading for heavy components

### Monitoring
- [ ] Set up error tracking (e.g., Sentry)
- [ ] Add analytics (e.g., Google Analytics)
- [ ] Configure uptime monitoring
- [ ] Set up log aggregation
- [ ] Create health check endpoints

---

## ⚪ LOW PRIORITY - Nice to Have

### User Experience
- [ ] Add push notifications
- [ ] Implement dark mode
- [ ] Add multi-language support
- [ ] Create onboarding tutorial
- [ ] Add user feedback system

### Documentation
- [ ] Create user manual
- [ ] Add API documentation (Swagger/OpenAPI)
- [ ] Write troubleshooting guide
- [ ] Document deployment process
- [ ] Create video tutorials

---

## ✅ Pre-Deployment Testing

### Functionality Tests
- [ ] Login/logout works for all roles (Admin, Parent, Driver)
- [ ] Admin can view all buses
- [ ] Admin can add new bus
- [ ] Admin can edit bus details
- [ ] Parent sees only assigned bus
- [ ] WebSocket connection establishes (green indicator)
- [ ] Real-time GPS updates work
- [ ] Maps display correctly with markers
- [ ] Mobile responsive design works
- [ ] PWA can be installed

### Backend Tests
- [ ] Backend starts without errors
- [ ] WebSocket endpoint works (`/ws/live`)
- [ ] Authentication endpoints work
- [ ] GPS data fetches from Fleet API
- [ ] All API routes return expected data
- [ ] CORS properly configured
- [ ] Logs writing to file correctly

### Browser Tests
- [ ] Chrome (desktop & mobile)
- [ ] Firefox (desktop & mobile)
- [ ] Safari (desktop & mobile)
- [ ] Edge (desktop)

### Load Tests (Optional)
- [ ] Test with multiple concurrent users
- [ ] Test WebSocket with many connections
- [ ] Monitor memory usage
- [ ] Check database query performance

---

## 🌐 Deployment Steps

### 1. Backend Deployment
- [ ] Set up production server (Linux recommended)
- [ ] Install Python 3.11+
- [ ] Create virtual environment
- [ ] Install dependencies from `requirements.txt`
- [ ] Install `websockets` package
- [ ] Copy `backend/.env` with production values
- [ ] Set up process manager (PM2, systemd, supervisor)
- [ ] Configure Nginx reverse proxy
- [ ] Enable HTTPS with SSL certificate
- [ ] Test backend accessible at production URL

### 2. Frontend Deployment
- [ ] Create production build (`pnpm build`)
- [ ] Test build locally (`pnpm start`)
- [ ] Deploy to Vercel/Netlify OR
- [ ] Set up Node.js server for self-hosting
- [ ] Configure environment variables on platform
- [ ] Set up custom domain
- [ ] Enable HTTPS
- [ ] Test frontend accessible

### 3. Database Setup
- [ ] Update Firestore security rules
- [ ] Create indexes for queries
- [ ] Set up backup schedule
- [ ] Configure retention policies
- [ ] Test database connections from production

### 4. DNS & SSL
- [ ] Point domain to server
- [ ] Install SSL certificate (Let's Encrypt)
- [ ] Configure automatic renewal
- [ ] Test HTTPS working
- [ ] Update all URLs to use https://

### 5. Post-Deployment
- [ ] Monitor logs for errors
- [ ] Test all features in production
- [ ] Check WebSocket connection
- [ ] Verify GPS updates
- [ ] Test from different devices
- [ ] Set up monitoring alerts
- [ ] Document admin credentials

---

## 📊 Performance Benchmarks

### Expected Metrics
- Page load time: < 3 seconds
- WebSocket connection: < 1 second
- GPS update latency: 5-10 seconds
- Map render time: < 2 seconds
- API response time: < 500ms
- Concurrent users: 50-100 (current setup)

### Monitoring Points
- Backend CPU usage
- Memory consumption
- Database read/write operations
- API call volume
- WebSocket connections count
- Error rate

---

## 🆘 Rollback Plan

### If Issues Occur After Deployment

1. **Immediate Actions**
   - Revert to previous version
   - Check logs for errors
   - Notify users of maintenance

2. **Debug Steps**
   - Check backend logs: `backend/logs/backend.log`
   - Check browser console for errors
   - Verify environment variables
   - Test WebSocket connection
   - Check Firestore connectivity

3. **Recovery**
   - Fix issues in development
   - Test thoroughly
   - Deploy fix
   - Monitor closely

---

## 📞 Emergency Contacts

### Technical Issues
- Backend Server: [Server provider support]
- Firebase: [Firebase support]
- Google Maps: [Google Cloud support]
- Fleet API: [Fleet API support]

### Access Required
- Server SSH access
- Firebase Console access
- Google Cloud Console access
- Domain registrar access
- SSL certificate management

---

## 📝 Sign-Off

### Development Team
- [ ] Code reviewed and tested
- [ ] Documentation complete
- [ ] Security issues addressed
- [ ] Performance acceptable

### Client/Stakeholder
- [ ] Features accepted
- [ ] Testing completed
- [ ] Documentation received
- [ ] Training completed

### DevOps/Infrastructure
- [ ] Server provisioned
- [ ] SSL configured
- [ ] Monitoring set up
- [ ] Backups configured

---

**Ready for Production**: ⬜ YES / ⬜ NO

**Notes:**
_Add any additional notes or concerns here_

---

**Checklist Completed By**: ________________  
**Date**: ________________  
**Approved By**: ________________  
**Date**: ________________
