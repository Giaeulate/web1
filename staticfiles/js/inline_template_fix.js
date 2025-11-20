// static/js/inline_template_fix.js
(function() {
    'use strict';

    console.log('=== INLINE TEMPLATE FIX ===');

    // Esta función se ejecuta directamente en el template
    function inlineTemplateFix() {
        var geomMap = document.getElementById('id_geom_map');
        if (!geomMap) {
            console.log('id_geom_map not found in template, searching...');

            // Buscar cualquier contenedor que pueda ser del mapa
            var allElements = document.querySelectorAll('*');
            for (var i = 0; i < allElements.length; i++) {
                var element = allElements[i];
                if (element.id && element.id.includes('geom') && element.id !== 'id_geom') {
                    geomMap = element;
                    console.log('Found alternative container:', element.id);
                    break;
                }
            }

            if (!geomMap) {
                setTimeout(inlineTemplateFix, 100);
                return;
            }
        }

        console.log('Template container found:', geomMap.id || geomMap.className);

        // Aplicar estilos de emergencia
        var emergencyStyle = `
            width: 100% !important;
            height: 400px !important;
            min-height: 400px !important;
            display: block !important;
            visibility: visible !important;
            position: relative !important;
            background: #f0f0f0 !important;
            border: 3px solid blue !important;
            margin: 10px 0 !important;
            overflow: hidden !important;
            z-index: 9999 !important;
        `;

        geomMap.style.cssText = emergencyStyle;
        geomMap.setAttribute('style', emergencyStyle);

        console.log('Template emergency styles applied');

        // Si Leaflet está disponible, crear mapa
        if (typeof L !== 'undefined') {
            try {
                console.log('Creating template emergency map...');

                var map = L.map(geomMap, {
                    center: [-16, -68],
                    zoom: 15,
                    scrollWheelZoom: true
                });

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                }).addTo(map);

                L.Control.geocoder({
                    defaultMarkGeocode: false
                }).on('markgeocode', function(e) {
                    map.setView(e.geocode.center, e.geocode.zoom || 15);
                }).addTo(map);

                // Eventos
                map.on('click', function(e) {
                    console.log('Template map clicked:', e.latlng);
                    var lat = document.getElementById('id_latitude');
                    var lng = document.getElementById('id_longitude');
                    if (lat && lng) {
                        lat.value = e.latlng.lat.toFixed(6);
                        lng.value = e.latlng.lng.toFixed(6);
                        lat.dispatchEvent(new Event('input'));
                        lng.dispatchEvent(new Event('input'));
                    }
                });

                // Agregar marcador existente
                var lat = document.getElementById('id_latitude');
                var lng = document.getElementById('id_longitude');
                if (lat && lng && lat.value && lng.value) {
                    var latVal = parseFloat(lat.value);
                    var lngVal = parseFloat(lng.value);
                    if (!isNaN(latVal) && !isNaN(lngVal)) {
                        L.marker([latVal, lngVal]).addTo(map);
                        map.setView([latVal, lngVal], 15);
                    }
                }

                console.log('SUCCESS: Template emergency map created');
            } catch (error) {
                console.error('Error in template fix:', error);
            }
        }
    }

    // Ejecutar múltiples veces
    inlineTemplateFix();
    setTimeout(inlineTemplateFix, 25);
    setTimeout(inlineTemplateFix, 75);
    setTimeout(inlineTemplateFix, 150);
    setTimeout(inlineTemplateFix, 300);
    setTimeout(inlineTemplateFix, 600);
    setTimeout(inlineTemplateFix, 1200);
    setTimeout(inlineTemplateFix, 2400);

    console.log('INLINE TEMPLATE FIX LOADED');
})();
