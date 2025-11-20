// static/js/ultra_simple_fix.js
(function() {
    'use strict';

    // Función ultra simple que se ejecuta inmediatamente
    function ultraSimpleFix() {
        console.log('=== ULTRA SIMPLE FIX ===');

        // Buscar TODOS los elementos que podrían ser contenedores
        var allElements = document.getElementsByTagName('*');
        var targetContainers = [];

        // Buscar por ID
        for (var i = 0; i < allElements.length; i++) {
            var element = allElements[i];
            if (element.id && (element.id.includes('geom') || element.id.includes('map')) && element.id !== 'id_geom') {
                targetContainers.push(element);
            }
        }

        // Buscar por clase
        for (var i = 0; i < allElements.length; i++) {
            var element = allElements[i];
            if (element.className && (element.className.includes('map') || element.className.includes('dj_map'))) {
                if (targetContainers.indexOf(element) === -1) {
                    targetContainers.push(element);
                }
            }
        }

        console.log('Found', targetContainers.length, 'potential containers');

        // Arreglar cada contenedor
        targetContainers.forEach(function(container, index) {
            console.log('Fixing container', index, ':', container.id || container.className);

            // Forzar CSS
            container.style.width = '100%';
            container.style.height = '400px';
            container.style.display = 'block';
            container.style.visibility = 'visible';
            container.style.position = 'relative';
            container.style.backgroundColor = '#f8f9fa';
            container.style.border = '1px solid #ddd';
            container.style.borderRadius = '8px';
            container.style.overflow = 'hidden';

            // Si Leaflet está disponible y el contenedor no tiene mapa, crear uno
            if (typeof L !== 'undefined' && !container._leaflet_id) {
                try {
                    var map = L.map(container, {
                        center: [-16, -68],
                        zoom: 15
                    });

                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '&copy; OpenStreetMap contributors'
                    }).addTo(map);

                    // Eventos básicos
                    map.on('click', function(e) {
                        var lat = document.getElementById('id_latitude');
                        var lng = document.getElementById('id_longitude');
                        if (lat && lng) {
                            lat.value = e.latlng.lat.toFixed(6);
                            lng.value = e.latlng.lng.toFixed(6);
                            lat.dispatchEvent(new Event('input'));
                            lng.dispatchEvent(new Event('input'));
                        }
                    });

                    console.log('Map created in container', index);
                } catch (e) {
                    console.log('Could not create map in container', index, ':', e.message);
                }
            }
        });

        console.log('Ultra simple fix completed');
    }

    // Ejecutar inmediatamente
    ultraSimpleFix();

    // Ejecutar de nuevo después de un momento
    setTimeout(ultraSimpleFix, 100);
    setTimeout(ultraSimpleFix, 500);
    setTimeout(ultraSimpleFix, 1000);

    console.log('Ultra simple fix loaded');
})();
