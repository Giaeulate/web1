// static/js/ultimate_map_fix.js
(function() {
    'use strict';

    console.log('=== ÚLTIMA SOLUCIÓN DEFINITIVA - SOLO UN MAPA ===');

    // Variable global para evitar múltiples mapas
    window.ultimateMapCreated = false;

    function createUltimateMap() {
        // Si ya creamos un mapa, no hacer nada
        if (window.ultimateMapCreated) {
            console.log('Mapa ya creado, saliendo...');
            return;
        }

        console.log('Buscando contenedor id_geom_map...');

        // Buscar específicamente el contenedor id_geom_map
        var geomMap = document.getElementById('id_geom_map');

        if (!geomMap) {
            console.log('id_geom_map no encontrado, buscando alternativas...');

            // Buscar contenedores que contengan 'geom' en el ID
            var allElements = document.querySelectorAll('*');
            for (var i = 0; i < allElements.length; i++) {
                var element = allElements[i];
                if (element.id && element.id.includes('geom') && element.id !== 'id_geom') {
                    geomMap = element;
                    console.log('Encontrado contenedor alternativo:', element.id);
                    break;
                }
            }
        }

        if (!geomMap) {
            console.log('No se encontró contenedor, reintentando en 100ms...');
            setTimeout(createUltimateMap, 100);
            return;
        }

        console.log('Contenedor encontrado:', geomMap.id || 'sin ID');
        console.log('Dimensiones actuales:', geomMap.offsetWidth + 'x' + geomMap.offsetHeight);

        // Si el height es 0 o muy pequeño, aplicar fix
        if (geomMap.offsetHeight === 0 || geomMap.offsetHeight < 100) {
            console.log('Aplicando FIX DEFINITIVO al contenedor...');

            // Aplicar estilos con máxima prioridad
            var fixStyle = `
                width: 100% !important;
                height: 400px !important;
                min-height: 400px !important;
                display: block !important;
                visibility: visible !important;
                position: relative !important;
                background: #fff !important;
                border: 5px solid red !important;
                margin: 10px 0 !important;
                overflow: hidden !important;
                z-index: 9999 !important;
            `;

            geomMap.style.cssText = fixStyle;
            geomMap.setAttribute('style', fixStyle);

            // Agregar CSS adicional al head
            var style = document.createElement('style');
            style.textContent = `
                #${geomMap.id || 'id_geom_map'} {
                    width: 100% !important;
                    height: 400px !important;
                    min-height: 400px !important;
                    display: block !important;
                    visibility: visible !important;
                    position: relative !important;
                    background: #fff !important;
                    border: 5px solid red !important;
                    margin: 10px 0 !important;
                    overflow: hidden !important;
                    z-index: 9999 !important;
                }
            `;
            document.head.appendChild(style);

            console.log('FIX aplicado, nuevas dimensiones:', geomMap.offsetWidth + 'x' + geomMap.offsetHeight);
        }

        // Verificar si Leaflet está disponible
        if (typeof L === 'undefined') {
            console.log('Leaflet no disponible, reintentando en 200ms...');
            setTimeout(createUltimateMap, 200);
            return;
        }

        // Verificar si el contenedor tiene dimensiones válidas
        if (geomMap.offsetWidth === 0 || geomMap.offsetHeight === 0) {
            console.log('Contenedor sin dimensiones válidas, reintentando en 200ms...');
            setTimeout(createUltimateMap, 200);
            return;
        }

        try {
            console.log('Creando mapa definitivo...');

            // Destruir cualquier mapa existente en este contenedor
            if (geomMap._leaflet_id) {
                console.log('Destruyendo mapa existente...');
                // No podemos destruir directamente, pero podemos crear uno nuevo
            }

            // Crear mapa con configuración específica
            var map = L.map(geomMap, {
                center: [-16, -68],
                zoom: 15,
                scrollWheelZoom: true,
                zoomControl: true,
                attributionControl: true
            });

            // Agregar capa de tiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 18,
                minZoom: 3
            }).addTo(map);

            // Agregar geocoder
            L.Control.geocoder({
                defaultMarkGeocode: false,
                position: 'topleft'
            }).on('markgeocode', function(e) {
                console.log('Geocodificado a:', e.geocode.center);
                map.setView(e.geocode.center, e.geocode.zoom || 15);
            }).addTo(map);

            // Eventos del mapa
            map.on('click', function(e) {
                console.log('Mapa clickeado:', e.latlng);
                var lat = document.getElementById('id_latitude');
                var lng = document.getElementById('id_longitude');
                if (lat && lng) {
                    lat.value = e.latlng.lat.toFixed(6);
                    lng.value = e.latlng.lng.toFixed(6);
                    lat.dispatchEvent(new Event('input', { bubbles: true }));
                    lng.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });

            // Agregar marcador si hay coordenadas existentes
            var lat = document.getElementById('id_latitude');
            var lng = document.getElementById('id_longitude');
            if (lat && lng && lat.value && lng.value) {
                var latVal = parseFloat(lat.value);
                var lngVal = parseFloat(lng.value);
                if (!isNaN(latVal) && !isNaN(lngVal)) {
                    console.log('Agregando marcador en coordenadas existentes:', latVal, lngVal);
                    var marker = L.marker([latVal, lngVal]).addTo(map);
                    map.setView([latVal, lngVal], 15);
                    window.currentMarker = marker;
                }
            }

            // Marcar como creado
            window.ultimateMapCreated = true;
            window.ultimateMap = map;

            console.log('✅ ÉXITO: MAPA DEFINITIVO CREADO Y FUNCIONANDO');
            console.log('Mapa:', map);
            console.log('Contenedor:', geomMap.id, 'dimensiones:', geomMap.offsetWidth + 'x' + geomMap.offsetHeight);

        } catch (error) {
            console.error('Error creando mapa:', error);
            console.error('Stack:', error.stack);
        }
    }

    // Función para sincronizar inputs con el mapa
    function syncInputsToMap() {
        if (!window.ultimateMap || !window.ultimateMapCreated) {
            return;
        }

        var lat = document.getElementById('id_latitude');
        var lng = document.getElementById('id_longitude');

        if (!lat || !lng) {
            return;
        }

        var latVal = parseFloat(lat.value);
        var lngVal = parseFloat(lng.value);

        if (isNaN(latVal) || isNaN(lngVal)) {
            return;
        }

        console.log('Sincronizando inputs al mapa:', latVal, lngVal);

        // Remover marcador anterior
        if (window.currentMarker) {
            window.ultimateMap.removeLayer(window.currentMarker);
        }

        // Crear nuevo marcador
        window.currentMarker = L.marker([latVal, lngVal]).addTo(window.ultimateMap);
        window.ultimateMap.setView([latVal, lngVal], Math.max(window.ultimateMap.getZoom(), 15));
    }

    // Ejecutar inmediatamente
    createUltimateMap();

    // Reintentar varias veces
    setTimeout(createUltimateMap, 50);
    setTimeout(createUltimateMap, 100);
    setTimeout(createUltimateMap, 200);
    setTimeout(createUltimateMap, 500);
    setTimeout(createUltimateMap, 1000);

    // Monitorear cambios en los inputs
    document.addEventListener('input', function(e) {
        if (e.target.id === 'id_latitude' || e.target.id === 'id_longitude') {
            setTimeout(syncInputsToMap, 100);
        }
    });

    document.addEventListener('change', function(e) {
        if (e.target.id === 'id_latitude' || e.target.id === 'id_longitude') {
            setTimeout(syncInputsToMap, 100);
        }
    });

    console.log('=== ÚLTIMA SOLUCIÓN CARGADA - SOLO CREARÁ UN MAPA ===');
})();
