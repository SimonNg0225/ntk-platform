# Analytics Tracking

EziTeach AI uses PostHog for privacy-gated product analytics. If no key is set,
the app does not load analytics code.

## Setup

Add these to `.env.local` and the production hosting environment:

```bash
VITE_POSTHOG_KEY=phc_...
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

Tracking starts only after the visitor accepts the cookie banner.

## Core Events

| Event | Meaning |
| --- | --- |
| `$pageview` | Route views and virtual app screens |
| `landing_cta_click` | Marketing CTA clicks, with `target` |
| `signup_started` | Google sign-in started |
| `user_signed_in` | Logged-in user session detected |
| `app_opened` | Product shell opened |
| `app_screen_viewed` | App overview/settings/admin/feature screen viewed |
| `feature_opened` | Specific product feature opened |
| `onboarding_viewed` | Task-first onboarding shown for the first time |
| `onboarding_task_started` | User chose an onboarding task and entered its workspace |
| `activation_task_started` | First home task started on this browser |
| `activation_profile_completed` | First teacher profile completed on this browser |
| `home_task_submitted` | Home composer/shortcut routed to a tool or assistant |
| `navigation_item_opened` | Sidebar or command-palette destination opened |
| `next_step_clicked` | User continued from one feature to a suggested next step |
| `paywall_viewed` | A locked paid feature was viewed |
| `paywall_upgrade_clicked` | Pricing CTA clicked from a paid-feature gate |
| `paywall_fallback_clicked` | Free alternative chosen from a paid-feature gate |
| `pricing_cta_click` | Pricing plan CTA clicked |
| `checkout_started` | Stripe checkout started |
| `outbound_link_clicked` | External link clicked through helper |

No task text, document content, email address, school name, or invite token is
sent in these product events. Every event includes page path, title, referrer,
and any URL attribution params
such as `utm_source`, `utm_medium`, `utm_campaign`, `gclid`, and `fbclid`.

## UTM Links

Use channel-specific links in Instagram, Threads, and ads:

```text
https://eziteach.hk/?utm_source=instagram&utm_medium=bio&utm_campaign=teacher_launch
https://eziteach.hk/?utm_source=threads&utm_medium=post&utm_campaign=teacher_launch
https://eziteach.hk/?utm_source=meta&utm_medium=ad&utm_campaign=teacher_launch
```

In PostHog, filter events by `utm_source` or build these funnels:

Acquisition to activation:

`$pageview` -> `landing_cta_click` -> `app_opened` -> `activation_task_started`

Onboarding quality:

`onboarding_viewed` -> `onboarding_task_started` -> `feature_opened`

Paid conversion:

`paywall_viewed` -> `paywall_upgrade_clicked` -> `pricing_cta_click` -> `checkout_started`
