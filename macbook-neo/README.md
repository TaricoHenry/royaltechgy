# MacBook Neo Guyana Jekyll Site

This is a production-ready Jekyll landing page with original artwork, Guyana-friendly reservation checkout, and Google Sheets order capture.

## Included
- Full one-page launch site
- Original SVG hero and color-lineup visuals
- Local-market checkout flow
- Final checkout form that sends reservations to Google Sheets
- Google Apps Script endpoint example
- Config-driven Apps Script URL via `_config.yml`

## Run locally
```bash
gem install bundler
bundle install
bundle exec jekyll serve
```

## Hook up Google Sheets
1. Create a Google Sheet.
2. Open **Extensions -> Apps Script**.
3. Paste the code from `google-apps-script.js`.
4. Deploy it as a **Web app**.
5. Give the web app access appropriate to your workflow.
6. Copy the deployment URL.
7. Replace `google_sheet_web_app_url` in `_config.yml`.

## Suggested Sheet Columns
The script auto-creates these columns in a sheet named `Orders`:
- Timestamp
- Full Name
- Phone / WhatsApp
- Email
- Location
- Model
- Price
- Color
- Payment Method
- Fulfillment
- Notes
- Source

## Notes
- Prices are sample Guyana-dollar values and can be edited in `index.html` and `assets/js/main.js`.
- The visual design is inspired by Apple’s product-story pacing, but the production artwork is original and does not reuse Apple marketing images.
- This is a reservation flow, not a card payment gateway.
