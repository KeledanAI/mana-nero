# PRODUCT REQUIREMENTS DOCUMENT
## Project: Game Store Platform (Events + Community + CRM)

---

# 1. PRODUCT VISION

Build a digital platform for a physical collectible card game / hobby store focused on:

- Events and tournaments
- Community engagement
- Customer relationship management (CRM)
- Simple product reservation flows

Core principle:
> EVENTS + COMMUNITY + CRM first  
> Commerce is secondary and incremental

---

# 2. TARGET USERS

## Primary
- Local players (TCG, RPG, miniatures, board games)
- Regular event participants

## Secondary
- Casual visitors
- Collectors (cards, comics, hobby items)

## Internal
- Store owners
- Staff managing events and customers

---

# 3. V1 — CORE PLATFORM

## Objectives
- Launch fast
- Enable event discovery and booking
- Build user database
- Enable simple content publishing
- Keep system easy to maintain

---

## Features

### 3.1 Public Website
- Homepage with:
  - upcoming events
  - latest news
  - clear CTAs (book, join, subscribe)
- Events listing page
- Event detail page
- News/announcements page
- Contact/location page
- Community/game categories page

---

### 3.2 Authentication
- Email/password signup
- Login/logout
- Basic session management
- Optional password reset

---

### 3.3 User Area
- Profile
- Booking history
- Preferences (games/interests)
- Newsletter opt-in

---

### 3.4 Event System
- Create/edit/delete events
- Fields:
  - title
  - category
  - game type
  - date/time
  - capacity
  - price (display only)
  - description
- Booking system:
  - reserve spot
  - confirmation
  - waitlist
- Admin:
  - view participants
  - export CSV
  - check-in users

---

### 3.5 Content Management
- Admin can:
  - publish updates/news
  - edit/delete posts
- Simple CMS (no overengineering)

---

### 3.6 CRM Lite
- User profiles
- Interest tags
- Booking history
- Marketing consent
- Admin notes

---

### 3.7 Communications
- Newsletter signup
- Booking confirmation emails (architecture ready)
- Telegram broadcast support (data model level)

---

### 3.8 Product Reservation (LIGHT)
- Request form:
  - product name
  - category
  - notes
- No inventory
- No payments
- Store pickup only

---

## V1 Success Metrics
- Event fill rate
- Registered users
- Repeat bookings
- Newsletter signups

---

# 4. V2 — MONETIZATION & AUTOMATION

## Objectives
- Increase revenue per event
- Automate communication
- Structure product demand

---

## Features

> **Nota implementazione (repository):** i primi slice V2 effettivamente presenti nel codice (pagamenti Stripe, reminder/campagne outbox, check-in QR, CRM/analytics staff, stock alert, ecc.) sono descritti in [ROADMAP.md](./ROADMAP.md) (tabella «Stato implementazione») e nello sprint [docs/sprint-v2-next.md](./docs/sprint-v2-next.md). La waitlist strutturata usa **`event_registrations`** con stato `waitlisted` (nessuna tabella separata `event_waitlist` nel DB attuale).

### 4.1 Event Enhancements
- Online payments
- Deposits
- QR check-in
- Automated reminders
- No-show tracking

---

### 4.2 CRM Expansion
- Advanced segmentation
- Loyalty scoring
- Behavior tracking

---

### 4.3 Communications
- Campaign system
- Segmented messaging
- Automated flows:
  - event reminders
  - waitlist notifications

---

### 4.4 Product Reservations (STRUCTURED)
- Preorders
- Limited quantities
- Priority customers
- Stock arrival alerts

---

### 4.5 Admin Dashboard
- Event analytics
- Attendance tracking
- Performance insights

---

## V2 Success Metrics
- Revenue per event
- No-show reduction
- Conversion from waitlist
- Preorder conversion

---

# 5. V3 — SCALE & EXPANSION

## Objectives
- Expand monetization
- Strengthen community
- Improve operational intelligence

---

## Features

### 5.1 Commerce Layer
- Product catalog
- Inventory
- Payments
- Optional shipping

---

### 5.2 Community System
- Public user profiles
- Rankings
- Event history
- League system
- Rewards

---

### 5.3 Tournament Engine
- Brackets
- Pairings
- Match reporting
- Optional external integrations

---

### 5.4 Analytics
- Revenue dashboards
- Customer lifetime value
- Event profitability
- Demand forecasting

---

### 5.5 Omnichannel
- WhatsApp integration
- Telegram bot (self-service)
- Advanced notification system

---

## V3 Success Metrics
- Customer lifetime value
- Retention rate
- Community engagement
- Revenue growth

---

# 6. DOMAIN MODEL (HIGH LEVEL)

Core entities:

- users
- profiles
- user_preferences
- events
- event_categories
- event_registrations (include **waitlist** come righe `status = waitlisted` + `waitlist_position`; non tabella `event_waitlist` separata nell’implementazione attuale)
- posts
- newsletter_subscribers
- broadcasts
- product_reservation_requests
- admin_notes

---

# 7. KEY PRODUCT PRINCIPLES

- Keep V1 simple and fast
- Avoid overengineering
- Prioritize real-world usability
- Optimize booking flow
- Build modular architecture
- Extend incrementally

---

# 8. NON-GOALS (EARLY STAGES)

- Full e-commerce
- Complex inventory systems
- Advanced tournament logic
- Multi-tenant SaaS complexity
- Marketplace features

---

# FINAL NOTE

This product succeeds if:

- Events are easy to discover
- Booking takes <30 seconds
- Store owners can manage everything easily
- Users keep coming back

Failure happens if:

- System becomes complex too early
- Admin UX is difficult
- Too much focus on e-commerce instead of community