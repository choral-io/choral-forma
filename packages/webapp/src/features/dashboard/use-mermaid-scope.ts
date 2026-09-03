import { useEffect, useId, useState } from "react";

import { createMermaidRenderScope } from "@/lib/mermaid";

export function useMermaidScope(key: string) {
    const reactId = useId();
    const [scope] = useState(() => createMermaidRenderScope(`${key}-${reactId}`));
    useEffect(() => {
        return () => {
            scope.dispose();
        };
    }, [scope]);
    return scope;
}
