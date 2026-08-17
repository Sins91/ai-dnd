---
name: design-ai-adventures
description: Design, review, extend, and implement AI-driven text adventures built on a deterministic rules core with natural-language input and AI narration. Use when Codex needs to create or critique game pillars, loops, scenes, puzzles, clues, action resolution, fail-forward outcomes, checkpoints, persistent consequences, narrative constraints, state models, content schemas, or acceptance tests for AI interactive fiction, AI RPGs, and conversational adventure games.
---

# Design AI Adventures

Build AI text adventures as games with stable rules, not as unconstrained story chats. Let players describe freely; let deterministic systems decide facts and outcomes; let AI interpret intent and narrate approved results.

## Load the design bible

Read [references/design-bible.md](references/design-bible.md) completely before performing any substantive design, audit, or implementation task. Treat its highest principles and acceptance criteria as the default project standard.

When working in an existing project, also inspect its current content model, game state, action resolver, AI prompt boundary, persistence behavior, tests, and player UI before making recommendations or edits.

## Select the task path

- For a new game or chapter, use **Design**.
- For an existing design, codebase, or content pack, use **Audit**.
- For requested code or content changes, use **Implement** after auditing the affected path.
- For a design question, answer from the bible and relate the answer to concrete player behavior and system state.

## Design

1. State the one-sentence experience promise and identify the intended player decisions.
2. Define the deterministic world state, immutable facts, player knowledge, mutable state, resources, relationships, risks, exits, and endings.
3. Map the turn loop: perceive, infer, act, resolve, narrate, mutate state, choose again.
4. Design each scene as an interactive state machine, not as a prose passage.
5. Provide at least two materially different advancement methods when the content scope permits. Make methods differ by prerequisites, costs, risk, relationships, resources, or later consequences.
6. Classify outcomes explicitly: `progress`, `flavor`, `blocked`, `costly_success`, `failed_forward`, `failed`, or `complete`.
7. Ensure critical information has redundant discovery paths and no accidental permanent deadlock.
8. Specify the exact facts AI may narrate and the facts it must never invent.
9. Add rule tests, content acceptance cases, synonym cases, negation cases, model-off behavior, and checkpoint restoration cases.
10. Use the scene template in the bible when delivering a reusable scene specification.

## Audit

Inspect evidence before judging. Trace at least one complete action from player input through intent parsing, rule resolution, state mutation, narration, persistence, and UI feedback.

Evaluate in this order:

1. Whether rules, rather than generated prose, own truth and state changes.
2. Whether the player receives meaningful choices rather than cosmetic wording variants.
3. Whether outcomes and costs are legible in both narration and state/UI.
4. Whether reasonable unanticipated actions receive useful, world-consistent feedback.
5. Whether failures are telegraphed, fair, recoverable, and usually move play forward.
6. Whether clues can be missed permanently or scenes can deadlock.
7. Whether AI can leak secrets, invent facts, override outcomes, or misread negation.
8. Whether the game remains functional when the model is unavailable.
9. Whether content expansion requires growing central conditional branches.
10. Whether tests cover rules and player-language variation, not only happy-path prose.

Report findings with concrete references to scenes, state fields, rules, prompts, files, or UI behavior. Prioritize broken agency and unstable truth over literary polish.

## Implement

1. Preserve the separation `input → intent → rule resolution → approved facts → narration`.
2. Put gameplay facts and effects in structured state or content data, never only in prompts.
3. Keep model output schema-constrained and validate it before use.
4. Interpret ambiguity conservatively. Clarify or select a low-risk reversible action when ambiguity could cause irreversible harm.
5. Make every important state mutation observable to the player.
6. Prefer data-driven action rules and effects over adding scene-specific branches to a central resolver.
7. Keep narration length proportional to event importance.
8. Preserve local fallback behavior and exact checkpoint restoration.
9. Add or update proportionate tests before declaring completion.
10. Run the project's existing validation commands and report any unverified behavior.

## Resolve tensions

Apply these priorities when goals conflict:

1. Stable world truth over generated novelty.
2. Meaningful player agency over authorial plot protection.
3. Clear causal feedback over atmospheric ambiguity.
4. Persistent consequences over cosmetic branches.
5. Fair fail-forward play over routine restarts.
6. Testable structured content over prompt-only behavior.
7. Event-paced narration over uniformly elaborate prose.

Do not use “the AI will handle it” as a substitute for specifying rules, state, consequences, or validation.

## Deliverables

Match the output to the request. Useful artifacts include:

- a game or chapter design specification;
- a completed scene template;
- a prioritized audit with evidence;
- a state model or content schema;
- an action-resolution table;
- AI narration constraints and approved-facts contract;
- a test matrix and acceptance checklist;
- implemented code and verified tests when changes are requested.

Lead with the resulting design decision or implementation outcome. Explain tradeoffs in terms of player agency, causal clarity, persistent state, failure fairness, and maintainability.
