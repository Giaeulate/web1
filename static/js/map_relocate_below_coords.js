// // Mueve el mapa del widget al <div id="coords-map-placeholder"> bajo Lat/Lon
// (function () {
//   function getMapWrapper() {
//     var mapEl = document.querySelector(".leaflet-container");
//     if (!mapEl) return null;
//     return mapEl.closest(".leaflet-point-map") || mapEl.parentElement;
//   }

//   function putMapInPlaceholder() {
//     var slot = document.getElementById("coords-map-placeholder");
//     var wrap = getMapWrapper();
//     if (!slot || !wrap) return false;

//     // Evita moverlo repetidamente
//     if (wrap.parentElement === slot) return true;

//     slot.appendChild(wrap);

//     // Ajusta tamaño del mapa tras moverlo
//     if (window.L) {
//       setTimeout(function () {
//         try {
//           // Busca cualquier instancia de Leaflet y recalcula tamaño
//           for (var k in window) {
//             var v = window[k];
//             if (v && v._leaflet_id && typeof v.invalidateSize === "function") {
//               v.invalidateSize();
//             }
//           }
//         } catch (e) {}
//       }, 50);
//     }
//     return true;
//   }

//   document.addEventListener("DOMContentLoaded", function () {
//     // Reintenta hasta que el widget haya creado el mapa
//     var tries = 0;
//     (function wait() {
//       if (putMapInPlaceholder()) return;
//       if (tries++ < 80) setTimeout(wait, 125);
//     })();

//     // Por si el widget inserta el mapa después (mutaciones)
//     var obs = new MutationObserver(function () { putMapInPlaceholder(); });
//     obs.observe(document.body, { childList: true, subtree: true });
//     setTimeout(function(){ obs.disconnect(); }, 6000);
//   });
// })();
