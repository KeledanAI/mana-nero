# CLAUDE.md

## Project Identity

GameStore is not a generic commerce site.

It is a **local game store platform** focused on:

- events and tournaments
- community growth
- CRM and staff operations
- lightweight product demand capture

Core rule:

> events + community + CRM first  
> commerce is secondary and additive

Every change should improve this loop:

`discover -> book -> receive reminder -> attend -> return -> join a community -> receive relevant follow-up`

---

## Architecture Rules

### Stack

- Next.js App Router
- Supabase Auth + Postgres + Storage
- Tailwind + shadcn/ui style primitives
- Server Actions for mutations
- RLS-first data protection

### Layering

Use this flow whenever possible:

`UI -> Server Action -> lib/domain/* -> Supabase / RPC / SQL contract`

Rules:

- Keep UI components thin.
- Do not place booking, role, capacity, or workflow logic in React components.
- Domain logic belongs in `lib/domain/*`.
- Data access helpers belong in `lib/gamestore/*` or `lib/supabase/*`.
- Reusable communication runtime belongs in `lib/comms/*`.

### Booking

Booking is a protected domain.

- All booking mutations go through the single SQL RPC `event_registration_action`.
- Do not reimplement booking logic in TypeScript.
- Do not split waitlist into another table.
- Do not compute capacity client-side as a source of truth.

### Roles and Authorization

- Source of truth: `profiles.role`
- Allowed roles: `customer`, `staff`, `admin`
- SQL policies must use `public.has_role(required)`
- TypeScript role checks must mirror SQL hierarchy exactly
- Never introduce env-based admin checks like `ADMIN_EMAILS`

### Schema Evolution

Schema changes must be additive whenever possible.

- Prefer enums and explicit columns for core workflow state
- `jsonb` is allowed only for non-critical extensions
- Public entities use stable slugs
- Treat Postgres schema as a product contract, not as temporary scaffolding

---

## Repo Conventions

### Files and Responsibilities

- `app/*`: routes, layouts, server actions local to route segments
- `components/*`: presentational UI and reusable view logic
- `lib/domain/*`: business operations
- `lib/gamestore/*`: query helpers, formatting, product-facing data access
- `lib/supabase/*`: clients, env helpers, storage integration
- `lib/comms/*`: queueing, dispatch, messaging orchestration
- `lib/email/*`: provider integration and email rendering
- `supabase/migrations/*`: schema and policy changes
- `scripts/*`: operational scripts run manually or by automation

### Naming

- Use explicit names over generic helpers
- Prefer `event_registration_action` style precision over vague names
- Keep slugs stable once public
- Prefer full words over abbreviations unless domain-standard

### TypeScript

- Keep `strict` compatibility
- Add explicit types on domain boundaries
- Avoid `any`
- Prefer narrow payload types for outbox and actions
- Throw clear `Error` messages from server-only code

### React / Next

- Prefer Server Components by default
- Use Server Actions for trusted mutations
- Keep forms simple and progressively enhanced
- Revalidate only the paths impacted by a mutation
- Avoid pushing business rules into client components

### Styling

- Preserve the current Mana Nero visual direction unless intentionally redesigning
- Avoid generic SaaS styling
- Keep public pages atmospheric and community-oriented
- Admin can stay simpler, but should remain legible and intentional

---

## Database and RLS Standards

### RLS

- Every protected table must have explicit policies
- Role-based staff access must go through `has_role('staff')` or `has_role('admin')`
- Self-service access uses `auth.uid() = ...`
- Never duplicate role hierarchy inline in many policies

### Migrations

- Write migrations as durable product changes
- Include indexes and constraints with schema changes
- Keep RLS changes in the same migration when they belong together
- If a feature depends on a table, policy, enum, or function, ship the contract first

### Outbox

- `communication_outbox` is the queue contract
- Inserts must be idempotent
- Dispatch is asynchronous and separate from enqueue
- Retries must not create duplicate user-visible sends

---

## Product Standards

### Event Experience

Every important event should eventually support:

- clear date/time
- capacity state
- audience/skill level
- booking status clarity
- waitlist clarity
- practical info for attending

### Community Pages

Game pages are not generic CMS pages.

They should communicate:

- who the community is for
- what formats are played locally
- what the expected vibe is
- which upcoming events matter
- how a newcomer joins

### CRM

CRM features should help staff act, not just store data.

Prefer features that improve:

- follow-up
- retention
- event attendance quality
- understanding of interests by game/community

### Communications

Communications must be:

- useful
- contextual
- consent-aware
- local

Avoid noisy marketing patterns.

---

## Operational Priorities

When deciding what to build next, prefer this order:

1. reliability of existing event loop
2. staff operations
3. communications runtime
4. community experience
5. CRM intelligence
6. monetization extensions

If a change does not help the local store operate better or help the community return more often, it is probably not the right priority.

---

## Change Checklist

Before merging a meaningful change, check:

- Does it respect the `events + community + CRM first` direction?
- Does it preserve booking/RLS invariants?
- Is the logic in the right layer?
- Is the schema change additive and durable?
- Are user-facing statuses understandable in Italian?
- Does the change help staff or players in a concrete way?

---

## Near-Term Priorities

Current priorities are:

1. align docs with the real project
2. productionize outbox dispatch and event reminders
3. improve event detail and booking UX
4. add staff operational dashboards
5. evolve game pages into real community hubs
