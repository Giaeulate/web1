document.addEventListener("DOMContentLoaded", function () {
    const mapWrapper = document.querySelector("#id_geom-map");
    if (!mapWrapper) return;

    const expandBtn = document.createElement("div");
    expandBtn.innerText = "Expandir";
    expandBtn.className = "leaflet-expand-btn";

    expandBtn.onclick = function () {
        const body = document.body;
        const isFullscreen = mapWrapper.classList.toggle("leaflet-fullscreen");

        if (isFullscreen) {
            body.classList.add("leaflet-map-expanded");
            expandBtn.innerText = "Contraer";
        } else {
            body.classList.remove("leaflet-map-expanded");
            expandBtn.innerText = "Expandir";
        }

        // Forzar redibujado de todos los mapas cargados por Leaflet
        setTimeout(() => {
            for (let key in window) {
                const maybeMap = window[key];
                if (maybeMap && typeof maybeMap.invalidateSize === "function" && maybeMap instanceof L.Map) {
                    maybeMap.invalidateSize(true);
                }
            }
        }, 300);  // puede ajustarse a 200~400ms según el lag del render
    };

    mapWrapper.appendChild(expandBtn);
});
