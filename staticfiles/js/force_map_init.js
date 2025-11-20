// static/js/force_map_init.js
(function() {
    'use strict';

    function forceMapInitialization() {
        // Buscar el campo geom
        var geomField = document.getElementById('id_geom');
        if (!geomField) {
            console.log('No geom field found');
            setTimeout(forceMapInitialization, 500);
            return;
        }

        // Buscar los contenedores que django-leaflet-point crea
        var mapContainers = [
            document.getElementById('id_geom_map'),
            document.getElementById('id_geom_div_map'),
            document.querySelector('.dj_map'),
            document.querySelector('.dj_map_wrapper')
        ];

        var container = null;
        for (var i = 0; i < mapContainers.length; i++) {
            if (mapContainers[i]) {
                container = mapContainers[i];
                break;
            }
        }

        if (!container) {
            console.log('No map container found, searching for any map container...');
            // Buscar cualquier contenedor que pueda ser del mapa
            var allContainers = document.querySelectorAll('[id*="geom"], [class*="map"]');
            for (var i = 0; i < allContainers.length; i++) {
                if (allContainers[i].id && allContainers[i].id !== 'id_geom') {
                    container = allContainers[i];
                    break;
                }
            }
        }

        if (!container) {
            console.log('No map container found');
            setTimeout(forceMapInitialization, 500);
            return;
        }

        console.log('Found map container:', container.id || container.className);

        // Forzar las dimensiones del contenedor
        container.style.width = '100%';
        container.style.height = '400px';
        container.style.display = 'block';
        container.style.visibility = 'visible';
        container.style.position = 'relative';
        container.style.backgroundColor = '#f8f9fa';

        // Si Leaflet está cargado, intentar crear el mapa
        if (typeof L !== 'undefined') {
            console.log('Leaflet is loaded, creating map');

            try {
                //Destruir mapa existente si hay uno
                if (window.leafletPointMaps && window.leafletPointMaps[container.id]) {
                    window.leafletPointMaps[container.id].remove();
                    delete window.leafletPointMaps[container.id];
                }

                // Crear nuevo mapa
                var map = L.map(container, {
                    center: [-16, -68],
                    zoom: 15,
                    scrollWheelZoom: true
                });

                // Agregar capa de tiles
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                }).addTo(map);

                // Agregar geocoder si está habilitado
                if (container.dataset && container.dataset.geocoder === 'true') {
                    L.Control.geocoder({
                        defaultMarkGeocode: false
                    }).on('markgeocode', function(e) {
                        map.setView(e.geocode.center, e.geocode.zoom || 15);
                    }).addTo(map);
                }

                // Almacenar referencia del mapa
                if (!window.leafletPointMaps) {
                    window.leafletPointMaps = {};
                }
                window.leafletPointMaps[container.id] = map;

                // Agregar manejador de clic
                map.on('click', function(e) {
                    var latInput = document.getElementById('id_latitude');
                    var lngInput = document.getElementById('id_longitude');

                    if (latInput && lngInput) {
                        latInput.value = e.latlng.lat.toFixed(6);
                        lngInput.value = e.latlng.lng.toFixed(6);

                        var changeEvent = new Event('change', { bubbles: true });
                        latInput.dispatchEvent(changeEvent);
                        lngInput.dispatchEvent(changeEvent);
                    }
                });

                // Agregar marcador si hay coordenadas existentes
                var latInput = document.getElementById('id_latitude');
                var lngInput = document.getElementById('id_longitude');

                if (latInput && lngInput && latInput.value && lngInput.value) {
                    var lat = parseFloat(latInput.value);
                    var lng = parseFloat(lngInput.value);

                    if (!isNaN(lat) && !isNaN(lng)) {
                        var marker = L.marker([lat, lng]).addTo(map);
                        map.setView([lat, lng], 15);
                        map.marker = marker;
                    }
                }

                console.log('Map created successfully');
            } catch (error) {
                console.error('Error creating map:', error);
            }
        } else {
            console.log('Leaflet not loaded yet, retrying...');
            setTimeout(forceMapInitialization, 500);
        }
    }

    // Ejecutar inmediatamente y en varios intervalos
    forceMapInitialization();
    setTimeout(forceMapInitialization, 100);
    setTimeout(forceMapInitialization, 500);
    setTimeout(forceMapInitialization, 1000);
    setTimeout(forceMapInitialization, 2000);

    // Escuchar cuando el widget esté listo
    document.addEventListener('leaflet-point-ready', forceMapInitialization);
})();
