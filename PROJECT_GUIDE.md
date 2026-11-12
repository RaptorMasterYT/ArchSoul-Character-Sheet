# ArchSoul multiplayer integration — developer handoff

## Purpose
Extend the existing **ArchSoul TTRPG Character Sheet** at https://archsoulttrpg.com with optional multi-device accounts, shared campaigns, Game Master encounter management, monsters, initiative, and real-time combat. Keep the existing character creator working unchanged for players who do not use online features.

## Repository and deployment
- Repository: `RaptorMasterYT/ArchSoul-Character-Sheet`; default branch: `main`.
- GitHub Pages domain: `archsoulttrpg.com` (confirmed in `CNAME`).
- Main app: `index.html` (~4.95 MB, ~32,153 lines as inspected on 2026-11-12).
- Feature development branch: `feature/supabase-multiplayer`. **Do not merge into `main` without testing and explicit approval.**

## Existing application — confirmed from source
- The character creator is a single HTML application with embedded CSS and JavaScript and extensive ArchSoul content.
- Application state is held in `DB`; campaign characters live in `DB.chars` and the current character is `C`.
- Browser persistence key is `archsoul.v14`: `save()` stores `JSON.stringify(DB)` in `localStorage`; `saveSoon()` debounces saves; boot restores `DB` from local storage.
- There is a separate local Arena mode (`DB.arena`) and GM stat-block library (`DB.blocks`). **These are not automatically networked multiplayer encounters.**
- There are built-in JSON import/export and recovery mechanisms. Keep these operational.
- Individual local characters use app-level IDs such as `c...`; the Supabase `characters.id` column uses UUIDs. Preserve a mapping rather than treating them as identical.

## Supabase (setup reported complete by user; not independently verified)
The user created a free Supabase project and executed SQL for:
- `campaigns` (GM ownership and join code)
- `characters` (per-user JSON character data)
- `campaign_members` (campaign/user/character association)
- `monsters` (JSON monster data)
- `encounters` (campaign, rounds, active turn)
- `encounter_combatants` (character/monster, initiative, HP, turn order)
- RLS policies for these tables, helper functions `is_campaign_gm` and `is_campaign_member`, Realtime publication, and authenticated RPC `join_campaign(p_join_code, p_character_id)`.

Before public release, **verify policies, database behavior, realtime, and the RPC on the live Supabase project**. In particular, other campaign members may currently be unable to read one another's `characters` rows because owner-only policies exist. Monster visibility, campaign-sharing permissions, and combat-state authority need review.

## Implementation principles
1. Preserve the `localStorage` fallback and existing standalone app. An online account should be **opt-in**.
2. Never replace/clear existing local saves as a side effect of signing in. Offer explicit import/backup/migration.
3. Use Supabase Auth and the public *publishable* key in the browser. **Never commit a service_role/secret key, database password, private tokens, or credentials.**
4. Use RLS and trusted database operations to enforce ownership and GM-only actions. Do not rely on disabled buttons for authorization.
5. Avoid rewriting the giant `index.html`. Prefer separate JS/CSS modules and minimal, reviewable integration points.
6. Validate with at least two browser accounts / devices: GM and player, including join, encounter visibility, round advancement, HP update, reconnect, and unauthorized writes.
7. Build on a feature branch and use pull requests; do not overwrite `main` while building.

## Remaining work (recommended order)
1. Build optional login/sign-up/sign-out UI, Supabase connection, error handling, and configuration.
2. Add safe cloud save/load of user-owned characters; include per-character mapping, explicit local-to-cloud upload, and conflict handling.
3. Build campaign creation / join workflow with real join codes, GM/player views, and assigned characters.
4. Reuse existing local GM stat-block data to create cloud monsters; decide whether monsters are private or shared.
5. Create networked encounters and combatants with GM-controlled initiative, current turn, rounds, and HP.
6. Subscribe to Supabase Realtime for live read-only updates on player devices.
7. Test row-level security, multi-device behavior, rollback/recovery, performance, and mobile layout.
8. Review and merge after approval.

## Next developer instructions
Inspect `index.html` before touching persistence or character state. In particular, locate `DB`, `C`, `save()`, `saveSoon()`, `init()`, `charList()`, `setActiveAt()`, `sbAll()`, and `inArena()`. Do not assume the local Arena mode is the campaign combat manager. Keep changes additive; do not edit lore, game rules, calculations, CSS, or features unrelated to the specific integration task. Always explain the affected files and expected behavior before merging.

This document is a handoff / development plan, not evidence that cloud integration has already been deployed.
