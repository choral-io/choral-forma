# Shared viewer inspection

## Wide image

![Wide image with visible edges](image-viewer.svg)

## Tall image

![Tall image with visible edges](image-viewer-tall.svg)

## Linked image

[![Linked image keeps its destination](image-viewer.svg)](#forma-heading-shared-viewer-inspection)

## Wide Mermaid

```mermaid
flowchart LR
    A[Source document] --> B[Core projection]
    B --> C[WebApp reader]
    C --> D[Static reader]
    D --> E[Safe viewer overview]
```

## Tall Mermaid

```mermaid
flowchart TD
    A[First item] --> B[Second item]
    B --> C[Third item]
    C --> D[Fourth item]
    D --> E[Last item]
```

Mermaid fit must show all diagram content to the left of the right control rail. Expand, zoom, resize, fit and Escape must retain the same controls and return focus to the opener. Images render normally and image links keep their authored destinations. Without scripts, Mermaid stays code and images remain ordinary images.
