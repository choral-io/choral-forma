# Native Disclosures

[Jump to hidden heading](#forma-heading-hidden-fold-heading)

<details>
<summary>补充说明：从基础段落到表格、公式和脚注的完整阅读样例，长标题也应保持清晰且不遮挡展开箭头</summary>

这里是外层正文，包含 ==高亮==、H<sub>2</sub>O 和 ~~删除线~~。

<details>
<summary>内层推导</summary>

## Hidden fold heading

内层段落包含公式 $x^2$ 和脚注引用[^folded]。

$$
\frac{a+b}{c}
$$

- 第一项
- 第二项

| 概念 | 表达           |
| ---- | -------------- |
| 水   | H<sub>2</sub>O |
| 面积 | m<sup>2</sup>  |

> [!TIP]- 组合提示块
>
> 提示正文保持独立的折叠状态。

```text
<details>
<summary>这只是代码</summary>
</details>
```

</details>

</details>

<details open>
<summary>默认展开</summary>

默认展开的正文。

</details>

[^folded]: 脚注正文位于文档末尾，返回引用时应展开祖先折叠块。
