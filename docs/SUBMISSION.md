# NexBuild — submission checklist

Deadline: **22 November 2026**. The internship email asks for all four steps.

1. **Intern Portal review:** Open Reviews, write a specific, truthful review of the work, lessons and actual support received. Do not claim experiences you did not have.
2. **Trustpilot:** Submit an independent, honest review at https://www.trustpilot.com/evaluate/nexbuild.online . The internship email describes this as mandatory, but your review should reflect your real experience, including any negatives.
3. **LinkedIn:** Record a 30–60 second walkthrough, or capture screenshots after signing in. Show the daily brief, product catalogue, order statuses, stock adjustments and reports; mention NexBuild and tag its actual LinkedIn company page. Copy the published post URL.
4. **GitHub:** Create a public repository named **NexBuild_Counterpoint** and push the source. Include README, sample configuration and screenshots. Never commit live secrets or private customer records.

The Project submission form is expected to appear in the portal under Projects after a separate email. Save the GitHub URL, LinkedIn URL and demo URL if deployed.

## Suggested demo sequence

- Sign in as Admin (the demo credentials appear on the login page).
- Show product stock quantities and low-stock warning.
- Make a draft order, confirm it and show the reserved quantity.
- Cancel the confirmed order and show that stock returns once.
- Show stock movement audit and export CSV.
- Sign in as Viewer and explain why changes are disabled.

## Screenshot checklist

Capture actual images on your machine (not mockups):

- `01-login.png` — Login screen
- `02-daily-brief.png` — Dashboard after admin sign-in
- `03-catalogue.png` — Product list showing stock
- `04-order-details.png` — Order details and status timeline
- `05-stock-history.png` — Stock corrections and audit information
- `06-reports.png` — Report exports and low-stock list

Do not publish screenshots of real customer data. This project seeds fictional records.

## Notes

- The assignment lists Laravel/MySQL as the preferred stack. This package uses Node's built-in HTTP/SQLite and a bundled React/TypeScript frontend to keep the local demo dependency-free. Describe the stack accurately.
- The project does not include a production deployment or a working public demo URL. Do not submit localhost as the demo URL.
- The AI FAQ chatbot is optional in the assignment and is not included here.
