export function createTestEnvironment(environment, additions) {
    const { ELECTRON_RUN_AS_NODE: _electronRunAsNode, ...cleanEnvironment } = environment;
    return { ...cleanEnvironment, ...additions };
}

export function shouldUseShellForCommand(command, platform = process.platform) {
    return platform === "win32" && /\.cmd$/iu.test(command);
}
