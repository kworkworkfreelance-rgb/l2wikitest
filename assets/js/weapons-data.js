(function () {
    if (typeof window === 'undefined') {
        return;
    }

    window.dispatchEvent(
        new CustomEvent('l2wiki:weapons-data-loaded', {
            detail: {
                source: 'static-seed',
                legacyLayer: false,
            },
        })
    );
})();
