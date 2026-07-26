---
schemaVersion: 1
kind: validation-sample
title: "Quick Open — Extremely Long Result Label for Keyboard Filtering and Single Navigation Activation"
summary: Long Quick Open candidate used for wrapping, ellipsis, accessible-name, keyboard-index, and duplicate-navigation checks.
stage: queued
priority: P1
area: navigation
owner: "Elena García"
reviewer: "Noah Williams"
longValue: "quick-open://result/keyboard-filtering-arrow-navigation-enter-activation-focus-return-no-duplicate-route"
tags:
    - quick-open
    - keyboard
    - long-title
relatedSamples:
    - "samples/reader/multilingual-long-title"
    - "samples/navigation/mobile-navigation-dialog"
---

# Quick Open — Extremely Long Result Label for Keyboard Filtering and Single Navigation Activation

Search tokens include `Quick`, `Keyboard`, `Filtering`, and `Activation`.

The visible label may wrap or truncate, but its accessible name and route must still identify this exact entry. Compare with [[samples/reader/multilingual-long-title]] and continue to [[samples/navigation/mobile-navigation-dialog]].
