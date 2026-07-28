import { staticRuntimeConfigId, type StaticRuntimeConfig } from "./static-runtime";

export function setStaticRuntimeConfig(config: StaticRuntimeConfig) {
    clearStaticRuntimeConfig();
    const element = document.createElement("script");
    element.id = staticRuntimeConfigId;
    element.type = "application/json";
    element.textContent = JSON.stringify(config);
    document.head.append(element);
}

export function clearStaticRuntimeConfig() {
    document.getElementById(staticRuntimeConfigId)?.remove();
}
