// static/js/simple_map_widget.js
(function() {
    'use strict';

    function createSimpleMapWidget() {
        console.log('=== CREATING SIMPLE MAP WIDGET ===');

        // Buscar el campo geom
        var geomField = document.getElementById('id_geom');
        if (!geomField) {
            console.log('No geom field found');
            setTimeout(createSimpleMapWidget, 500);
            return;
        }

        // Crear contenedor del mapa si no existe
        var container = document.createElement('div');
        container.id = 'simple-map-container';
        container.className = 'simple-map-widget';
        container.style.cssText = `
            width: 100%;
            height: 400px;
            border: 1px solid #ddd;
            border-radius: 8px;
            margin: 10px 0;
        `;

        // Insertar el contenedor antes del campo geom
        geomField.parentNode.insertBefore(container, geomField);

        // Si Leaflet está cargado, crear el mapa
        if (typeof L !== 'undefined') {
            console.log('Creating map with Leaflet');

            try {
                var map = L.map(container, {
                    center: [-16, -68],
                    zoom: 15,
                    scrollWheelZoom: true
                });

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                }).addTo(map);

                // Agregar geocoder
                L.Control.geocoder({
                    defaultMarkGeocode: false
                }).on('markgeocode', function(e) {
                    map.setView(e.geocode.center, e.geocode.zoom || 15);
                }).addTo(map);

                // Manejar clics
                map.on('click', function(e) {
                    var latInput = document.getElementById('id_latitude');
                    var lngInput = document.getElementById('id_longitude');

                    if (latInput && lngInput) {
                        latInput.value = e.latlng.lat.toFixed(6);
                        lngInput.value = e.latlng.lng.toFixed(6);

                        var changeEvent = new Event('input', { bubbles: true });
                        latInput.dispatchEvent(changeEvent);
                        lngInput.dispatchEvent(changeEvent);
                    }
                });

                // Agregar marcador si hay coordenadas
                var latInput = document.getElementById('id_latitude');
                var lngInput = document.getElementById('id_longitude');

                if (latInput && lngInput && latInput.value && lngInput.value) {
                    var lat = parseFloat(latInput.value);
                    var lng = parseFloat(lngInput.value);

                    if (!isNaN(lat) && !isNaN(lng)) {
                        L.marker([lat, lng]).addTo(map);
                        map.setView([lat, lng], 15);
                    }
                }

                console.log('Simple map widget created successfully');
            } catch (error) {
                console.error('Error creating simple map:', error);
            }
        } else {
            console.log('Leaflet not loaded, retrying...');
            setTimeout(createSimpleMapWidget, 500);
        }
    }

    // Inicializar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createSimpleMapWidget);
    } else {
        createSimpleMapWidget();
    }

    setTimeout(createSimpleMapWidget, 100);
    setTimeout(createSimpleMapWidget, 500);
    setTimeout(createSimpleMapWidget, 1000);
})();
