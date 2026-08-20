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
| `recent_work_opened` | A saved output was reopened from Home |
| `classroom_pack_generation_started` | One-topic classroom-pack generation began |
| `classroom_pack_generation_completed` | A lesson plan, worksheet and presentation were created successfully |
| `classroom_pack_generation_failed` | Classroom-pack generation failed, with error class only |
| `activation_first_useful_output_created` | First saved teacher-usable output on this browser |
| `output_saved` | A reusable lesson, paper, presentation or classroom pack was saved |
| `output_exported` | An output was printed or exported, with format only |
| `retention_milestone_reached` | The browser returned on or after day 1, 7 or 30 |
| `teaching_assistant_selected` | A task-specific teaching assistant was chosen |
| `assistant_conversation_started` | The first user message in a new assistant conversation |
| `activation_teaching_assistant_started` | First task-specific assistant conversation on this browser |
| `assistant_request_started` | An assistant request began, without prompt content |
| `assistant_response_completed` | A response finished, with latency and response length |
| `assistant_response_failed` | A response failed, with error class only |
| `assistant_request_stopped` | The user stopped an in-progress response |
| `activation_ai_response_completed` | First successful assistant response on this browser |
| `voice_listening_started` | The user started browser speech recognition, with language only |
| `voice_listening_stopped` | The user manually stopped listening, without transcript content |
| `voice_recognition_failed` | Browser speech recognition failed, with error class only |
| `voice_command_submitted` | A reviewed voice transcript or typed command was submitted |
| `voice_tool_opened` | A voice command opened a specific product tool |
| `voice_assistant_request_started` | An in-place teacher question started |
| `voice_assistant_request_stopped` | The user stopped an in-progress voice-assistant answer |
| `voice_assistant_response_completed` | An in-place voice-assistant answer completed |
| `voice_assistant_response_failed` | An in-place answer failed, with error class only |
| `voice_response_spoken` | The user heard or replayed a spoken response |
| `activation_voice_assistant_started` | First microphone session on this browser |
| `activation_voice_response_completed` | First completed voice-assistant answer on this browser |
| `voice_agent_plan_created` | A safe, allowlisted action plan was prepared, without task content |
| `voice_agent_plan_confirmed` | The user approved a plan that can write local workspace data |
| `voice_agent_plan_cancelled` | The user cancelled a plan before any action ran |
| `voice_agent_step_completed` | An allowlisted plan step completed, with step kind only |
| `voice_agent_step_failed` | A plan step failed, with step and error class only |
| `voice_agent_plan_completed` | An approved plan finished, with aggregate counts only |
| `voice_agent_plan_undone` | The user reverted items created by the latest plan |
| `voice_agent_planner_failed` | Model-assisted planning failed validation or execution |
| `voice_context_briefing_opened` | A local daily briefing was generated from task and event counts |
| `navigation_item_opened` | Sidebar or command-palette destination opened |
| `next_step_clicked` | User continued from one feature to a suggested next step |
| `paywall_viewed` | A locked paid feature was viewed |
| `paywall_upgrade_clicked` | Pricing CTA clicked from a paid-feature gate |
| `paywall_fallback_clicked` | Free alternative chosen from a paid-feature gate |
| `pricing_cta_click` | Pricing plan CTA clicked |
| `checkout_started` | Stripe checkout started |
| `subscription_activated` | A real paid plan became active on this browser |
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

Teaching assistant value:

`teaching_assistant_selected` -> `assistant_conversation_started` -> `assistant_response_completed`

Break this funnel down by `assistant_id` to see which teaching workflows drive
real use. Compare `assistant_response_completed` against
`assistant_response_failed` to monitor reliability without collecting prompts.

Voice task completion:

`voice_listening_started` -> `voice_command_submitted` -> `voice_tool_opened`

Voice teacher Q&A:

`voice_assistant_request_started` -> `voice_assistant_response_completed`

Assistant plan completion:

`voice_command_submitted` -> `voice_agent_plan_created` -> `voice_agent_plan_confirmed` -> `voice_agent_plan_completed`

Paid conversion:

`paywall_viewed` -> `paywall_upgrade_clicked` -> `pricing_cta_click` -> `checkout_started` -> `subscription_activated`

First successful classroom workflow:

`activation_task_started` -> `classroom_pack_generation_started` -> `classroom_pack_generation_completed` -> `output_saved`

Product value and retention:

Break down `output_saved` and `output_exported` by `output_kind`. Use
`retention_milestone_reached` with `day = 7` as the seven-day return metric.
