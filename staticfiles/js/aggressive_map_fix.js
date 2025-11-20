// static/js/aggressive_map_fix.js
(function() {
    'use strict';

    function aggressiveMapFix() {
        console.log('=== AGGRESSIVE MAP FIX ===');

        // Buscar TODOS los elementos que podrían ser contenedores de mapa
        var possibleContainers = [];

        // 1. Buscar por ID específico
        possibleContainers.push(document.getElementById('id_geom_map'));
        possibleContainers.push(document.getElementById('id_geom_div_map'));

        // 2. Buscar por clase
        possibleContainers.push(document.querySelector('.dj_map'));
        possibleContainers.push(document.querySelector('.dj_map_wrapper'));
        possibleContainers.push(document.querySelector('.leaflet-container'));
        possibleContainers.push(document.querySelector('.simple-map-widget'));

        // 3. Buscar elementos con IDs que contengan "geom" o "map"
        var allElements = document.querySelectorAll('*');
        for (var i = 0; i < allElements.length; i++) {
            var element = allElements[i];
            if (element.id && (element.id.includes('geom') || element.id.includes('map')) && element.id !== 'id_geom') {
                possibleContainers.push(element);
            }
        }

        // 4. Buscar elementos con clases que contengan "map"
        var elementsWithMapClass = document.querySelectorAll('[class*="map"]');
        for (var i = 0; i < elementsWithMapClass.length; i++) {
            possibleContainers.push(elementsWithMapClass[i]);
        }

        console.log('Found', possibleContainers.length, 'possible map containers');

        // Filtrar contenedores válidos (no null/undefined)
        var validContainers = possibleContainers.filter(function(container) {
            return container !== null && container !== undefined;
        });

        console.log('Valid containers:', validContainers.length);

        validContainers.forEach(function(container, index) {
            console.log('Fixing container', index, ':', container.id || container.className);

            // Forzar dimensiones CSS
            var styles = container.style;
            styles.width = '100%';
            styles.height = '400px';
            styles.minHeight = '400px';
            styles.display = 'block';
            styles.visibility = 'visible';
            styles.position = 'relative';
            styles.backgroundColor = '#f8f9fa';
            styles.border = '1px solid #ddd';
            styles.borderRadius = '8px';
            styles.overflow = 'hidden';

            // Forzar atributos
            container.setAttribute('style', styles.cssText + '; width: 100% !important; height: 400px !important;');

            console.log('Container fixed, dimensions:', container.offsetWidth + 'x' + container.offsetHeight);

            // Si es un contenedor que debería tener un mapa, intentar crear uno
            if (container.id && (container.id.includes('geom') || container.className.includes('map'))) {
                if (typeof L !== 'undefined' && !container._leaflet_id) {
                    console.log('Attempting to create map in container');

                    try {
                        var map = L.map(container, {
                            center: [-16, -68],
                            zoom: 15,
                            scrollWheelZoom: true
                        });

                        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        }).addTo(map);

                        // Almacenar referencia
                        if (!window.leafletPointMaps) {
                            window.leafletPointMaps = {};
                        }
                        window.leafletPointMaps[container.id || 'map_' + index] = map;

                        console.log('Map created successfully in container');
                    } catch (error) {
                        console.error('Error creating map:', error);
                    }
                }
            }
        });

        console.log('Aggressive map fix completed');
    }

    // Ejecutar múltiples veces
    aggressiveMapFix();
    setTimeout(aggressiveMapFix, 50);
    setTimeout(aggressiveMapFix, 200);
    setTimeout(aggressiveMapFix, 500);
    setTimeout(aggressiveMapFix, 1000);
    setTimeout(aggressiveMapFix, 2000);
    setTimeout(aggressiveMapFix, 5000);

    // Observar cambios en el DOM
    var observer = new MutationObserver(function(mutations) {
        var shouldFix = false;
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                shouldFix = true;
            }
        });

        if (shouldFix) {
            setTimeout(aggressiveMapFix, 100);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log('Aggressive map fix loaded');
})();
