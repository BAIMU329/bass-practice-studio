---
name: bass-learning-product
description: Guide product, UX, content, learning-flow, recommendation, progress-tracking, capability-assessment, and public-material decisions specifically for Bass Practice Studio. Use when analyzing or changing its pages or interactions; its diagnosis, recommendation, practice, acceptance, recording, or ability-map flow; its Chinese interface or course copy; its courses, original exercises, assessments, recommendation or scoring rules; or the publication status of its scores, Guitar Pro files, audio, or video. Do not use for unrelated programming, other music products, or general bass-playing questions that do not involve Bass Practice Studio.
---

# Bass Learning Product

Treat Bass Practice Studio as a browser-based learning system, not a download catalog. Preserve this learning loop:

`诊断能力 → 找到短板 → 获得练习 → 完成验收 → 更新能力地图`

## Required workflow

1. Inspect the relevant current pages, data, and code before proposing changes.
2. Separate verified behavior from static UI, mock data, and intended behavior. State “无法从当前代码确认” when evidence is insufficient.
3. Explain the current product problem and user impact in plain Chinese.
4. Propose the smallest change that advances the learning loop. Keep one primary action per page.
5. Before editing website code, present the analysis and proposed change, then wait for explicit user confirmation.
6. After confirmation, implement only the approved scope and verify desktop, tablet, and mobile readability plus empty, loading, success, and failure states.
7. Never deploy or publish unless the user explicitly asks.

## Product decisions

- Read [references/product-model.md](references/product-model.md) for any page, flow, feature, recommendation, assessment, record, or copy task.
- Read [references/content-and-copyright.md](references/content-and-copyright.md) whenever a task touches scores, Guitar Pro files, audio, video, song-based teaching material, attribution, licensing, or public deployment.
- Keep the six capability dimensions fixed unless the user explicitly changes the product model: 指板、和声、节奏、技术、表达、迁移.
- Make the current level, today’s practice, recommendation reason, and completion standard visible at the point where the user chooses a practice.
- Do not invent professional-looking metrics, AI capabilities, data sources, or availability.
- Label real, static, and mock data distinctly. Mark unavailable functions honestly.
- Call deterministic rules “规则” or “推荐逻辑”, not AI.

## Writing decisions

- Use direct, short, actionable Chinese.
- Prefer verb-led labels such as “开始3分钟诊断”, “练习这首歌”, “记录本次练习”, and “查看薄弱能力”.
- Explain why an exercise is recommended and what counts as passing.
- Distinguish “练习已记录” from “验收已通过”. Do not claim skill improvement from a click alone.
- Give every empty state a next action. Give every error a plain explanation and a recovery action.
- Avoid vague words such as “赋能”, “探索”, “沉浸式”, and “智能化” unless they convey a specific, verifiable meaning.
- Explain unavoidable music or technical terms for beginner and intermediate learners.

## Interface direction

- Aim for a calm, professional music practice room, not a dense administration dashboard.
- Prioritize readable hierarchy, restraint, focus, and responsive behavior.
- Use `sites:sites-building` for implementation craft and `browser:control-in-app-browser` for interactive validation when available, but retain this skill’s analyze-first and no-unrequested-deployment constraints.
- Use `ux-writing` for detailed microcopy work when available, with this skill’s product model taking precedence.

## Completion check

Before presenting a proposal or implementation, verify:

- The change advances at least one step of the learning loop and does not break the next step.
- The page has one unambiguous primary action.
- Recommendation reason and passing criteria are visible where relevant.
- Static, mock, unavailable, and real behavior are not confused.
- Copy states what happened and what the user should do next.
- Material publication follows the copyright reference.
- No website code was changed before user confirmation.
