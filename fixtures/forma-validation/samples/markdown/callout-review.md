# Callout review

> [!NOTE]
>
> A real note.

> FORMA&#95;CALLOUT_MARKER_NOTE This is ordinary quoted text, not an internal marker.

> FORMA\_CALLOUT_MARKER_NOTE Escaped underscores are ordinary quoted text.

The leading empty quote example remains ordinary quoted content when parsed:

```text
>
> [!WARNING]
> A leading empty quote line does not satisfy the first-line contract.
```

> [!TIP]

- > [!IMPORTANT]
  >
  > A note in a list item.

A marker followed by a hard break remains ordinary quoted content. Its exact two-space spelling is covered by the shared boundary cases:

```text
> [!CAUTION]\
> A hard break is not a standalone marker line.
```

    > [!NOTE]
    > An indented code example.
