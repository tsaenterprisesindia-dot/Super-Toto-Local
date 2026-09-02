# 🛺 Super Toto Local

A full-stack ride-hailing web app (like Ola / Uber / Rapido) for booking local totos & e-rickshaws — with rider booking, driver dispatch, live GPS tracking, admin dashboard, **Face Recognition login** for riders/drivers, and mock payments.

MERN stack:

- **Backend** — Node.js, Express, MongoDB (Mongoose), Socket.io (live tracking), JWT auth. Face descriptors are matched server-side with L2 distance.
- **Frontend** — React 18, Vite, React Router, React Leaflet (OpenStreetMap), Axios, Socket.io client. Face-recognition models (`face-api.js`) are loaded at runtime from a CDN, keeping the bundle small.

## Features

| Area | What you get |
| --- | --- |
| 👤 Rider | Pick pickup/drop on map, live fare estimate, request a toto, track driver in real time, cancel, mock UPI payment, rate the driver, ride history |
| 🛺 Driver | Online/offline toggle, receive ride requests with a 25s accept window, arrive → start → complete trip, rate the rider, earnings summary, simulated GPS |
| 🛠️ Admin | Live stats (riders, drivers online, rides, revenue), approve / block driver accounts, view all rides & riders |
| 😀 Face Recognition login | Riders & drivers scan their face to log in. Admins always use password. Password is always a fallback. |
| 🔌 Live tracking | WebSocket streaming of driver location; nearest-driver dispatch queue with timeout fallback |

## Quick start

```bash
npm install       # installs server + client (npm workspaces)
npm run dev       # starts API on :5000 and the Vite client on :5173
```

Open **http://localhost:5173**. The Vite dev server proxies `/api` and `/socket.io` to the API.

## Demo accounts

| Role | Email | Password | Face login |
| --- | --- | --- | --- |
| Rider | `rider@supertoto.local` | `demo123` | Register a face first (see below) |
| Driver | `driver@supertoto.local` | `demo123` | Register a face first |
| Admin | `admin@supertoto.local` | `demo123` | Password only (no face) |

> Seeded accounts log in by **password** first. Then open **Profile → Register face** to enable Face Recognition login. After that you can use **Login → Log in with Face Recognition**.

## Face Recognition login — how it works

1. At enrollment the browser loads `face-api.js` + models (~7 MB, cached) and uses your **webcam** to detect a face and compute a 128-dimension **face descriptor**.
2. The descriptor is sent to the server **once** and stored on your user document. **Your photo / image never leaves your device** — only the numeric descriptor is persisted.
3. At login, a fresh selfie descriptor is compared to the stored one using **Euclidean distance on L2-normalized descriptors**. `FACE_MATCH_THRESHOLD` (default `0.6`, max match distance) decides acceptance. Genuine matches score low; non-matches are rejected.
4. If anything fails (camera blocked, no face detected, poor match), you always fall back to **password** login.
5. **Admins are never enrolled** — `/api/auth/face-login` returns 403 for admin accounts.

### Routes

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | public | Register (rider/driver/admin) |
| POST | `/api/auth/login` | public | Password login (everyone) |
| POST | `/api/auth/face-login` | public | Face login — riders/drivers only, admins blocked |
| POST | `/api/face/register` | auth (rider/driver) | Store your face descriptor |
| POST | `/api/face/verify` | auth (rider/driver) | Verify a selfie descriptor against your stored face |

## Live ride demo walkthrough

1. Log in as **driver** → go online (an admin must approve the account first; the seeded `driver@…` is approved).
2. Log in as **rider** → set pickup & drop, see the fare estimate, tap **Request toto**.
3. The driver receives a request modal → tap **Accept**.
4. The rider sees the toto 🛺 approach live on the map (driver GPS is simulated in the demo).
5. Driver: **arrived → start trip → complete trip**.
6. Rider: **Pay** (mock UPI) → **rate the driver**.

## Data storage

- By default the app uses **MongoDB in-memory** (`mongodb-memory-server`), so it runs with zero setup. Data resets on each restart, and demo data is auto-seeded on first boot.
- For a persistent DB, copy `server/.env.example` → `server/.env` and set `MONGODB_URI` (Atlas/local). `npm run seed` force-seeds demo data into an empty DB.

## Configuration (`server/.env.example`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | (in-memory) | Persistent MongoDB connection (Atlas/local) |
| `JWT_SECRET` | *(required for non-local runs)* | JWT signing secret — the server **refuses to start in production without it** |
| `UPI_ID` | *(empty)* | Operator UPI handle for payments (`Admin → Settings → UPI` can also set it) |
| `FACE_MATCH_THRESHOLD` | `0.6` | Max L2 distance to accept a face match |
| `PORT` | `5000` | API port |

## Project structure

```
server/src
  config/db.js            MongoDB (memory or MONGODB_URI)
  models/                 User (faceDescriptor / faceRegistered), Ride
  middleware/             JWT auth + roles, error handling
  routes/                 auth (login / face-login / me), face (register/verify),
                          rides, driver, admin
  socket.js               live tracking, ride dispatch queue
  utils/pricing.js        fare model + face matching helpers
  seed.js                 demo users & rides
client/src
  context/                AuthContext, SocketContext, FaceProvider (loads face-api.js + models)
  components/             MapView, RideTracker, Nav, Modal, FaceCapture (webcam modal)
  pages/                  Landing, Login (password + face-login page), Register, RiderHome,
                          DriverHome, AdminDashboard, RideHistory, Profile, FaceLogin, ForgotPassword
```

## Useful scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run API + client with hot reload |
| `npm run dev:server` | API only |
| `npm run dev:client` | Client only |
| `npm run seed` | Force-seed demo data |
| `npm run build` | Production build of the client |

## Fare model

`base ₹30 + ₹14/km + ₹1.5/min`, minimum ₹40, optional surge multiplier — see `server/src/utils/pricing.js`.

## Notes

- **Driver GPS** is simulated in the demo so the full flow works anywhere. A real driver app would stream `navigator.geolocation` (the `driver:location` socket event is identical).
- **Payments** are mocked end-to-end.
- **Face login** needs camera permission. If the browser blocks it, password login always works.
