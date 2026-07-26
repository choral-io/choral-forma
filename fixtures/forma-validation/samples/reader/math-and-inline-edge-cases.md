---
schemaVersion: 1
kind: validation-sample
title: Math and Inline Edge Cases
summary: Deterministic KaTeX coverage for inline and display notation, matrices, invalid commands, currency, escaped delimiters, code literals, and local overflow.
stage: blocked
priority: P1
area: reader
owner: "Avery Chen"
reviewer: "Morgan Lee"
longValue: "reader/math-and-inline-edge-cases::valid-invalid-currency-escaped-code-matrix-long-display"
tags:
    - katex
    - fallback
    - overflow
relatedSamples:
    - "samples/reader/portable-markdown-elements"
    - "samples/reader/markdown-rendering-showcase"
---

# Math and Inline Edge Cases

This sample separates formula parsing pressure from the general rich-content document.

## Valid Inline and Display Math

Inline formulae should share the surrounding baseline naturally, as in $E = mc^2$, Euler's identity $e^{i\pi} + 1 = 0$, and the circle area $A = \pi r^2$.

$$
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
$$

Matrices, roots, and fractions should remain readable:

$$
A =
\begin{bmatrix}
1 & 2 \\
3 & 4
\end{bmatrix},
\qquad
x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
$$

## Fallback Boundaries

- Invalid input remains visible instead of failing the document: $\notARealCommand{x}$.
- Currency stays ordinary text: prices like $5 and $10 are not formulae.
- Escaped delimiters stay ordinary text: \$x\$.
- Inline code stays literal: `$x^2$`.

## Long Display Formula

The formula region should own horizontal overflow instead of widening the document:

$$
\underbrace{a_1 + a_2 + a_3 + a_4 + a_5 + a_6 + a_7 + a_8 + a_9 + a_{10} + a_{11} + a_{12} + a_{13} + a_{14} + a_{15} + a_{16} + a_{17} + a_{18}}_{\text{local horizontal overflow when the reading column is narrow}}
$$

## Related Coverage

Return to [[samples/reader/portable-markdown-elements]] or [[samples/reader/markdown-rendering-showcase]].
