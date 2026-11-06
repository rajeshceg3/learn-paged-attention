# Paged Attention

A friendly 3D, learner-paced look at how vLLM's PagedAttention keeps GPU memory tidy.

- **Meet it**: spin the model around.
- **Peek inside**: boxes spread apart and get hand-written labels. Tap a part to meet it.
- **Make it go!**: four moves (Ask, Write, Look up, Give back), one press at a time, or let it run.

Source for the idea: Kwon et al., "Efficient Memory Management for Large Language Model Serving with PagedAttention" (SOSP 2023), https://arxiv.org/abs/2309.06180

Static page, no build step. Open `index.html` through any static server.

## Annotation layout

Peek inside and Make it go use one selected named part at a time. The picker is outside a separately fitted model stage; its connector ends above the picker. Hidden-behind-another-part connectors are suppressed rather than pointing through an unrelated part. Drag still rotates the model; camera distance is fitted automatically rather than wheel zooming into teaching text. Short landscape screens use a separate right-hand reading/control column.

Regression: install Playwright locally, then `node tests/spatial-regression.cjs` (Chrome executable `/usr/bin/google-chrome`; set `PLAYWRIGHT_PATH` or `VIEWPORTS` when needed). Tests sample all available named parts while dragging at phone, laptop and landscape sizes, check projected bounds and control separation, and save pixels. Visual review and production recheck remain required. See `docs/MODEL_TEXT_RULES.md`.
