# InvoiceHero ⚡

AI-Powered Invoicing for Freelancers

## Live Demo

Visit: https://invoice-hero.onrender.com

## Features

- 📄 **Professional Invoices** - Create beautiful invoices in seconds
- 👥 **Client Management** - Track all your clients in one place
- 📊 **Dashboard** - See revenue, outstanding payments, overdue invoices
- 💳 **Stripe Integration** - Accept payments via Stripe
- 🎨 **Beautiful UI** - Modern, dark-themed interface
- 💾 **Persistent Data** - All data saved to file (no database needed)

## Pricing

- **Free**: Unlimited invoices
- **Pro** (€9/mo): Coming soon - AI-powered follow-ups
- **Business** (€29/mo): Coming soon - Multi-user support

## Quick Start (Local)

```bash
npm install
# Add your Stripe key to .env or set it manually
STRIPE_SECRET_KEY=sk_test_... npm start
```

Visit http://localhost:10000

## Deployment to Render

### Option 1: One-Click Deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/mihalyvoros9/invoice-hero-app)

### Option 2: Manual Deploy

1. Go to [Render.com](https://render.com) and sign up
2. Create a new **Web Service**
3. Connect your GitHub and select `invoice-hero-app`
4. Settings:
   - **Name**: `invoice-hero`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. **Environment Variables**:
   - `STRIPE_SECRET_KEY` = your Stripe test/live key
6. Deploy!

## Stripe Setup

1. Get your API keys from [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Add `STRIPE_SECRET_KEY` to Render environment variables
3. For test mode: use keys starting with `sk_test_`
4. For live mode: use keys starting with `sk_live_`

## Tech Stack

- Node.js + Express
- Stripe for payments
- File-based JSON database
- Vanilla JS frontend (no framework)

## Data Storage

All data is stored in `db.json` file in the app directory. In production, you should:
- Back up this file regularly
- Or upgrade to a proper database (PostgreSQL, MongoDB)

## License

MIT
