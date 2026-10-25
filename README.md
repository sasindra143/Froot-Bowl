# Froot Bowl Markapur

A mobile-responsive fruit-ordering website with separate React frontend and Express backend folders. Customers place orders through the storefront, and administrators receive orders and manage delivery statuses from the admin dashboard. Orders and accounts are persisted locally for development.

## Technology

| Area | Technology |
| --- | --- |
| Customer and admin interfaces | React 18, JavaScript, CSS |
| Frontend development and production build | Vite 6 |
| Icons | lucide-react |
| API server | Node.js 20.11+ and Express 4 |
| API authentication | Signed HTTP-only session cookie; passwords hashed with Node.js `scrypt` |
| Local development persistence | JSON file at `backend/data/store.json` |
| Order updates | Customer/admin order lists refresh every five seconds |
| Checkout address picker | Leaflet/OpenStreetMap tiles and server-proxied Nominatim search/reverse geocoding |
| Delivery address map links | Google Maps directions links |

Firebase, React Native/Expo, Google Routes/ETA, push notifications, and online payments are **not** configured in this project.

## Folder structure

```text
Froot Bowl/
├── .gitignore
├── README.md
├── backend/
│   ├── .env.example           # Backend configuration template; copy to .env
│   ├── package.json
│   ├── package-lock.json
│   ├── src/
│   │   └── server.js          # Express API, auth, orders, delivery status, reports
│   └── data/
│       └── store.json         # Created at runtime; ignored by Git
└── frontend/
    ├── .env.example           # Google Maps key template; copy to .env.local
    ├── .env.local             # Local Maps key; ignored by Git
    ├── index.html
    ├── package.json
    ├── package-lock.json
    ├── vite.config.js         # Proxies /api to localhost:3001
    ├── public/
    │   └── assets/
    │       ├── froot-bowl-logo.jpeg
    │       └── fruit-placeholder.svg
    └── src/
        ├── App.jsx            # Customer storefront and admin portal
        ├── main.jsx           # React entry point
        └── styles.css         # Responsive page and component styles
```

`node_modules/`, `frontend/dist/`, `backend/.env`, `frontend/.env.local`, and `backend/data/` are local-only and excluded from Git.

## Run locally

Install Node.js 20.11 or newer. Open two PowerShell terminals from the project root.

### 1. Configure and start the backend

```powershell
Set-Location backend
npm install
Copy-Item .env.example .env
# Edit .env and set ADMIN_EMAIL, a strong ADMIN_PASSWORD, and a long random SESSION_SECRET.
npm run dev
```

The API listens on `http://localhost:3001`. Health check: [http://localhost:3001/api/health](http://localhost:3001/api/health).

### 2. Configure and start the frontend

```powershell
Set-Location frontend
npm install
Copy-Item .env.example .env.local
# Add a Google Maps JavaScript API key with Maps JavaScript API and Places API enabled.
npm run dev
```

Open the customer website at [http://localhost:5173/](http://localhost:5173/). Vite forwards `/api` requests to the backend.

### Private staff links

- Admin portal: [http://localhost:5173/admin](http://localhost:5173/admin)

The rider portal has been removed; visiting `/rider` redirects to the customer storefront. Admin credentials are configured only in the local `backend/.env`; never put passwords in this README or frontend source.

### Production frontend build

The Vite build uses `/` as its public base path. The root `netlify.toml` sets the base directory to `frontend`, runs `npm run build`, and publishes `dist`. Build it locally with:

```powershell
Set-Location frontend
npm install
npm run build
```

The output is in `frontend/dist`. The Express API must be deployed separately and configured to serve the frontend's `/api` requests for sign-in, orders, address lookup, and admin features to work.

## Main flows

### Customer

1. Register or sign in with a customer account.
2. Add the ₹59 small or ₹89 regular fruit box to the bag.
3. At checkout, choose a saved address or enter the recipient’s details. Search for a house number, street, locality, or landmark, or choose one of the common Markapur search terms. Search terms are looked up live in OpenStreetMap; only returned OSM results are shown as places, with their actual coordinates. Tap the map or drag the pin when the house/street is not mapped, then add a nearby landmark and delivery instructions. Reverse geocoding shows the nearest mapped street/landmark but does not claim that an unmapped house is verified. The server checks the selected coordinates against the configured delivery center and radius; the boundary is inclusive. Authenticated customers can save and remove addresses for reuse.
4. Place an order using cash on delivery or WhatsApp confirmation.
5. View order progress without date/time stamps as Froot Bowl updates the status.

### Admin

- Sign in through `/admin`; customer login cannot grant admin access.
- View active, delivery, and historical orders, with daily, weekly, monthly, and yearly order/revenue summaries. Counts use order creation time. Revenue counts orders marked delivered in the selected period; cancelled and undelivered orders are not counted as revenue.
- Update order statuses directly in the dashboard, including **Out for delivery**, **Delivered**, and **Cancelled**. Assignment to a rider is not required.
- Review and correct each order's delivery street, locality, landmark, instructions, and coordinates. Admin address changes are recorded in the order's review history and rechecked against the service radius.
- Configure the service center by searching, using the admin device's location, or selecting a point on the map. Set a reference address, radius, and whether delivery is enabled; these settings persist in the local JSON store.
- Customer order timelines show progress without date or time stamps.

## Order identifiers and storage

Each order receives an `FB-`-prefixed UUID generated by the backend. The backend checks the existing order list before saving the ID, preventing duplicate IDs in the local store. An idempotency key also prevents a retried checkout request from creating a duplicate order.

The local JSON store is convenient for a single-machine demo, not production. It is not a managed database and is not safe for concurrent multi-instance writes. For production, replace this with a transactional database, configure backups and retention, use HTTPS, and review access controls and privacy obligations.

## API overview

| Method and path | Purpose | Access |
| --- | --- | --- |
| `GET /api/health` | Backend health | Public |
| `GET /api/menu` | Product catalogue | Public |
| `POST /api/auth/register` | Customer registration | Public |
| `POST /api/auth/login` | Customer login | Public |
| `POST /api/auth/login` with `adminOnly: true` | Admin portal login | Public login endpoint; admin credentials only |
| `GET /api/auth/me`, `POST /api/auth/logout` | Restore/end session | Signed-in account |
| `GET /api/config`, `POST /api/coverage/check` | Read delivery boundary and validate map coordinates | Public |
| `GET /api/geocode/search?q=...`, `GET /api/geocode/reverse?lat=...&lon=...` | Search/reverse-geocode live OpenStreetMap data | Public; rate-limited and cached |
| `GET /api/profile/addresses`, `POST /api/profile/addresses` | List/save the signed-in customer's addresses | Customer account |
| `PUT /api/profile/addresses/:id/default`, `DELETE /api/profile/addresses/:id` | Select or delete an owned saved address | Customer account |
| `GET /api/admin/coverage`, `PUT /api/admin/coverage` | Read/update center, radius, and coverage availability | Admin |
| `POST /api/orders`, `GET /api/orders` | Place/list orders | Customer; list is scoped to role |
| `PATCH /api/admin/orders/:id/status` | Update order status, including delivered | Admin |
| `PATCH /api/admin/orders/:id/address` | Review/correct an order address and delivery coordinates | Admin |
| `DELETE /api/admin/orders/:id` | Delete a delivered order | Admin |

All protected routes require the signed HTTP-only session cookie. The API checks roles and order ownership. Legacy rider-related API routes remain in the backend for existing data, but there is no rider portal or rider assignment workflow in the application.

## Development and build

```powershell
# Frontend production build
Set-Location frontend
npm run build

# Backend syntax check
Set-Location ..\backend
node --check src/server.js
```

## Current boundaries

- This is a browser-based customer website and admin portal, not a native Android app.
- Destination directions links open Google Maps and do not require an API key. Google Routes ETA and route optimization are not implemented.
- Delivery eligibility defaults to a 6 km radius around the configured Markapur coordinates. Customers can order remotely and select a recipient’s pin inside the Markapur service area.
- The admin dashboard can update the center and radius; customer location checks and order creation use the same backend geospatial calculation. A point exactly on the radius is considered serviceable.
- Map tiles and address lookup use OpenStreetMap; search/reverse-geocoding results are not synthesized. Nearby suggested names are search terms only, and a name without an OSM match is not presented as a verified address. Manually selected pins remain unverified until reviewed; reverse geocoding can only report the nearest mapped feature. No generated sample points are loaded or stored as real house addresses. Coverage decisions use coordinates and the server-side radius check, not the PIN code.
- Monthly fruit packs are enquiries only. General-purpose OTP, SMS/push notifications, password reset, online card/UPI payments, rider GPS tracking, and automated calling are not configured.
- Product and lifestyle photographs are illustrative; replace them with approved business images before launch.
