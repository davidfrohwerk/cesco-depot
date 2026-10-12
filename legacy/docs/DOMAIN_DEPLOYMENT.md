# CESCo Depot Domain and Production Entry Plan

## Domain

CESCo controls:

- cescoit.com

For the first production deployment, keep the public landing page and authenticated portal on the same origin:

- https://cescoit.com/

This keeps account registration, authentication cookies, public marketing pages, and the customer workspace simple while the product is still a modular monolith.

Potential future subdomains may include:

- api.cescoit.com - public/customer integration API if separated later
- status.cescoit.com - service status if introduced later
- files.cescoit.com - only if evidence/object delivery is intentionally separated

Do not split the customer portal onto another subdomain merely for appearance; add subdomains only when there is an operational reason.

## Recommended edge path

Internet
-> Cloudflare
-> Azure VM public address
-> Nginx
-> Next.js on 127.0.0.1:3000

PostgreSQL, Redis, and application-internal ports should not be exposed publicly.

## Cloudflare

Recommended baseline:

- proxied DNS record for cescoit.com to the production Azure endpoint
- TLS mode: Full (strict)
- HTTPS redirect enabled
- no caching of authenticated application pages
- preserve normal webhook POST requests for carrier/payment integrations
- rate-limit obvious authentication and registration abuse when production-facing

Cloudflare must not be treated as the source of truth for application authorization.

## Nginx

Nginx should:

- terminate or pass validated HTTPS traffic according to the chosen Cloudflare origin-certificate design
- proxy application traffic to 127.0.0.1:3000
- preserve Host and forwarded-protocol headers
- set appropriate request-body limits for approved upload workflows
- avoid exposing evidence storage paths directly
- keep operational services bound to localhost/private interfaces

## Application configuration

Production should use an explicit public-origin setting, for example:

NEXT_PUBLIC_APP_URL=https://cescoit.com

The application should use HTTPS in production so secure authentication cookies operate correctly.

## Deployment readiness before public registration

Before opening cescoit.com to unrestricted public registration, complete at least:

- email verification
- password recovery
- abuse/rate controls
- production HTTPS
- database backups
- evidence/storage backup policy
- secret-management review
- error logging/monitoring
- invitation-token hardening
- authentication/session review
- import upload limits and validation
- privacy/terms/contact pages appropriate to service launch

## Integration implication

cescoit.com becomes the stable callback/origin identity for future integrations such as:

- carrier tracking webhooks
- payment processor webhooks
- email verification links
- password-reset links
- storage/lock-provider callbacks
- customer API integrations

Webhook endpoints should be provider-specific adapters that normalize events into CESCo Depot domain events rather than embedding provider-specific state throughout the application.
