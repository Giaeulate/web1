// static/leaflet_point/leaflet_point.js
// Widget para django-leaflet-point
(function() {
    'use strict';

    // Store map references globally for other scripts
    if (!window.leafletPointMaps) {
        window.leafletPointMaps = {};
    }

    // Initialize leaflet point widgets
    function initLeafletPointWidgets() {
        // Use native DOM methods instead of jQuery
        var containers = document.querySelectorAll('.leaflet-point-map');

        console.log('Found', containers.length, 'leaflet-point-map containers');

        for (var i = 0; i < containers.length; i++) {
            var container = containers[i];
            var mapId = container.id;

            console.log('Initializing map for container:', mapId);

            if (!mapId || window.leafletPointMaps[mapId]) {
                console.log('Map already exists or no ID:', mapId);
                continue;
            }

            // Ensure container has dimensions
            var rect = container.getBoundingClientRect();
            console.log('Container dimensions:', rect.width, 'x', rect.height);

            if (rect.width === 0 || rect.height === 0) {
                console.log('Container has no dimensions, skipping');
                continue;
            }

            // Get configuration from data attributes
            var config = {
                center: [-16, -68],
                zoom: 15,
                scrollWheelZoom: true
            };

            // Override with data attributes if present
            if (container.dataset.center) {
                try {
                    var centerData = JSON.parse(container.dataset.center);
                    if (centerData) config.center = centerData;
                } catch(e) {
                    console.log('Error parsing center data:', e);
                }
            }
            if (container.dataset.zoom) {
                config.zoom = parseInt(container.dataset.zoom);
            }

            console.log('Map config:', config);

            try {
                // Create map
                var map = L.map(mapId, config);
                console.log('Map created successfully');

                // Add tile layer
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                }).addTo(map);
                console.log('Tile layer added');

                // Add geocoder if enabled
                if (container.dataset.geocoder === 'true') {
                    console.log('Adding geocoder');
                    L.Control.geocoder({
                        defaultMarkGeocode: false
                    }).on('markgeocode', function(e) {
                        console.log('Geocode result:', e.geocode);
                        map.setView(e.geocode.center, e.geocode.zoom || 15);
                    }).addTo(map);
                }

                // Store map reference
                window.leafletPointMaps[mapId] = map;

                // Add click handler for point selection
                map.on('click', function(e) {
                    console.log('Map clicked:', e.latlng);
                    var latInput = document.getElementById('id_latitude');
                    var lngInput = document.getElementById('id_longitude');

                    if (latInput && lngInput) {
                        latInput.value = e.latlng.lat.toFixed(6);
                        lngInput.value = e.latlng.lng.toFixed(6);

                        // Trigger change event to update map
                        var changeEvent = new Event('change', { bubbles: true });
                        latInput.dispatchEvent(changeEvent);
                        lngInput.dispatchEvent(changeEvent);
                    }
                });

                // Add marker if coordinates exist
                var latInput = document.getElementById('id_latitude');
                var lngInput = document.getElementById('id_longitude');

                if (latInput && lngInput && latInput.value && lngInput.value) {
                    var lat = parseFloat(latInput.value);
                    var lng = parseFloat(lngInput.value);

                    console.log('Existing coordinates:', lat, lng);

                    if (!isNaN(lat) && !isNaN(lng)) {
                        var marker = L.marker([lat, lng]).addTo(map);
                        map.setView([lat, lng], 15);

                        // Store marker reference for other scripts
                        map.marker = marker;
                    }
                }

                // Fire ready event for other scripts
                var readyEvent = new CustomEvent('leaflet-point-ready', {
                    detail: { map: map, container: container }
                });
                document.dispatchEvent(readyEvent);

                console.log('Leaflet point widget initialized successfully:', mapId);
            } catch (error) {
                console.error('Error initializing map:', error);
            }
        }
    }

    // Initialize when DOM is ready
    function ready() {
        console.log('DOM ready, initializing leaflet widgets');
        initLeafletPointWidgets();

        // Re-initialize after AJAX requests (for admin inlines, etc.)
        document.addEventListener('ajaxComplete', function() {
            console.log('AJAX complete, re-initializing');
            setTimeout(initLeafletPointWidgets, 100);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ready);
    } else {
        ready();
    }

    // Also try to initialize after a short delay
    setTimeout(ready, 100);
    setTimeout(ready, 500);
    setTimeout(ready, 1000);
})();
