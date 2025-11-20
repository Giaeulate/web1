// Hook que guarda la instancia de Leaflet en el contenedor del mapa
(function hookLeaflet(){
  if (!window.L || !L.Map || !L.Map.addInitHook) { setTimeout(hookLeaflet, 50); return; }
  L.Map.addInitHook(function(){
    var c = this.getContainer();
    c.__djlpMap = this;                 // ← ahora el contenedor conoce su mapa
    window.__DJLP_ACTIVE_MAP__ = this;  // fallback global
  });
})();
