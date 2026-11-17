# REST API reference

Base path: `/api`. JSON endpoints accept and return JSON. Log in with `POST /api/login` and include the returned token in `Authorization: Bearer TOKEN` for subsequent requests. `GET /api/health` and `POST /api/login` are public.

Roles: **viewer** (read only), **staff** (read, create customers and orders, advance order statuses, export CSV), **admin** (all staff permissions plus edit products, suppliers and adjust stock).

| Method | URL | Role | Description |
| --- | --- | --- | --- |
| GET | `/health` | Public | Health check |
| POST | `/login` | Public | Sign in, receive bearer token |
| GET | `/me` | Any | Current user |
| POST | `/logout` | Any | Invalidate token |
| GET | `/summary` | Any | Dashboard statistics and recent orders |
| GET | `/products?q=&low=1&page=1&limit=10` | Any | Search product list; low-stock filter and pagination |
| POST | `/products` | Admin | Add a product |
| PATCH | `/products/:id` | Admin | Edit descriptive fields, price and threshold (not quantity) |
| GET | `/suppliers` | Any | List suppliers |
| POST | `/suppliers` | Admin | Add supplier |
| GET | `/customers` | Any | List customers |
| POST | `/customers` | Staff, admin | Add customer |
| GET | `/orders?status=&q=&from=&to=&page=&limit=` | Any | Filter orders |
| POST | `/orders` | Staff, admin | Create draft with server-priced line items |
| GET | `/orders/:id` | Any | Detail, immutable snapshots, status history |
| PATCH | `/orders/:id` | Staff, admin | Advance or cancel an order |
| GET | `/stock/movements?page=1&limit=10&product_id=` | Any | Stock audit history |
| POST | `/stock/adjust` | Admin | Add or remove inventory with reason |
| GET | `/reports/low-stock` | Any | Low-stock list |
| GET | `/reports/low-stock.csv` | Staff, admin | Download low-stock CSV |
| GET | `/reports/orders.csv` | Staff, admin | Download order CSV |

## Examples

```bash
curl -X POST http://localhost:4173/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.local","password":"Admin123!"}'
```

Copy the token from the response, then (replace `TOKEN`):

```bash
curl http://localhost:4173/api/summary -H "Authorization: Bearer TOKEN"
```

Create a draft order (customer 1, two items from product 1):

```bash
curl -X POST http://localhost:4173/api/orders \
  -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
  -d '{"customer_id":1,"items":[{"product_id":1,"qty":2}],"notes":"Please pack carefully"}'
```

Confirm order number 5 (actual ID depends on the database):

```bash
curl -X PATCH http://localhost:4173/api/orders/5 \
  -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"confirmed"}'
```

Adjust stock (admin only):

```bash
curl -X POST http://localhost:4173/api/stock/adjust \
  -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
  -d '{"product_id":1,"delta":5,"reason":"Received supplier delivery"}'
```

### Error format

Most failures return `{"error":"Readable explanation"}` with standard HTTP status: 400 invalid input, 401 unauthenticated, 403 insufficient permissions, 404 not found, 409 conflict or insufficient stock, 500 unexpected server error.

## Server-side pricing and state transitions

On order creation, the backend fetches current product prices and stores `unit_price_cents`, `name_snapshot` and `sku_snapshot` for each line. Subtotal is computed server-side and cannot be supplied by the browser. Allowed transitions:

```text
draft ───────> confirmed ───────> packed ───────> dispatched ───────> delivered
  │                │                │
  └───────────────>└───────────────>└───────> cancelled
```

Cancellation after dispatch is not supported in this demo; returns require a separate reverse-logistics workflow. Cancellation of an already cancelled order is a no-op.

## Notes for reviewers

Pagination uses `page` (1-based) and `limit` (max 100). The frontend loads its small demo dataset to paginate client-side. Bearer tokens are stored in browser `sessionStorage` for the local demo. Exports require role authorization before any CSV bytes are emitted.
