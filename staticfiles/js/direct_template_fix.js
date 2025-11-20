// static/js/direct_template_fix.js
(function() {
    'use strict';

    console.log('=== FIX DIRECTO EN TEMPLATE ===');

    // Esta función se ejecuta directamente en el template HTML
    function directTemplateFix() {
        // Buscar el contenedor específico del mapa
        var mapContainers = document.querySelectorAll('[id*="geom"], .leaflet-point-map');

        console.log('Encontrados', mapContainers.length, 'contenedores potenciales');

        for (var i = 0; i < mapContainers.length; i++) {
            var container = mapContainers[i];
            console.log('Contenedor', i + 1, ':', container.id || container.className, 'dimensiones:', container.offsetWidth + 'x' + container.offsetHeight);

            // Si tiene height 0, aplicar fix
            if (container.offsetHeight === 0 || container.offsetHeight < 50) {
                console.log('Aplicando fix directo al contenedor:', container.id || container.className);

                // Aplicar estilos forzados
                var directStyle = `
                    width: 100% !important;
                    height: 400px !important;
                    min-height: 400px !important;
                    display: block !important;
                    visibility: visible !important;
                    position: relative !important;
                    background: #f9f9f9 !important;
                    border: 3px solid blue !important;
                    margin: 5px 0 !important;
                    overflow: hidden !important;
                    z-index: 10000 !important;
                `;

                container.style.cssText = directStyle;
                container.setAttribute('style', directStyle);

                // Si es el contenedor principal, crear mapa
                if (container.id && (container.id.includes('geom') || container.id.includes('map'))) {
                    if (typeof L !== 'undefined') {
                        try {
                            console.log('Creando mapa directo en contenedor:', container.id);

                            var map = L.map(container, {
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
                                console.log('Mapa directo clickeado:', e.latlng);
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

                            console.log('✅ Mapa directo creado exitosamente');
                            return; // Solo crear un mapa

                        } catch (error) {
                            console.error('Error creando mapa directo:', error);
                        }
                    }
                }
            }
        }
    }

    // Ejecutar múltiples veces
    directTemplateFix();
    setTimeout(directTemplateFix, 25);
    setTimeout(directTemplateFix, 75);
    setTimeout(directTemplateFix, 150);
    setTimeout(directTemplateFix, 300);

    console.log('=== FIX DIRECTO EN TEMPLATE CARGADO ===');
})();
