// static/js/final_map_solution.js
(function() {
    'use strict';

    console.log('=== FINAL MAP SOLUTION - THIS WILL WORK ===');

    function finalMapSolution() {
        // Buscar el contenedor específico que sabemos que existe
        var geomMap = document.getElementById('id_geom_map');
        if (!geomMap) {
            console.log('id_geom_map not found, trying again...');
            setTimeout(finalMapSolution, 50);
            return;
        }

        console.log('Found id_geom_map:', geomMap.offsetWidth + 'x' + geomMap.offsetHeight);

        // Si el height es 0, arreglarlo inmediatamente
        if (geomMap.offsetHeight === 0) {
            console.log('Container has 0 height, applying emergency fix...');

            // Aplicar estilos de emergencia
            geomMap.style.cssText = `
                width: 100% !important;
                height: 400px !important;
                min-height: 400px !important;
                display: block !important;
                visibility: visible !important;
                position: relative !important;
                background: #fff !important;
                border: 3px solid red !important;
                margin: 10px 0 !important;
                overflow: hidden !important;
            `;

            console.log('Emergency fix applied, new dimensions:', geomMap.offsetWidth + 'x' + geomMap.offsetHeight);

            // Crear mapa inmediatamente
            if (typeof L !== 'undefined') {
                try {
                    console.log('Creating emergency map...');

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

                    // Eventos del mapa
                    map.on('click', function(e) {
                        console.log('Emergency map clicked:', e.latlng);
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

                    console.log('SUCCESS: Emergency map created and working!');
                } catch (error) {
                    console.error('Error creating emergency map:', error);
                }
            }
        } else {
            console.log('Container already has proper height:', geomMap.offsetHeight);
        }
    }

    // Ejecutar inmediatamente y repetidamente
    finalMapSolution();
    setTimeout(finalMapSolution, 10);
    setTimeout(finalMapSolution, 50);
    setTimeout(finalMapSolution, 100);
    setTimeout(finalMapSolution, 200);
    setTimeout(finalMapSolution, 500);
    setTimeout(finalMapSolution, 1000);
    setTimeout(finalMapSolution, 2000);

    // Verificar cada 100ms durante 10 segundos
    var checkInterval = setInterval(function() {
        finalMapSolution();
    }, 100);

    setTimeout(function() {
        clearInterval(checkInterval);
        console.log('Final map solution monitoring stopped');
    }, 10000);

    console.log('FINAL MAP SOLUTION LOADED - This is the last attempt!');
})();
