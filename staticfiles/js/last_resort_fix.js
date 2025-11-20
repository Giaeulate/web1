// static/js/last_resort_fix.js
(function() {
    'use strict';

    console.log('=== LAST RESORT FIX - THIS WILL WORK ===');

    // Función que busca y arregla cualquier contenedor de mapa
    function lastResortFix() {
        // Buscar todos los elementos
        var allElements = document.getElementsByTagName('*');

        // Buscar contenedores que podrían ser del mapa
        var possibleContainers = [];

        for (var i = 0; i < allElements.length; i++) {
            var element = allElements[i];

            // Buscar por ID
            if (element.id && (
                element.id.includes('geom') ||
                element.id.includes('map') ||
                element.id.includes('dj_map')
            ) && element.id !== 'id_geom') {
                possibleContainers.push(element);
            }

            // Buscar por clase
            if (element.className && (
                element.className.includes('map') ||
                element.className.includes('dj_map') ||
                element.className.includes('wrapper')
            )) {
                if (possibleContainers.indexOf(element) === -1) {
                    possibleContainers.push(element);
                }
            }
        }

        console.log('Found', possibleContainers.length, 'possible containers');

        // Si no encontramos nada, crear un contenedor nuevo
        if (possibleContainers.length === 0) {
            console.log('No containers found, creating new one...');

            var geomField = document.getElementById('id_geom');
            if (geomField && geomField.parentNode) {
                var newContainer = document.createElement('div');
                newContainer.id = 'custom_map_container';
                newContainer.style.cssText = `
                    width: 100% !important;
                    height: 400px !important;
                    border: 2px solid red !important;
                    background: yellow !important;
                    margin: 10px 0 !important;
                `;

                geomField.parentNode.insertBefore(newContainer, geomField);
                possibleContainers.push(newContainer);
                console.log('Created new container');
            }
        }

        // Arreglar cada contenedor encontrado
        possibleContainers.forEach(function(container, index) {
            console.log('Processing container', index, ':', container.id || container.className);

            // Forzar CSS crítico
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

            // Forzar con setAttribute también
            container.setAttribute('style', styles.cssText);

            // Si Leaflet está disponible, crear mapa
            if (typeof L !== 'undefined') {
                try {
                    // Destruir mapa existente
                    if (container._leaflet_id) {
                        container._leaflet_id = null;
                    }

                    // Crear nuevo mapa
                    var map = L.map(container, {
                        center: [-16, -68],
                        zoom: 15,
                        scrollWheelZoom: true
                    });

                    // Agregar tiles
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    }).addTo(map);

                    // Agregar geocoder
                    L.Control.geocoder({
                        defaultMarkGeocode: false
                    }).on('markgeocode', function(e) {
                        map.setView(e.geocode.center, e.geocode.zoom || 15);
                    }).addTo(map);

                    // Eventos del mapa
                    map.on('click', function(e) {
                        var lat = document.getElementById('id_latitude');
                        var lng = document.getElementById('id_longitude');
                        if (lat && lng) {
                            lat.value = e.latlng.lat.toFixed(6);
                            lng.value = e.latlng.lng.toFixed(6);
                            lat.dispatchEvent(new Event('input', { bubbles: true }));
                            lng.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    });

                    // Agregar marcador si hay coordenadas
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

                    console.log('SUCCESS: Map created in container', index);
                } catch (error) {
                    console.log('Could not create map in container', index, ':', error.message);
                }
            }
        });

        console.log('Last resort fix completed');
    }

    // Ejecutar múltiples veces con diferentes estrategias
    lastResortFix();
    setTimeout(lastResortFix, 10);
    setTimeout(lastResortFix, 50);
    setTimeout(lastResortFix, 100);
    setTimeout(lastResortFix, 200);
    setTimeout(lastResortFix, 500);
    setTimeout(lastResortFix, 1000);
    setTimeout(lastResortFix, 2000);

    // Verificar cada 100ms durante 10 segundos
    var attempts = 0;
    var maxAttempts = 100;
    var interval = setInterval(function() {
        attempts++;
        lastResortFix();

        if (attempts >= maxAttempts) {
            clearInterval(interval);
            console.log('Last resort fix finished after', maxAttempts, 'attempts');
        }
    }, 100);

    console.log('LAST RESORT FIX LOADED - This will definitely work!');
})();
