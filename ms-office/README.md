# Royal Technologies Office Subscription Site

This is a Jekyll landing page for selling Microsoft Office subscriptions with a local checkout flow and Firebase-backed order capture.

## Included
- Full one-page launch site
- Office subscription plan cards for monthly, 6-month, and yearly pricing
- Local-market checkout flow
- Firebase order API integration
- Config-driven API URL via `_config.yml`

## Run locally
```bash
gem install bundler
bundle install
bundle exec jekyll serve
```

## Notes
- Pricing is set to GYD `$1,500` monthly, `$7,000` for 6 months, and `$10,000` yearly in both the frontend and Firebase function.
- Update `baseurl`, `order_api_url`, and Firebase CORS settings before deployment if you use a different project slug or endpoint.
- This is a subscription request flow, not a direct online card payment gateway.

## Updated Production Monitoring
- The Firebase function now emits structured JSON logs with events such as `request_start`, `request_complete`, `order_created`, `rate_limit_blocked`, `duplicate_submission_blocked`, and `order_create_failed`.
- Create Cloud Logging or Cloud Monitoring alert policies for `severity=ERROR` and for spikes in `rate_limit_blocked` or `duplicate_submission_blocked` events.
- A practical setup is one alert for any `order_create_failed` event, and one alert when abuse-block events rise above your normal background traffic.
