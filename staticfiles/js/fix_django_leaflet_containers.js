// static/js/fix_django_leaflet_containers.js
(function() {
    'use strict';

    function fixDjangoLeafletContainers() {
        console.log('=== FIXING DJANGO LEAFLET CONTAINERS ===');

        // Buscar los contenedores específicos que django-leaflet-point crea
        var containers = [
            document.getElementById('id_geom_map'),
            document.getElementById('id_geom_div_map'),
            document.querySelector('.dj_map'),
            document.querySelector('.dj_map_wrapper')
        ];

        var foundContainer = false;

        containers.forEach(function(container, index) {
            if (container) {
                console.log('Found container', index, ':', container.id || container.className);

                // Forzar las dimensiones del contenedor
                container.style.width = '100%';
                container.style.height = '400px';
                container.style.minHeight = '400px';
                container.style.display = 'block';
                container.style.visibility = 'visible';
                container.style.position = 'relative';
                container.style.backgroundColor = '#f8f9fa';
                container.style.border = '1px solid #ddd';
                container.style.borderRadius = '8px';
                container.style.overflow = 'hidden';

                // Verificar si el contenedor tiene un elemento hijo que sea el mapa
                var mapElement = container.querySelector('.leaflet-container, .leaflet-map');
                if (mapElement) {
                    console.log('Found map element inside container');
                    mapElement.style.width = '100%';
                    mapElement.style.height = '100%';
                }

                foundContainer = true;
                console.log('Fixed container dimensions:', container.offsetWidth + 'x' + container.offsetHeight);
            }
        });

        // Si no encontramos contenedores específicos, buscar cualquier contenedor que contenga "geom"
        if (!foundContainer) {
            console.log('No specific containers found, searching for geom containers...');
            var allElements = document.querySelectorAll('*');

            for (var i = 0; i < allElements.length; i++) {
                var element = allElements[i];
                if (element.id && element.id.includes('geom') && element.id !== 'id_geom') {
                    console.log('Found geom container:', element.id);

                    element.style.width = '100%';
                    element.style.height = '400px';
                    element.style.minHeight = '400px';
                    element.style.display = 'block';
                    element.style.visibility = 'visible';
                    element.style.position = 'relative';
                    element.style.backgroundColor = '#f8f9fa';

                    foundContainer = true;
                    break;
                }
            }
        }

        if (foundContainer) {
            console.log('Successfully fixed Django Leaflet containers');
        } else {
            console.log('No Django Leaflet containers found');
        }
    }

    // Ejecutar inmediatamente y en intervalos
    fixDjangoLeafletContainers();
    setTimeout(fixDjangoLeafletContainers, 100);
    setTimeout(fixDjangoLeafletContainers, 500);
    setTimeout(fixDjangoLeafletContainers, 1000);
    setTimeout(fixDjangoLeafletContainers, 2000);

    // Escuchar cambios en el DOM
    var observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                setTimeout(fixDjangoLeafletContainers, 100);
            }
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log('Django Leaflet container fixer loaded');
})();
