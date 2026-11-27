# Pele 1.13.0 flowchart geometry

This patch updates the split ESM modules used by the WebApp Worker. Edges between a subgraph and its descendants follow the existing chain of group ports. Decision self-loops meet the node outline, and multiple self-loop labels get separate space.

Run `mise run test:markdown:browser` to check edge endpoints, obstacle avoidance, label separation, and source fallback in the RPC and static WebApp readers. Remove the patch and its workspace registration when the unpatched release passes the geometry checks. Verify subgraph self-loops separately before removing their source fallback.
