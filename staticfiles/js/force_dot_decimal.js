// static/js/force_dot_decimal.js
(function(){
  function normalize(el){
    if(!el) return;
    var v = el.value || "";
    var n = v.replace(",", ".");
    if(n !== v) el.value = n;
    // Dispara eventos que el widget escucha
    el.dispatchEvent(new Event("input", {bubbles:true}));
    el.dispatchEvent(new Event("change", {bubbles:true}));
    el.dispatchEvent(new Event("blur", {bubbles:true}));
  }

  function hook(id){
    var el = document.getElementById(id);
    if(!el) return;
    ["keyup","change","blur","paste"].forEach(evt=>{
      el.addEventListener(evt, function(){ setTimeout(function(){ normalize(el); }, 0); });
    });
    // Normaliza una vez al cargar
    normalize(el);
  }

  document.addEventListener("DOMContentLoaded", function(){
    hook("id_latitude");
    hook("id_longitude");
  });
})();
