# Counterpoint — The Retail Desk

A lightweight stock and order workspace built for the NexBuild web development internship assignment, **Project 02: Small Business Inventory and Order Management**.

Counterpoint is a fictional stationery and desk-accessories shop. The demo includes eight products, four customers, three suppliers and four example orders, so the dashboard has something useful to show straight away.

## Quick start (Windows, macOS or Linux)

You need **Node.js 22.13 or newer**. Nothing needs installing with `npm install` — the application and its React runtime are bundled in the ZIP. The backend uses the SQLite driver built into Node 22.

```bash
cd nexbuild-inventory
node server/app.js
```

Open **http://localhost:4173**. Stop the server with `Ctrl+C`.

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@demo.local | Admin123! |
| Staff | staff@demo.local | Staff123! |
| Viewer | viewer@demo.local | Viewer123! |

Use the **admin** account first. These credentials are intentionally public for the local demo; don't deploy them to the internet unchanged.

For a different port, set `PORT` before starting the server. Example in PowerShell: `$env:PORT=5000; node server/app.js`.

## What you can do

- Browse and edit the product catalogue, set low-stock thresholds and link suppliers.
- Create customer records and order drafts. The backend snapshots each item's name, SKU and unit price; the browser never decides the amount charged.
- Confirm an order to reserve stock. This happens in one `BEGIN IMMEDIATE` SQLite transaction, with full rollback if any line is out of stock.
- Move orders through **draft → confirmed → packed → dispatched → delivered**. Cancel drafts, confirmed or packed orders; stock only returns if it was previously reserved.
- Review status history, stock movement history, author and reason for every adjustment.
- Search orders, filter by date/status, page through records and export CSV reports.
- Access control: viewers can read data; staff can create customers and process orders; admins can also manage products, suppliers and stock adjustments.

### The important stock rules

1. Draft orders do not affect stock. Confirmation subtracts stock once.
2. Confirmation checks **all** line items inside one write transaction before changing quantities.
3. A failed confirmation never partially subtracts items.
4. Retrying confirmation or cancellation at its final state is a no-op. The database also has a unique constraint on movement `(product_id, order_id, reason)`.
5. Cancelled confirmed/packed orders restore their quantities once. A shipped (`dispatched`) or delivered order cannot be cancelled through the normal workflow.
6. Manual quantity changes require an admin and a written reason. Inventory quantity cannot be edited using the product endpoint.
7. Old order totals and item snapshots do not change when the product price changes.

## Run the tests

```bash
npm test
```

Or check TypeScript compilation **and** all backend tests:

```bash
npm run check
```

The test suite covers 15 cases: unauthorised access; staff and viewer permissions; price snapshots; one-time confirmation; over-selling; parallel confirmation; cancellation retries; invalid final-state changes; manual adjustment audits; insufficient stock; audit history; restricted CSV; missing reasons; and duplicate order items.

## Reset the database

Stop the server, then:

```bash
npm run reset
node server/app.js
```

This deletes the **local demo database**, recreating the seeded example records on next launch. Never run this command against real records without a backup.

## Folder guide

```text
nexbuild-inventory/
  server/
    app.js              REST API, validation, auth, transactions, static site
    db.js               SQLite schema and fictional demo seed data
    data/               Local database, generated at runtime
  client/
    index.html           Browser entry point
    styles.css           Responsive design
    react.min.js         Bundled offline React 16 runtime
    react-dom.min.js     Bundled offline React DOM runtime
    src/app.ts           TypeScript frontend source
    app.js               Compiled browser application
    tsconfig.json        Compiler settings
  tests/api.test.js      API and stock integrity tests
  docs/API.md            Endpoint examples
  docs/DATABASE.md       Relationships, constraints, indexes
  docs/QA.md             Step-by-step acceptance checks and screenshot guide
  .env.example           Optional environment variables
```

## Technology choice (important to mention in your submission)

The assignment lists **React, TypeScript, Laravel REST API and MySQL as the preferred stack**, not a mandatory one. This implementation uses **React 16 (offline-bundled), TypeScript, Node.js built-in HTTP API and SQLite**. The frontend uses a small state adapter compatible with the bundled React version instead of modern React hooks. This keeps the release portable and removes the need for Composer, MySQL or package downloads. The essential business rules, transactions, roles, exports and audit tables are implemented and tested.

SQLite's `BEGIN IMMEDIATE` serialises write transactions to prevent overselling. For deployment on multiple server instances, migrate to a central transactional database (e.g. MySQL/PostgreSQL) and managed authentication before launch.

## Publishing and screenshots

**Demo URL:** Not yet deployed. This package runs locally at `http://localhost:4173`. Do not invent a hosted URL for your submission. The assignment asks for a demo link and screenshots, so you must host the project and capture real screenshots before submitting. See `docs/QA.md` for suggested screenshots and verification steps. The interface was redesigned with a dark horizontal masthead, warm-orange accents, Space Grotesk, DM Sans and DM Mono typography, and an editorial-style dashboard.

This is a student demonstration app, **not production-ready**: seeded passwords, 24-hour bearer sessions, local database storage and minimal auth hardening must be replaced before handling real businesses or customer data. An optional AI chatbot was not added (bonus only).

## Notes

All products, people, emails and orders in the seed data are fictional. Prices are stored as integer **paisa** (PKR × 100) to avoid floating point errors. Dates are recorded in SQLite UTC timestamps.
