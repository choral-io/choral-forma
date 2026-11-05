# Mermaid renderer acceptance

## Flowchart

```mermaid
flowchart LR
    A[中文 Markdown] --> B[WebApp and static]
    B --> C{Ready?}
    C --> D[Done]
```

## State

```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> Published: Publish
    Published --> [*]
```

## Sequence

```mermaid
sequenceDiagram
    participant Author
    participant Reader
    Author->>Reader: Markdown
    Reader-->>Author: Diagram
```

## Class

```mermaid
classDiagram
    class Page {
        +String title
        +render()
    }
    Page --> Reader
```

## Entity relationship

```mermaid
erDiagram
    PAGE ||--o{ LINK : contains
    PAGE {
        string title
    }
```

## Empty class

```mermaid
classDiagram
%% An empty class diagram remains an accessible empty figure with source.
```

## Unsupported diagram

```mermaid
pie
    "Unrendered source" : 1
```
