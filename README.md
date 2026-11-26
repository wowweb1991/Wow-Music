# WOW MUSIC — Your Music. Your World.

Independent international streaming platform, completely separate from WOW OMNI.

## Current status

Responsive browser interface, local-only audio preview, and a Supabase-backed application for listener registration, artist applications, rights-confirmed uploads, admin moderation, signed-URL playback, favorites, playlists, membership records, and stream analytics. **Payments are OFF.** Nothing is automatically deployed to production and no project has been provisioned or billed.

## Connect a dedicated Supabase project

1. Create a **new dedicated WOW MUSIC** Supabase project on the free plan if available. Do not use `wow-super-app` or any existing project's data.
2. In that project's SQL Editor, review and execute `supabase/schema.sql` once. Never run this file against WOW OMNI. The schema creates tables, strict RLS, a private `wow-audio` bucket, and streaming RPC.
3. Set the Supabase Auth Site URL and allowed Redirect URLs to your actual WOW MUSIC deployed origin. Enable email confirmation; configure SMTP for reliable production email delivery.
4. In `js/config.js`, enter **only** the standalone project's URL and **public publishable** key. Never enter service role/secret keys in any frontend file, public repository, or HTML.
5. Host on any static host (for example free Cloudflare Pages or Netlify) with HTTPS. The site uses a pinned ESM import of `supabase-js` and needs no server build.
6. After registering your account, manually make it the sole initial admin in the dedicated project's SQL Editor, using its confirmed user UUID: `insert into public.admins(user_id) values ('YOUR-AUTH-USER-UUID');`. Never expose this command as a user action in the browser.
7. Register as `MUZAYYANAH` in Artist Studio; approve the artist from Admin; upload original recordings you own or control; review each track; publish it. No audio files are bundled or assumed present.

## Moderation and royalties

Track submission requires explicit rights confirmation. Staff should **verify** recording, composition, sample, and distribution permissions before publishing. User-submitted affirmations alone do not establish rights. This is **not** a royalty accounting or payout system; international licensing, takedown contact, privacy policy, terms, content moderation, and applicable music rights obligations must be completed before public launch. There is no Stripe, checkout, payment authorization, auto-renewal, webhook, or billing integration. `memberships` is read-only to clients; premium must be activated only by a future verified server-side billing integration after express owner approval.

## Important limitations before live launch

- Static browser playback relies on Supabase private-storage signed URLs for **published** audio. Signed URLs can be redistributed for their 15-minute lifespan and are not DRM. Use a server-side stream gateway for stronger protections or entitlement checks later.
- Stream counts represent authenticated listens that reach a playback threshold and have a database one-minute deduplication; these numbers are indicative analytics, **not** tamper-proof accounting or royalty measurements. Anonymous plays are not recorded.
- Supabase free tiers have database/storage/bandwidth ceilings. Audio streaming consumes bandwidth; monitor quotas and configure usage limits before releasing publicly.
- Pending tracks are not public until an admin approves both artist and track. Admin can read pending audio. Public storage access is denied for unpublished tracks.
- Additional production hardening: rate limiting, abuse reporting, admin audit trail, upload file inspection, legal terms, accessibility audit, mobile device/browser tests, and properly configured password-reset completion UI.

## Basic local checks

Run `node --check js/app.js && node --test tests/smoke.test.mjs` in repository root. Full integration testing requires a standalone Supabase test project and real test accounts/audio; no billable resources should be activated without consent.