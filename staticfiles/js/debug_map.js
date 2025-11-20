// static/js/debug_map.js
(function() {
    'use strict';

    function debugMapContainer() {
        console.log('=== DEBUG MAP CONTAINER ===');

        // Buscar contenedores de mapas
        var containers = document.querySelectorAll('.leaflet-point-map, #id_geom-map, [id*="geom"]');
        console.log('Found containers:', containers.length);

        containers.forEach(function(container, index) {
            var rect = container.getBoundingClientRect();
            var styles = window.getComputedStyle(container);

            console.log('Container', index + ':', {
                id: container.id,
                className: container.className,
                dimensions: rect.width + 'x' + rect.height,
                computedWidth: styles.width,
                computedHeight: styles.height,
                visibility: styles.visibility,
                display: styles.display,
                position: styles.position,
                parent: container.parentElement ? container.parentElement.tagName : 'none'
            });

            // Verificar si está dentro de un fieldset o tab
            var fieldset = container.closest('fieldset');
            if (fieldset) {
                console.log('Inside fieldset:', fieldset.className);
            }

            var tabContent = container.closest('.tab-content, .inline-group');
            if (tabContent) {
                console.log('Inside tab content:', tabContent.className);
            }
        });

        // Buscar inputs de latitud y longitud
        var latInput = document.getElementById('id_latitude');
        var lngInput = document.getElementById('id_longitude');

        console.log('Lat input:', latInput ? 'found' : 'not found');
        console.log('Lng input:', lngInput ? 'found' : 'not found');

        if (latInput && lngInput) {
            console.log('Lat value:', latInput.value);
            console.log('Lng value:', lngInput.value);
        }

        // Verificar si Leaflet está cargado
        console.log('Leaflet loaded:', typeof L !== 'undefined');
        console.log('jQuery loaded:', typeof $ !== 'undefined');

        console.log('=== END DEBUG ===');
    }

    // Ejecutar debug inmediatamente y después de delays
    debugMapContainer();
    setTimeout(debugMapContainer, 100);
    setTimeout(debugMapContainer, 500);
    setTimeout(debugMapContainer, 1000);
    setTimeout(debugMapContainer, 2000);

    // Escuchar eventos del DOM
    document.addEventListener('DOMContentLoaded', debugMapContainer);
    document.addEventListener('leaflet-point-ready', debugMapContainer);
})();
