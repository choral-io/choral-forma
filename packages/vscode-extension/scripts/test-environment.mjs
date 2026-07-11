export function createTestEnvironment(environment, additions) {
    const { ELECTRON_RUN_AS_NODE: _electronRunAsNode, ...cleanEnvironment } = environment;
    return { ...cleanEnvironment, ...additions };
}
