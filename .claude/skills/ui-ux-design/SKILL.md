---
name: ui-ux-design
description: Use when designing or reviewing screens, flows, landing pages or components - layout, hierarchy, copy, accessibility, RTL/Arabic, mobile-first behaviour. Complements the frontend-design plugin (visual craft) with product UX rules and a review checklist.
---

# UI/UX design

Good UI = the user finishes the task fast, without doubt, on a cheap phone with weak signal.

## Process
1. **Who and what job?** One sentence: "A patient in Ibra books a home blood test in under 2 minutes." Design for that path first.
2. **Flow before pixels.** List the steps; remove every step that is not needed; put the main action where the thumb is (bottom on phones).
3. **Layout and hierarchy.** One primary action per screen. Size and weight show importance; spacing groups related items (8 px scale). Max ~70 characters per line of text.
4. **Use the design system** (`project-knowledge/DESIGN_SYSTEM.md`): colours as tokens, one type scale, existing components. Brand rules are not optional (name spelling, approved logo only).
5. **Write the words.** Short, plain, action verbs on buttons ("Book visit", not "Submit"). Errors say what happened and what to do. Same tone in Arabic and English.
6. **States.** Loading (skeleton, not spinner-only), empty (what to do next), error (retry), success (what happens now), offline.
7. **Review** with the checklist, then screenshots at 375 px and 1440 px in both languages.

## Checklist
- [ ] Tap targets ≥ 44 px; text ≥ 16 px for body on phones; contrast ≥ 4.5:1.
- [ ] Works with keyboard; focus visible; images have alt text; icons with labels.
- [ ] RTL: layout mirrors, numbers/phone/email stay LTR (`.ltr`), icons with direction flip.
- [ ] No horizontal scroll at 360–1920 px; sticky bars never cover content or maps.
- [ ] Motion: transform/opacity only, respects `prefers-reduced-motion`; nothing heavy on phones.
- [ ] Forms: right keyboard (`type=tel`, `inputmode`), inline validation, keep input on error.
- [ ] Trust: prices, who will come, privacy note visible before the user commits.

## People in imagery (project rule)
Women in a full, properly draped hijab; never a kumma with medical uniforms; no people on merchandise.
