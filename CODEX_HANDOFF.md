# Ink Study: handwriting page for jeremp0.me

## Immediate task

Integrate Jeremy's trained handwriting model into the existing website at https://jeremp0.me as a page, provisionally `/handwriting`. The user wants a simple Markdown editor that converts typed text to their handwriting and exports images and PDF. Inspect the actual repository, its instructions, framework, design, and deployment setup before implementing. The repository has not yet been provided in the preceding chat. No website integration or deployment has been done.

Place the user's latest `shape-v2-results.zip` beside this handoff or elsewhere accessible to Codex. That archive is the authoritative model/source package. It includes a newly trained model, not just the starter from the notebook. Do not substitute the old recurrent v1 model.

## Requested and proposed page behavior

User-requested: simple Markdown editing, handwriting generation, image and PDF output, integrated into the existing website.

Proposed defaults from the preceding assistant response (not separately confirmed by the user): `/handwriting`; live preview; paragraphs, headings, lists, bold and italic; controls for size, variation, spacing, ink color and paper size; PNG, SVG and multipage PDF exports; styling matched to the site. Support sensible pagination, margins and line wrapping. Preserve text content and report unsupported characters clearly. Treat raw Markdown HTML as untrusted.

Browser-side inference is the proposed architecture because the decoder is small and requires no GPU. It keeps entered text on the visitor's device, but makes the inference model downloadable. The user has been informed of this tradeoff and has not yet explicitly selected browser-side versus server-side inference. Check repository/hosting constraints before finalizing architecture.

## Latest model and archive

Filename: `shape-v2-results.zip` (the user's newest export).

Archive contents include:
- `selected-model.pt`: use this checkpoint for inference, selected at epoch 64 (checkpoint epoch field is zero-based).
- `handwriting_shapes.py`: authoritative model architecture, preprocessing and generation implementation.
- `handwriting_common.py`: shared preprocessing and SVG text layout.
- `selected-model-metadata.json`, `metadata.json`, `config.json`.
- `last.pt`, `history.json`: full training state/history.
- `character-comparison.png`, `generated-text.svg`, `generated-text-settings.json`, `learning-curves.png`, generation diagnostics.
- `validation-report.json`: inherited report about the original starter, NOT the authoritative metrics for the user's new run. Use their history/checkpoint for new-run metrics.

Inspected details:
- Checkpoint format: `ink-study-shape-v2`.
- 83 characters, 150 stroke-structure groups.
- 48 resampled points per stroke, up to 4 strokes.
- Config: latent 8, hidden 192, group embedding 32, batch size 64, learning rate 0.001, max epochs 200, patience 40, KL weight 0.002.
- User's run completed 104 epochs; best validation reconstruction RMSE at epoch 64 was about 0.095914 x-height units. Mean-shape baseline RMSE was about 0.153316. These are reconstruction metrics, not free-generation readability scores.
- Original split: 650 training / 81 validation / 81 test. Reconstruction validation covers 76 of 81 examples; five held-out stroke structures are absent from training. The final test was not evaluated in the provided archive.
- Latest generation settings: variation 0.7, seed 31415, text `Hi Gang\n\nThis is very handwritten.\nJosh x Megaknight`.
- Uploaded Python sources exactly matched the sources supplied in the prior chat.

## What the model actually does

This is an anchored whole-character conditional variational model. Training-only mean shapes and explicit stroke boundaries constrain the output. It is not an unconstrained autoregressive handwriting model and does not learn sentence spacing.

For a character:
1. Select a training-derived stroke group using its sample-count frequency.
2. Select two latent vectors from that group's trained latent bank.
3. Interpolate them with alpha uniformly sampled from 0.15 to 0.85; add small latent noise scaled by that group's observed latent standard deviation.
4. Concatenate the latent vector with the group's embedding.
5. Decode through Linear -> SiLU -> Linear -> SiLU -> Linear.
6. Reshape to the complete stroke coordinate array. Bound residuals with `3 * tanh(raw / 3)` and apply the group mask.
7. Compute `mean_shape + group_scale * variation * decoded_residual`.
8. Emit only the group's active strokes. Coordinates use x-height units; pressure is currently a constant 0.5.

Generation decodes new point arrays; it does not paste the selected latent examples' original stroke arrays. Variation is conservative and groups with few recordings have limited evidence for diversity. At variation zero the selected group's mean shape is used; different seeds can still select different groups.

Use the actual Python source as the exact specification. The encoder and optimizer are unnecessary for browser inference. Inspected decoder parameters, group embeddings, means and scales total 726,360 bytes as raw tensors, before metadata, masks and latent bank. Export only inference assets rather than loading the PyTorch checkpoint in a browser.

For a browser port, compare JavaScript decoder output to Python for fixed group IDs and latent vectors. A new seeded browser PRNG can be deterministic without reproducing NumPy's exact stream; document that distinction. Keep expensive generation off the main UI thread if needed, and debounce editor updates.

## Rendering and validation

The existing `svg_text` function is a basic separated-print renderer. It wraps text and uses heuristic baseline/descender placement. It does not parse Markdown or paginate PDF. Implement a shared layout representation so preview, PNG, SVG and PDF use consistent glyph placements and page breaks. Prefer vector paths in PDF when practical.

Markdown formatting can be represented through layout and rendering (heading size, list markers, thicker strokes for bold, optional shear for italic); it was not learned from the character dataset. Unsupported Unicode needs explicit handling. Do not silently drop text or imply support for an untrained alphabet.

Earlier v1 recurrent generation failed: nearly no pen lifts/endings learned despite roughly 96% aggregate accuracy. A repaired recurrent pilot improved structural metrics but still distorted characters. Do not revive that approach as the working model.

The delivered shape model produced readable sample text and character comparisons. Prior validation checked 83 characters across five seeds for finite outputs and preserved stroke structure, deterministic repeated seeds, finite gradients, checkpoint loading, and exact CPU resume equivalence. The notebook was exercised with simulated Colab storage/download and actual CPU inference/training. These checks are not proof that every output is aesthetically ideal.

## Suggested first implementation steps

1. Read repository instructions and identify the site's framework, styling, routing and hosting.
2. Inspect and safely extract `shape-v2-results.zip`; load trusted checkpoints with `torch.load(..., weights_only=True)` when exporting.
3. Convert only the selected model's inference assets and implement a decoder parity check.
4. Add the page, editor, controls, paginated preview and downloads using existing site patterns.
5. Verify content preservation, unsupported characters, Markdown behavior, long-document pagination, deterministic seeds, mobile layout, and exported output against preview.
6. Report changes, checks and deployment status accurately. Repository access is the only missing starting dependency from the preceding conversation.
