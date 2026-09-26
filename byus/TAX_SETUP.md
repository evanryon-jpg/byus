# Stripe Tax setup checklist

`lib/payments/providers/stripe.js` now asks Stripe to calculate sales tax/VAT on
every checkout (`automatic_tax: { enabled: true, liability: { type: 'self' } }`),
with ByUs — not the creator — as the tax-liable party. That's the code half of
Stripe Tax. It does nothing on its own: with zero tax registrations on file,
Stripe calculates $0 tax everywhere and nothing changes for fans. The steps
below, done once in the Stripe Dashboard (not in code), are what actually turns
tax collection on, jurisdiction by jurisdiction.

**Talk to a tax professional before doing this**, especially on the "where am I
required to register" question — that's a legal/business call this checklist
doesn't make for you.

## Decided: tax is added on top (exclusive)

Sept 26, 2026: sales tax/VAT is added on top of the creator's price, never taken
out of it. Every price the code creates sets `tax_behavior: 'exclusive'`
(`PRICE_TAX_BEHAVIOR` in `lib/payments/providers/stripe.js`), and older tier
prices are switched to exclusive the first time someone checks out on them. The
creator's cut is always worked out from the price they set.

**Withholding.** A destination charge sends the whole charge, tax included, to
the creator's account, and a subscription's fee percent is taken from the total
including tax. So after each payment that collected tax, the webhook
(`app/api/webhooks/stripe/route.js`) reverses the right amount from the
creator's transfer (`withholdTaxFromDestinationCharge`) so that ByUs holds the
tax and the creator keeps exactly price minus fee. Reversals are tagged
`metadata.byus_purpose = tax_withholding`. Refunds on those charges reverse the
remaining transfer by hand (`createDestinationChargeRefund`). The earnings
ledger and the $2,000 fee-tier threshold use pre-tax amounts.

Nothing here does anything until a registration exists (step 3): no
registration means $0 tax, which means no withholding.

## 1. Confirm the plan tier

Registrations, filing, and remittance are gated behind Stripe's paid "Tax
Complete" tier, on top of Stripe's normal fees. Check **Settings → Plans**
in the Dashboard to see what ByUs is currently on and what upgrading costs.

## 2. Set ByUs's tax settings

**Tax → Settings** (`dashboard.stripe.com/settings/tax`):
- Head office address (this is the address Stripe Tax calculates *from* for
  ByUs's own tax residency).
- A preset product tax code and default tax behavior. Set the default to
  **exclusive** to match the code (see above).
  ByUs sells access to a creator's gated content/community — that's generally
  an electronically-supplied/digital service, but the exact code affects the
  rate in some jurisdictions, so pick deliberately rather than defaulting.
  Setting it here means the code never has to hardcode a tax code per line
  item.

## 3. Register in each jurisdiction ByUs is required to collect in

**Tax → Registrations**. Stripe only collects tax where an *active*
registration exists — everywhere else it silently calculates $0, no error.
Common starting points for a US-based platform with international fans:
- Your home state, once you cross its economic nexus threshold (revenue
  and/or transaction count — varies by state).
- Other US states as you cross their individual thresholds — Stripe's
  registrations page tracks this against your actual transaction volume once
  Stripe Tax is live, so you don't have to watch it manually.
- EU VAT via Stripe's Non-Union OSS registration service, if you have EU
  fans and no EU physical presence — one registration covers all EU
  countries.

Registering here is what flips a jurisdiction from "$0 tax" to "actually
calculating and collecting."

## 4. Decide who files and remits

Stripe calculates and collects at checkout either way, but *filing the return
and paying the government* is separate:
- US sales tax: Stripe offers an end-to-end filing service (Dashboard walks
  you through opting in per state) — this is the closest thing to "set and
  forget."
- Outside the US (EU VAT etc.): either use one of Stripe's filing partners
  (Taxually, TaxJar, HOST, Marosa) or file yourself off the reports Stripe
  generates under **Tax → Reports**.

## 5. Spot-check in test mode before relying on it

Use a test-mode Checkout session with a billing address in a jurisdiction
you've registered in, and confirm `total_details.amount_tax` on the resulting
Checkout Session is nonzero and looks right. Stripe's test tax IDs
(`docs.stripe.com/tax/testing`) are useful for exercising the EU
reverse-charge/VAT-ID path too, though ByUs doesn't currently collect tax IDs
at checkout (see "not yet built" below).

## What this doesn't cover (not yet built)

- **Tax ID collection** (`tax_id_collection`) — lets a fan enter a business
  VAT number so B2B EU sales get reverse-charged instead of taxed. Not added;
  ByUs's fans are essentially always individual consumers, so this is low
  priority, but flag if that assumption changes.
- **Per-jurisdiction rollout gating** — right now `automatic_tax.enabled` is
  unconditionally `true` for every checkout. Stripe's own docs describe a
  pattern for platforms that only enable tax for jurisdictions they're ready
  to support (checking `Tax Settings`/registrations before creating the
  session) — not needed here since "no registration yet" already means "$0
  tax," but worth knowing the pattern exists if you ever want tighter control.
