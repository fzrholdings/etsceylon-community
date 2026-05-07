## ETS Ceylon FM Community (starter)

This is a free-hosted community tab (posts + images + comments + reactions) for ETS2 Sri Lanka players.

### What’s included
- Anonymous posting (users are anonymous to others)
- Posts: text + optional image
- Comments
- Like reactions
- Firestore security rules starter

### Setup (Firebase)
1. Create a Firebase project
2. Enable **Authentication → Sign-in method → Anonymous**
3. Create **Firestore Database** (production mode is fine)
4. Copy your web app config into `public/firebase-config.js`
5. (Optional but recommended) Enable **App Check** for Firestore to reduce spam.

### Setup (imgbb)
1. Create an imgbb account
2. Create an API key
3. Put it into `public/imgbb.js`

### Run locally
Just open `public/community.html` in a browser.

### Free deployment options
- **Cloudflare Pages (recommended)**: connect a GitHub repo, set build = none, output folder = `public`
- **Firebase Hosting**: deploy `public/` with the Firebase CLI (still free on Spark plan)

