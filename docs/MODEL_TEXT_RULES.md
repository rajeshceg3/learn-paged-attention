# Text, models and connectors must not collide

Applies to learning apps and any interactive scene with a model, labels, narration or leader lines. A clear first camera pose is not enough: rotating, zooming, stepping and opening details must stay readable.

## Layout contract

- Reserve separate space for teaching text, controls and the model's projected silhouette. Fit the model to the remaining stage, including the tallest and widest exploded poses. Never cover an important part or a teaching label with a floating card.
- Place labels outside the model silhouette and outside other labels, narration and controls. Measure rendered text after fonts load and after resize. Do not rely on a fixed character count or the initial camera angle.
- Anchor each connector to the actual named part in the current pose. End it at the nearest label edge, not through its text. Route it without passing through unrelated labels or controls. Avoid crossing other connectors where this makes attribution ambiguous; use stable ordering and rails where useful.
- A connector may meet its own part and pass through the adjacent model area as needed to identify it. It must not imply a different part or obscure a critical model marking. Hide an occluded annotation or offer a deliberate selected-part view when an honest connector cannot be shown.
- When a phone cannot fit all annotations, disclose fewer at once or separate annotation and model regions. Do not shrink type to unreadability, clip the model silently or stack every label over the scene.
- Keep placement stable while the camera moves. Do not let tiny projection changes swap label sides every frame. Detail reading must pause or isolate unrelated motion and restore exploration deliberately.
- Preserve direct model exploration and learner-paced stages. Fix spatial layout, not the subject, by flattening a useful 3D lesson or removing its teaching labels.

## Required acceptance evidence

For every affected app, record source revision, host revision and the tested states. Verify at 320px, 390px and a laptop width, plus a short/landscape viewport when controls consume significant height:

1. Check each teaching stage, exploded/assembled pose, detail-open state and transition.
2. Rotate through a full turn, including four cardinal views and intermediate angles. Check permitted high/low tilt and both zoom limits. Check while dragging and after it settles.
3. Inspect actual pixels for text/model overlap, label/label overlap, misanchored or ambiguous connectors, connectors through words, clipped content and unreachable controls. A full-screen canvas rectangle is not the model silhouette.
4. Where practical, assert projected model bounds against reserved UI regions and label rectangles against each other. Sample the moving states rather than only the first frame. These assertions support visual inspection; they do not replace it.
5. Test resize, font loading, reduced motion and repeated mode/step changes. No stale labels, ghost connectors or one-frame labels from the previous state.
6. Repeat the affected paths on production after merge. Keep a decisive screenshot and any below-bar cases. Record source-only, local, preview and production proof separately.

A copied rule is not a repaired app. Track each repo's diagnosis, owner, implementation and production evidence independently. Existing release holds and source-owner boundaries still apply.
