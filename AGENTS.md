# Ovia Closet Private Commerce Demo

## Goal

Build an exceptionally polished interactive private commerce concept for the fashion brand Ovia Closet.

This is a sales demo intended to impress a real prospective client.

It is NOT a production ecommerce backend.

The experience must feel like real functioning software, not a slide deck or static mockup.

## Sources of truth

1. `reference/catalogue/`
   - Authoritative source for product names, prices, available sizes, colors and product imagery.

2. `reference/logo/`
   - Authoritative source for Ovia branding.

3. `reference/ovia-concepts/`
   - Visual direction only.
   - Do not reproduce UI mistakes from these references.

4. `reference/aarini-reference/`
   - Interaction and product-flow inspiration only.
   - Do not copy Aarini branding, colors, products or ethnic-fashion aesthetic.

## Product imagery

Use Ovia's actual catalogue photographs.

Extract/crop product imagery from the supplied screenshots where necessary.

Do NOT generate replacement clothing images.

Do NOT alter the clothing design.

Remove surrounding WhatsApp/browser UI from cropped product assets.

## Design direction

Ovia should feel:

- feminine
- modern
- editorial
- fashion-forward
- affordable-premium
- sophisticated
- mobile-first

Avoid:

- generic SaaS styling
- excessive gradients
- excessive glassmorphism
- black-and-gold luxury aesthetic
- ethnic/heritage Aarini styling
- cartoonish UI
- fake AI-generated fashion products

## Palette

Primary: #A64F8C
Logo mauve: #B878AC
Deep plum: #673453
Soft blush: #EFDAEC
Ivory: #FFF9F5
Text: #292327
Muted: #756B70

Maintain good contrast.

## UX priority

The customer experience is the most important part of the demo.

Spend approximately:
- 55% visual/interaction emphasis on storefront + PDP + cart
- 25% on admin / inventory / orders
- 20% on analytics

## Interactions

Every visible click must produce a real UI state change.

Examples:

Selecting size S:
- S visibly becomes selected
- previous selected size becomes unselected

Add to Bag:
- cart state updates
- cart count updates
- confirmation/bottom sheet appears
- correct product, price and selected size are displayed

Inventory:
- clicking + actually increments the number
- saving persists the change
- inventory table updates

Analytics:
- changing period shows loading feedback
- chart animates into the new state
- numbers and relevant insights update

Never move a fake cursor over controls without changing application state.

## Responsiveness

Primary design target:
390px mobile viewport.

Also fully support:
- 768px tablet
- 1280px desktop
- 1440px desktop

Never crop critical UI to fake motion.

## Demo data

Admin, orders, revenue and analytics numbers are simulated.

Display a discreet:

"DEMO MODE • Simulated business data"

indicator in the business interface.

Never imply demo analytics are real Ovia data.

## Architecture

Frontend-only demo.

No database.
No payment provider.
No authentication backend.

Use local demo data and localStorage.

## Quality standard

This must look client-ready.

Before considering any page finished:
- verify mobile
- verify desktop
- test interactions
- check spacing
- check overflow
- check hover/focus states
- check text accuracy
- check product accuracy
- check loading states
- check empty/error state where relevant

Do not proceed to the next major phase with obvious visual defects.

## Workflow

Before major implementation:
1. inspect existing files
2. inspect relevant reference images
3. describe plan
4. implement
5. run tests/build
6. visually inspect output
7. fix issues
8. summarize changes