// document.addEventListener('leaflet_point_widget_init', function(e) {
//     const widget = e.detail;
//     const map = widget.map;
//     // elimina el geocodificador por defecto
//     if (widget.geocoderControl) {
//         widget.geocoderControl.remove();
//     }
//     // crea un geocodificador Nominatim con parámetros para Bolivia y La Paz
//     const geocoder = L.Control.Geocoder.nominatim({
//         geocodingQueryParams: {
//             countrycodes: 'bo',                      // solo Bolivia:contentReference[oaicite:2]{index=2}
//             viewbox: '-69.644827,-18.053321,-66.732113,-11.857086', // caja de La Paz:contentReference[oaicite:3]{index=3}
//             bounded: 1
//         }
//     });
//     widget.geocoderControl = L.Control.geocoder({
//         geocoder: geocoder,
//         defaultMarkGeocode: true
//     }).addTo(map);
// });


// static/js/venue_geocoder.js
(function(){
  const params = new URLSearchParams(window.location.search);
  const lat = params.get("lat") || params.get("latitude");
  const lon = params.get("lon") || params.get("lng") || params.get("longitude");
  const name = params.get("name");
  const address = params.get("address");

  function setVal(id, v){
    const el = document.getElementById(id);
    if (el && v !== null && v !== undefined && v !== "") {
      el.value = String(v);
      el.dispatchEvent(new Event("input", {bubbles:true}));
      el.dispatchEvent(new Event("change", {bubbles:true}));
    }
  }

  if (lat && lon) {
    // Normaliza comas
    const nlat = String(lat).replace(",", ".");
    const nlon = String(lon).replace(",", ".");
    setVal("id_latitude", nlat);
    setVal("id_longitude", nlon);
  }
  if (name) setVal("id_name", name);
  if (address) setVal("id_address", address);

  // Nota: el widget de django-leaflet-point suele escuchar cambios en inputs
  // y actualizar el mapa; por eso disparamos input/change.
})();
