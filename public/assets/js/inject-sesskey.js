(function() {
    try {
        // Safely access M.cfg.sesskey
        console.log('Attempting to retrieve M.cfg.sesskey...');
        console.log('M:', window.M);
        console.log('M.cfg:', window.M && window.M.cfg);
        var value = (window.M && window.M.cfg && window.M.cfg.sesskey) ? window.M.cfg.sesskey : null;
        window.dispatchEvent(new CustomEvent('variableValueRetrieved', { detail: value }));
    } catch (e) {
        window.dispatchEvent(new CustomEvent('variableValueRetrieved', { detail: null }));
    }
})();