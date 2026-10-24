# Callout title compatibility

> [!nOtE] A **custom** [title](#forma-heading-callout-title-compatibility)
>
> Body stays outside the title.

> [!tip] Title only

> [!IMPORTANT]
>
> Default title and a separate body paragraph.

> [!warning] 中文标题
>
> 第一段正文。
>
> 第二段正文。

> [!caution]

> [!note]- Initially collapsed
>
> This body is available by opening the summary.
>
> ## Folded target
>
> A repeated citation[^fold-note] is inside the folded body.

> [!TIP]+ Initially expanded
>
> This starts open and can be collapsed.

> [!CUSTOM] Unknown types remain quotations.

> \[!note] Escaped markers remain literal.

> [!N&#79;TE] Entity-spelled markers remain literal.

```markdown
> [!note] A literal title
>
> A literal body.
```

Compare with [basic callout content](callouts.md) for lists and footnotes.

[Jump to folded heading](#forma-heading-folded-target).

[^fold-note]: A note whose return link may point into a collapsed callout.
