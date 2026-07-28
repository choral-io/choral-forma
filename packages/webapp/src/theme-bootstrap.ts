try {
    const theme = localStorage.getItem("forma.theme");
    if (theme === "choral-light" || theme === "choral-dark") {
        document.documentElement.dataset.theme = theme;
    }
} catch {
    // Theme preference is optional; static HTML remains usable when storage is unavailable.
}
