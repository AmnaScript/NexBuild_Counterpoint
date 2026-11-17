# Local acceptance test and screenshot plan

Before submitting, run `npm run check` and then `node server/app.js`. Visit `http://localhost:4173` in Chrome, Edge or Firefox.

1. Sign in as `admin@demo.local` / `Admin123!`. Confirm that the dashboard shows sample orders, catalogue metrics and low-stock products.
2. Open **Products**. Search for `notebook`, check low-stock filter, add a new product, edit its price and adjust its quantity. The adjustment must require a reason.
3. Open **Stock history**. Verify the adjustment you made includes the reason, your user name and before/after quantities.
4. Open **Orders**, create a draft containing the notebook. Confirm the draft. Product stock should fall by the order quantity.
5. Open the order again. Advance it through confirmed → packed → dispatched → delivered. Verify all statuses and the actor appear in the activity trail.
6. Create another draft, confirm it, then cancel it. Stock should return. Repeating cancellation cannot add stock again.
7. Try confirming an order for more units than are available. Expect an error, with quantities unchanged.
8. Download both CSV reports from **Reports**. Open them to verify column headers and values.
9. Sign out; use `staff@demo.local` / `Staff123!`. Staff can create/process orders but cannot modify products or stock by hand.
10. Sign out; use `viewer@demo.local` / `Viewer123!`. Viewer can browse lists but cannot create orders or download CSV.
11. Resize browser to phone width. Confirm that navigation scrolls horizontally and tables can scroll without breaking the page.
12. Run `npm test`: all 15 automated checks should pass.

## Screenshots requested by NexBuild

**The package does not include invented browser screenshots.** Capture real screenshots after running it locally and save them in the `screenshots/` directory:

- `01-login.png`: the login screen, with demo accounts visible.
- `02-dashboard.png`: summary cards and recent orders.
- `03-products.png`: catalogue with stock indicators.
- `04-orders.png`: order workflow and statuses.
- `05-order-detail.png`: order items with price snapshot and status history.
- `06-stock-history.png`: audit row with reason, actor and time.
- `07-reports.png`: reports and low-stock watchlist.

In Windows, use `Win + Shift + S` for a quick screenshot. Avoid including any real personal information: this sample uses fictional data.

## Submission status

- [x] Source code and working backend endpoints
- [x] Role-based access and sample sign-ins
- [x] Product, supplier, customer and order workflows
- [x] Atomic stock handling and audited adjustments
- [x] Fifteen passing automated tests (verified in packaging environment)
- [x] API/database docs, readme and `.env.example`
- [ ] Genuine browser screenshots (capture locally)
- [ ] Public demo URL (deploy separately, then add it to README)
- [ ] Manual visual/browser acceptance (verify locally)

**Do not claim the final three items are complete until you have done them.**
