# Avi Infotech · Field Service & Shop

Internal app for Avi Infotech, a camera and hardware company. It runs the field-service desk (jobs, technicians, reviews) and the shop counter (barcode billing, stock, sales history, customers).

**Flow:** Admin logs a customer query and assigns it to one or more technicians → technicians get a real-time notification (in-app toast, sound, desktop alert) → a technician accepts, goes to site, fixes it, and submits photos plus the customer's name, phone and address → admin verifies and marks it **complete** → the customer gets an **SMS with a review link** → the review appears on the public **/reviews** page, readable without login.

## Features

- **Roles:** Admin and Technician, each with their own dashboard. Admins add team members, set passwords and disable accounts.
- **Queries:** customer details, site address, device type, priority (Low to Urgent), optional visit time, multiple technicians. Admin can change the crew later.
- **Real-time:** Server-Sent Events push notifications and live page refreshes. A notification bell keeps history, with unread counts and opt-in desktop notifications.
- **Completion report:** take photos with the phone camera or pick files (drag and drop on desktop), with automatic resizing and an upload progress bar. Up to 12 photos.
- **Verification:** admin sees photos (with lightbox), notes and an activity timeline, then either **Verify & complete** (sends the SMS) or **Send back** with a note (technicians are notified).
- **SMS:** pluggable provider (`console` for testing, `twilio` for real texts). Every message is listed under **Admin → SMS log**.
- **Public reviews:** star rating and comment through a unique, one-time link. The public page shows the average, rating breakdown and filters. Admins can hide a review.
- **Sign up:** technicians create their own account at `/signup`. Admins get a live notification and approve or reject it from **Team**. Pending accounts can't sign in until they're approved. On a brand-new database, the very first sign-up becomes the admin.
- **Auth:** show/hide password toggle, password strength meter, forgot password by email (30-minute one-time link), rate-limited login, and sessions that end when a password is reset or an account is disabled.
- **UI:** glacier-white light theme and deep-navy dark theme with a circular reveal on switch. Typography uses Inter (bundled in `src/app/fonts`, chosen for legibility) and JetBrains Mono for codes. Interactive text includes word reveals, rotating words, letters that react on hover and scrambling ticket codes. Also cursor spotlight cards, count-up stats and spring animations. Works on mobile with a bottom nav for technicians, and respects reduced-motion settings. No orange anywhere.

## Shop: billing and stock

- **Barcode billing** (`Admin → Billing`): plug in any USB or Bluetooth barcode scanner. Scanners type like a keyboard, so there's no driver or setup. Scan a box and it's added to the bill with its name, category, MRP and GST. Scanning the same item again adds 1 to its quantity. Scans are caught even when the cursor isn't in the scan box.
- **No barcode? Type instead.** Type part of a name, brand, model or SKU in the same box and pick from the list. Products without a barcode get an `AVI-00001` style SKU you can type or print on a label.
- **Unknown barcode:** the billing screen offers to add it to the catalog on the spot, with the barcode filled in.
- **Customer details:** name, phone, address, email and GSTIN. Type a phone number and returning customers are suggested and filled in. Tick *Walk-in* for a quick sale without details.
- **Bill / invoice:** per-line price and discount, GST worked out from the GST-inclusive price (CGST + SGST split), round-off to the rupee, amount in words, payment mode (cash, UPI, card, bank, credit). Print it or save it as PDF from the browser (A4 print layout).
- **Stock goes down automatically** when a bill is saved, and comes back if the bill is cancelled. A bill can't sell more than is in stock, even from two counters at the same moment.
- **Products & stock** (`Admin → Products`): every product with category, brand, model, barcode/SKU, MRP, selling and cost price, GST, HSN, warranty and stock. Filter by category, low stock or out of stock. Stock value at selling and cost price. Scan a box on this page to add it.
- **One name everywhere: "GST" and "Without GST".** Buttons, filters, badges and settings all use these two names, for both sales and purchases.
- **GST or Without GST purchase:** every product records how you bought it, either with a supplier's GST bill (**GST**) or on a bill without GST (**Without GST**). The Products page filters by *GST* / *Without GST*, and each product shows a "GST" or "Without GST" badge. CSV import reads a `purchase type` column (GST or Without GST; "Normal" and "Local" also work; blank keeps GST, or keeps the current value when updating).
- **Purchase bills** (`Admin → Purchase bills`): keep every supplier bill safe, **GST** or **Without GST**, with supplier, bill number, date, total and photos/PDFs of the paper bill (take a photo with the phone camera or attach a file). The **Add product** form, **Restock** and **Add by barcode** all have a *Purchase bill* section: enter a new bill, or pick a *bill entered earlier* when several products came on the same bill. The list filters by GST / Without GST and searches supplier or bill number; each bill shows its files and the stock received on it. Files are only visible to signed-in staff.
- **Per-product purchases:** each product page has *Purchases by bill type* with All / GST / Without GST filters and how many units came in on each kind of bill.
- **Caution at billing:** each item on the bill shows its GST / Without GST badge. If the bill mixes both, or you press **GST** with Without GST items (or **Without GST** with GST items), the screen warns you and asks you to confirm. The suggested button is outlined in green.
- **Add by barcode** (`Admin → Products`): scan box after box. A new barcode opens the Add product form with the barcode filled in. A barcode already in the catalog shows the product so you can add stock, and scanning the same box again counts it +1. Pick *GST* or *Without GST* for the purchase you're entering, and optionally the supplier's bill number, which is saved in the stock history. Scanning anywhere on the Products page opens this too.
- **Stock history:** restock, customer return, damaged/lost and stock-check corrections are recorded with who, when and why, next to every sale. Each product page shows its full stock ledger and which customers bought it.
- **Sales history** (`Admin → Sales`): every bill, searchable by bill number, customer, phone, product or barcode, with date range and today / this month totals.
- **Delete a product** from its page. A product never billed or quoted is removed with its stock history. One used on old bills or quotations is taken out of products, billing and search for good, and its barcode can be used again; the old bills still show it.
- **Phones:** every page works at phone width. Admins get a bottom bar with Dashboard, Billing, Quotations, Products and **More** (all other pages). Bills shrink to fit the screen; tables put the key details first.
- **Signed in:** the public pages show only a **Dashboard** button instead of Sign in / Sign up.
- **Live search and filters:** every search box and filter (Dashboard, Products, Sales, Purchase bills, Quotations, Customers) updates the list as you type or pick an option, with no Search button. The filters are kept in the page address, so a filtered list can be bookmarked or shared with staff.
- **Customers** (`Admin → Customers`): each customer's bills and the exact products they bought, with total spent.

## Quotations

**Admin → Quotations** makes price quotes for customers, numbered `QT-00001`.

- **Build it interactively:** scan a barcode or type a name, choose from the product list (out-of-stock items can be quoted too), or add a **custom item** such as installation or labour. Each line has a quantity stepper, unit (pcs, job, m...), rate, discount, GST rate and an optional description. Lines can be moved up or down, duplicated or removed, and **Apply to all** gives every line the same % discount. The total, GST and amount in words update as you type.
- **Customer:** type a phone number to fill in a returning customer, or enter name, address, email, GSTIN and state. A subject line and a *valid until* date (7 / 15 / 30 day shortcuts) are optional.
- **GST or Without GST:** a Without GST quotation shows prices only; the GST version adds your GSTIN, HSN codes and the CGST + SGST (or IGST for another state) breakdown. Prices include GST, the same as bills.
- **Save** (or Ctrl + S). Leaving with unsaved changes asks first.
- **PDF and sharing:** **Download PDF** makes an A4 PDF with your company details from Bill settings, items, totals, GST summary, notes, terms, bank details and signature. **Share PDF** opens the phone's share sheet (WhatsApp, Gmail, Drive...) with the PDF attached, **WhatsApp** opens a chat with the customer's number and the link, and **Copy link**, **Email** and **Print** are there too. Sharing marks the quotation as *Sent*.
- **Customer link:** every quotation has a private link (`/quote/...`) the customer can open on their phone without signing in, view, download as PDF and print.
- **Status:** Draft, Sent, Accepted, Rejected and Billed, with filters, search, open value and win rate on the list. A quotation past its *valid until* date shows *Expired*.
- **Make bill from this:** opens Billing with the quoted products, quantities, prices and customer filled in. Prices above MRP are capped at MRP, and custom items are listed so you can add them separately. When the bill is saved, the quotation becomes *Billed* and links to it. Quotations never change stock.
- **Duplicate** copies a quotation as a new draft; **Edit** works until it is billed. Customers' pages have a **New quotation** button.

## Without GST and GST bills

The billing screen has two buttons:

- **Without GST:** a simple bill with prices only (printed title "Bill"), numbered `BILL-00001`. No GST or licence details.
- **GST:** a Tally-style **Tax Invoice**, numbered `INV-00001`. It has the seller, Consignee (Ship to) and Buyer (Bill to) with GSTIN/UIN and State Name & Code. It also has the Invoice No./Dated box with Delivery Note, Mode/Terms of Payment, Reference No., Buyer's Order No., Dispatch Doc No., Dispatched through, Destination and Terms of Delivery. Then come the items with HSN/SAC, Quantity, Rate (before tax), per and Amount, followed by CGST and SGST lines, Round Off, Amount Chargeable (in words) and the HSN/SAC tax summary. The invoice ends with Tax Amount (in words), Declaration, Company's Bank Details and "for <company> Authorised Signatory".
- If the buyer (or the consignee, when goods are shipped elsewhere) is in **another state**, the GST bill uses **IGST** instead of CGST + SGST. The state is filled in automatically from a GSTIN.

**Printing:** both kinds print on a full A4 page, like Tally. The items area stretches to fill the sheet, so the totals, amount in words, bank details and signature sit at the bottom of the page. A long bill continues on the next page.

**Admin → Bill settings** (also **Edit details** on the billing screen) holds the company name, address, phone, e-mail, GSTIN/UIN, PAN, state, other licence numbers, bank details, declaration and terms. A table of ticks chooses what each kind of bill prints: contact details, GST/licence details, consignee, order/dispatch box, HSN column, MRP column, warranty, amount in words, bank details, declaration, terms and signature. Each bill keeps a copy of the company details it was printed with, so changing them later doesn't alter old bills.

The shipping and order details (consignee, delivery note, buyer's order, dispatch...) are entered per bill under **Shipping & order details** on the billing screen.

**Upgrading from an earlier version:** run `npm run setup` once after updating. Bills and GST bills now have separate number series, which changes a database index.

## Live location of technicians

- **Location before sign-in:** when a technician signs in, the browser asks for location permission. They only get in after allowing it; the server refuses the sign-in without a position. If they block it, they see a "Location required" screen with steps to allow it, and the app tries to close.
- **While signed in:** the technician's phone sends its position every 30 seconds, or sooner when they move 25 m. A "Location on" chip in their top bar shows that sharing is on. If they switch location permission off, they're signed out straight away. If GPS is off or can't get a fix, the app locks with a "Try again" screen until location comes back.
- **Admin → Live map:** every technician on an OpenStreetMap map, green when live (seen in the last 3 minutes), grey with "last seen" otherwise. Positions update live. Click a name to see their route over the last 12 hours, open directions in Google Maps, or call them.
- **On/off switch:** the switch at the top of Live map turns the feature off for everyone at once. Technicians stop sharing immediately and aren't asked for location at sign-in. Turn it back on and they're asked again.
- **History** is kept for `LOCATION_HISTORY_DAYS` days (default 7) and deleted automatically.

Things to know:

- **Browsers only share location over https** (or on `http://localhost`). Host the app on an https address for technicians' phones. Opening it on a phone over `http://192.168.x.x` won't work.
- **It's a web app, so location is sent while the app is open.** When the phone is locked or the browser is in the background for long, the phone stops sending and the map shows "last seen". Adding the app to the home screen helps it reopen quickly; true background tracking needs a native Android/iOS app.
- **"Auto close":** browsers only let a page close itself in some cases (installed home-screen apps, windows the app opened). Otherwise the technician is signed out and kept on the "Location required" screen, so they can't use the app either way.
- Tell your technicians that the app records their location while they're signed in. Depending on where you operate, you may need their written consent for location tracking at work.

## Importing products from CSV

`Admin → Products → Import CSV` loads your existing product list and stock in one go:

1. Download the template, or use your own sheet. The first row must be column headings. Required: `name`, `category`, `mrp`. Optional: `barcode`, `sku`, `brand`, `model`, `selling price`, `cost price`, `gst`, `hsn`, `unit`, `stock`, `low stock alert`, `warranty months`, `description`. Common alternative headings (qty, quantity, price, rate, EAN...) are recognised.
2. Choose the CSV. You get a preview with any problems marked per row (missing MRP, text in a number column, selling price above MRP, barcodes Excel turned into `6.9E+12`).
3. Pick what the stock column means: **current count** (sets stock to that number) or **quantity received** (adds to stock). Then import.

A row with the same barcode (or SKU) as an existing product updates that product; everything else is created, with an AVI SKU when there's no barcode. Every stock change from an import is written to the stock history as "CSV import". In Excel, format the barcode column as **Text** and save as **CSV UTF-8**.

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript · **MongoDB with Mongoose** · JWT sessions (jose) · bcrypt · Zod · lucide icons · self-hosted fonts via Fontsource. There is no CSS framework: the design system is in `src/app/globals.css`.

## Getting started

Requires Node.js 20 or newer and a MongoDB database. (Prefer Docker? See **Run with Docker** below: nothing else to install.)

```bash
npm install
cp .env.example .env           # set AUTH_SECRET; for no-Docker use MONGODB_URI=mongodb://127.0.0.1:27017/aviinfotech and UPLOAD_DIR=./uploads
npm run setup                  # creates indexes and the first admin
npm run seed:demo              # optional: sample technicians, jobs, reviews and shop products
npm run dev                    # http://localhost:3000
```

Default logins (change them in `.env` before `npm run setup`):

| Role | Email | Password |
|---|---|---|
| Admin | admin@aviinfotech.local | Admin@12345 |
| Technicians (demo) | arjun@ / priya@ / vikram@aviinfotech.local | Tech@12345 |

To try it end to end, open the admin and a technician in two different browsers (or a normal and a private window), create a query, and watch the technician's screen.

In `npm run dev` with `EMAIL_PROVIDER=console`, the forgot-password page shows the reset link on screen. In production it's only printed in the server log until you configure email.

## Run with Docker (any PC)

Only [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows / Mac) or Docker Engine (Linux) is needed. No Node.js or MongoDB install: the database runs in its own container.

```bash
cp .env.example .env             # Windows: copy .env.example .env
# edit .env: set AUTH_SECRET (openssl rand -hex 32) and SEED_ADMIN_PASSWORD
docker compose up -d --build     # first build takes a few minutes
```

Open **http://localhost:3000** and sign in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `.env`.

What starts:

| Container | What it does |
|---|---|
| `mongo` | MongoDB 7. Data is kept in the `mongo-data` volume. |
| `setup` | Runs `npm run setup` once (indexes + first admin), then exits. Runs again on every `up`, which is safe. |
| `app` | The production Next.js server on port `APP_PORT` (default 3000). Job photos are kept in the `uploads` volume. |

Everyday commands:

```bash
docker compose ps                     # status
docker compose logs -f app            # live server log (reset links and console SMS show here)
docker compose down                   # stop (data is kept)
git pull && docker compose up -d --build   # update to a new version
docker compose run --rm setup npm run seed:demo   # optional demo data
docker compose exec -T mongo mongodump --archive --gzip > backup.gz   # database backup
docker compose exec -T mongo mongorestore --archive --gzip < backup.gz  # restore
docker compose down -v                # stop AND delete all data (careful)
```

Shortcuts (same thing, if Node is installed): `npm run docker:up`, `docker:down`, `docker:logs`, `docker:demo`, `docker:backup`.

**Develop inside Docker** (live reload, no Node on your PC):

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Your source folder is mounted into the container, so saved edits appear at http://localhost:3000 straight away. MongoDB is also exposed on `localhost:27017` in this mode (for MongoDB Compass).

Notes:

- **Phones and other PCs on the network:** open `http://<this-PC's-IP>:3000`. Technicians' location needs **https**, so for real use put the app behind a domain with TLS (Caddy, nginx, or a Cloudflare Tunnel) and set `APP_URL` to that address.
- **Use MongoDB Atlas instead:** set `MONGODB_URI` in `.env` to your Atlas string. The local `mongo` container still starts but isn't used.
- **Older CPU:** if the `mongo` container keeps restarting with an AVX message, set `MONGO_VERSION=4.4` in `.env`.
- **Port in use:** change `APP_PORT` in `.env`.
- Image only: `docker build -t avi-infotech .` then `docker run -p 3000:3000 --env-file .env avi-infotech` (with your own `MONGODB_URI`).

## Deploy with GitHub Actions

GitHub Pages can't run this app (it needs a server for MongoDB, logins and the API). Instead, `.github/workflows/deploy.yml` builds the Docker images on every push to `main`, stores them in the repo's Packages (ghcr.io) and restarts the app on your own server over SSH.

1. On a Linux server with Docker: `mkdir ~/avi-infotech`, and put a `.env` there (copy `.env.example`; set `AUTH_SECRET`, `SEED_ADMIN_PASSWORD`, `APP_URL`).
2. In GitHub → Settings → Secrets and variables → Actions, add secrets `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY` (optional `SERVER_PORT`, `SERVER_APP_DIR`), and the variable `DEPLOY_ENABLED` = `true`.
3. Push to `main`. Without `DEPLOY_ENABLED` the workflow only builds and checks.

On the server the app runs with `docker-compose.yml` plus `docker-compose.prod.yml`, which uses the ready-made images instead of building.

**Admin login doesn't work?** Seeding never changes an existing admin's password. Run `npm run reset-admin` (Docker: `docker compose run --rm setup npm run reset-admin`) to set it to `SEED_ADMIN_PASSWORD` from `.env`.

## MongoDB

The app talks to MongoDB through **Mongoose**. All models are in `src/lib/db.ts`. Any MongoDB 5 or newer works, either a plain local server or Atlas. No replica set is needed.

**MongoDB Atlas.** The free M0 cluster works. Create a cluster, add a database user, allow your server's IP under Network Access, then add a database name to the connection string:

```
MONGODB_URI="mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/aviinfotech?retryWrites=true&w=majority"
```

**Local MongoDB.** Install MongoDB Community Server, or run `docker run -d --name aviinfotech-mongo -p 27017:27017 mongo:7`, then use:

```
MONGODB_URI="mongodb://127.0.0.1:27017/aviinfotech"
```

Collections:

| Collection | Holds |
|---|---|
| `users` | Admins and technicians, with each technician's latest location |
| `queries` | Each job. The assigned technicians, completion reports (with photo file names) and the activity log are stored inside the job document. |
| `reviews` | Customer reviews, one per job |
| `notifications` | In-app notifications per user |
| `sms_logs` | Every SMS sent or failed |
| `settings` | App switches set by admins (live location on/off) |
| `location_pings` | Technicians' location history for the map trail, deleted automatically after `LOCATION_HISTORY_DAYS` |
| `counters` | Number sequences: tickets (Q-1001), bills (INV-00001), product SKUs (AVI-00001) |
| `categories` | Product categories (CCTV camera, DVR / NVR, Cables...) |
| `products` | The catalog, with current stock. Barcode is optional and unique. |
| `stock_movements` | Ledger of every stock change: opening, restock, sale, cancelled sale, return, damage, correction |
| `customers` | Shop customers, recognised by the last 10 digits of their phone |
| `bill_settings` | Company details for bills and which sections each bill type prints |
| `sales` | Bills (type Without GST or GST). Each line keeps a copy of the product name, price and GST, and the bill keeps a copy of the customer's details, so old bills never change |

## Configuration (.env)

| Variable | What it does |
|---|---|
| `MONGODB_URI` | MongoDB connection string (local or Atlas). See above. |
| `AUTH_SECRET` | Long random string used to sign sessions. **Required in production.** |
| `APP_URL` | Public URL, used in SMS review links and reset emails |
| `APP_NAME` | Company or app name shown in the UI and SMS |
| `UPLOAD_DIR`, `MAX_UPLOAD_MB` | Where completion photos are stored, and the per-photo limit |
| `SMS_PROVIDER` | `console` (log only) or `twilio` |
| `SMS_DEFAULT_COUNTRY_CODE` | Added to numbers typed without `+`, e.g. `+91` |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID` | Twilio credentials |
| `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY` | `console` or `resend` for password reset emails |
| `LOCATION_HISTORY_DAYS` | Days of technician location history kept (default 7) |

**SMS in India:** sending to Indian numbers requires DLT registration of your sender ID and message template, whichever provider you use. To use an Indian gateway such as MSG91 or Fast2SMS, add a provider object in `src/lib/sms.ts`. It's one function.

## Production

```bash
npm run build
npm start
```

- Run it as **one Node process** (a VPS, Railway, Render, Fly.io or Docker: see *Run with Docker* above). Real-time events use an in-process event bus. To run several instances, replace `src/lib/events.ts` with Redis pub/sub.
- Serverless hosts like Vercel aren't a good fit as-is, because of the long-lived SSE connections and local photo storage. For Vercel, switch storage in `src/lib/storage.ts` to S3/R2 and events to a hosted pub/sub.
- MongoDB Atlas is the simplest production database. Enable its automatic backups.
- Back up `UPLOAD_DIR` along with the database.
- If you use nginx, turn off buffering for `/api/stream` (the app already sends `X-Accel-Buffering: no`).

## Project layout

```
scripts/seed.ts             indexes, first admin, optional demo data
src/middleware.ts           role-based route protection
src/lib/db.ts               MongoDB connection + Mongoose models (field service)
src/lib/                    auth, events (real-time), notify, sms, mail, storage
src/lib/store/              the shop module (see below)
src/components/barcode.tsx  scanner detection hook + beep
src/lib/location.ts         live location: on/off setting, saving positions, team positions, route
src/lib/geo.ts              browser geolocation helpers (login form + location gate)
src/components/location-gate.tsx   keeps a signed-in technician sharing location
src/lib/csv.ts              CSV reader/writer for product import
src/app/admin/              dispatch board, new query, query detail, team, reviews, SMS log
src/app/admin/billing/      billing counter (scan, cart, customer, payment)
src/app/admin/products/     catalog & stock, product detail with stock ledger
src/app/admin/sales/        sales history, printable invoice
src/app/admin/customers/    customers and their purchase history
src/app/admin/locations/    live map of technicians + on/off switch
src/app/admin/products/import/  CSV import with preview
src/app/tech/               technician jobs, job detail + completion form, history
src/app/reviews/            public reviews page
src/app/review/[token]/     customer review form (link from SMS)
src/app/login, forgot-password, reset-password/[token]
src/app/api/                route handlers
```

## Shop architecture

The shop is a self-contained module in `src/lib/store/`, layered so each part has one job:

```
 UI (src/app/admin/billing, products, sales, customers)
   │  server pages read through the services; client components call the API
   ▼
 API routes (src/app/api/products, sales, customers)     auth check → zod validation → one service call
   ▼
 Services   products.ts   catalog, lookup by barcode/SKU, changeStock()
            sales.ts      createSale(), cancelSale(), salesSummary()
            customers.ts  upsert by phone, search, totals
   ▼
 Domain     billing.ts    pure bill arithmetic (GST-inclusive), shared with the browser for live totals
            money.ts      paise, ₹ formatting, invoice/SKU codes, amount in words
            schemas.ts    request validation, rupees → paise
   ▼
 Data       models.ts     categories, products, customers, sales, stock_movements
```

Design decisions:

- **Money is stored in paise** (integers). No floating-point rounding errors in totals or GST.
- **The server recomputes every bill.** The browser shows a live preview using the same `billing.ts`, but product names, MRP and GST rates are re-read from the catalog and every amount is recalculated when the bill is saved. A price above MRP is refused.
- **Stock can't oversell.** Each product's stock is taken with one conditional update (`stock >= qty`). If any line fails, the stock already taken is returned and the bill isn't saved. This works on a plain single-node MongoDB, with no replica set or transactions needed.
- **Every stock change is a ledger row** (`stock_movements`, with the balance after the change), so the stock figure can always be explained. Sales and cancellations write their own rows; manual changes need a reason.
- **Bills are snapshots.** Sale lines copy the product's name, barcode, HSN, MRP, price and GST, and the bill copies the customer's details. Editing a product or customer later never changes an old bill.
- **History stays complete.** Bills are cancelled, not deleted. **Delete** on a product removes it completely if it was never billed or quoted; otherwise it disappears from products, billing and search, its barcode and SKU are freed for reuse, and old bills keep their own copy of it.
- **Customers are deduplicated by phone** (last 10 digits), so "+91 98765 43210" and "098765-43210" are the same person.
