# WebApp Sidebar Visual Regression

## Visual truth and implementation evidence

- Source visual truth: `.local/visual-regression-2026-07-22/20-daisyui-reference-1440.png`
    - Source: DaisyUI responsive collapsible icon-only drawer example supplied by the user.
    - Pixels: 1440 × 900.
    - CSS viewport: 1440 × 900.
    - Device scale factor: 1.
- Primary implementation screenshot: `.local/visual-regression-2026-07-22/14-collapsed-after-menu-lg.png`
    - Pixels: 1440 × 900.
    - CSS viewport: 1440 × 900.
    - Device scale factor: 1.
- Expanded implementation: `.local/visual-regression-2026-07-22/13-expanded-menu-lg.png`
- Tooltip implementation: `.local/visual-regression-2026-07-22/15-quick-open-tooltip-default-stack.png`
- Mobile implementation: `.local/visual-regression-2026-07-22/17-mobile-navigation-open.png`
- Quick Open Light/Dark: `.local/visual-regression-2026-07-22/18-quick-open-modal-light.png` and `.local/visual-regression-2026-07-22/19-quick-open-modal-dark.png`
- Density normalization: none. The primary source and implementation captures have identical pixel and CSS dimensions at device scale factor 1.

## State

- Desktop expanded: 256 px sidebar, `menu-lg`, 2 px inter-item gap, 39 px menu-item height, 18 px menu label.
- Desktop collapsed: 56 px rail, default compact menu sizing, 40 × 28 px menu controls, 16 px icons, labels hidden.
- Mobile: 390 × 844 viewport, desktop drawer unchecked and visually absent, native navigation dialog open.
- Themes: Quick Open Modal reviewed in `choral-light` and `choral-dark`.

## Comparison evidence

The DaisyUI reference and the final collapsed implementation were opened together in the same visual comparison at 1440 × 900. Both use a 56 px collapsed rail, icon-only menu controls, drawer-owned stacking, state variants, and tooltips that extend into the content area. The product implementation intentionally keeps its own header, active-route styling, and bottom collapse control.

A separate focused crop was not needed: the reference preview isolates the complete drawer in the full-view capture, while the implementation rail occupies the full left edge. Exact browser measurements supplemented the full-view comparison. The Tooltip state has dedicated full-view evidence because hover visibility and clipping cannot be inferred from the resting screenshot.

## Findings

- No actionable P0, P1, or P2 visual mismatch remains.
- Quick Open and navigation labels are vertically centered through their computed Flex alignment.
- The Quick Open Tooltip renders over the main content without a project-authored z-index utility. The implementation relies on DaisyUI's `.drawer-side` stacking behavior and `is-drawer-close:overflow-visible`.
- The expanded menu uses the requested `menu-lg` sizing with a small 2 px gap. The variant is limited to the open state so it does not widen the 56 px compact rail.
- The page root has no horizontal overflow at 1440 × 900 or 390 × 844.
- No P3 follow-up polish was identified in the reviewed sidebar states.

## Comparison history

1. Initial P1 density mismatch
    - Earlier evidence: `.local/visual-regression-2026-07-22/01-local-expanded.png` and `02-local-collapsed.png`.
    - Finding: 72 px collapsed rail, 48 px controls, and an oversized Quick Open trigger made the shell feel heavier than the DaisyUI reference.
    - Fix: replaced the custom grid sizing rules with DaisyUI drawer state variants, a 56 px compact rail, and direct menu styling.
    - Post-fix evidence: `.local/visual-regression-2026-07-22/11-revised-collapsed-final.png`.
2. P2 alignment and compact-width mismatch
    - Earlier evidence: `.local/visual-regression-2026-07-22/06-revised-collapsed.png` and `09-revised-collapsed-final.png`.
    - Finding: 20 px icons and inherited layout rules kept compact items wider than the reference and made centering less reliable.
    - Fix: standardized 16 px icons and explicit Flex alignment while leaving dimensions to DaisyUI.
    - Post-fix evidence: `.local/visual-regression-2026-07-22/14-collapsed-after-menu-lg.png`.
3. P1 Tooltip clipping risk
    - Finding: the original custom shell clipped collapsed-state Tooltips at the main-content boundary.
    - Fix: adopted the official `drawer-side is-drawer-close:overflow-visible` structure. A temporary manual `z-30` utility was removed after confirming DaisyUI already owns the drawer stacking context.
    - Post-fix evidence: `.local/visual-regression-2026-07-22/15-quick-open-tooltip-default-stack.png`.
4. Requested expanded-menu density adjustment
    - Fix: applied `is-drawer-open:menu-lg` and `gap-0.5`, preserving compact sizing when closed.
    - Post-fix evidence: `.local/visual-regression-2026-07-22/13-expanded-menu-lg.png` and `14-collapsed-after-menu-lg.png`.

## Primary interactions tested

- Expanded and collapsed desktop drawer state, including persistence after reload.
- Quick Open and navigation Tooltip hover in collapsed state.
- Quick Open Modal opening and rendering in Light and Dark themes.
- Mobile navigation opening, backdrop presence, SPA navigation, and automatic close after selecting `Views`.
- Desktop and mobile root overflow checks.
- Browser page-error and console streams; both were empty.

## Final result

final result: passed
