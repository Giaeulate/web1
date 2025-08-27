(function ($) {
  $(document).ready(function () {
    console.log("✅ translation_admin.js cargado");

    // Inicializa select2 en todos los <select> visibles
    function initSelect2() {
      $("select").each(function () {
        if (!$(this).hasClass("select2-hidden-accessible")) {
          $(this).select2({
            width: 'style',
            theme: 'default',  // o 'classic' si usás uno personalizado
            dropdownAutoWidth: true,
            allowClear: true,
          });
        }
      });
    }

    initSelect2();  // Inicial al cargar

    const modelField = $("#id_model");
    const fieldField = $("#id_field");
    const objectField = $("#id_object_id");

    modelField.on("change", function () {
      const model = $(this).val();
      if (!model) return;

      console.log("🔄 Modelo seleccionado:", model);

      $.get("/admin/get-fields/", { model }, function (data) {
        fieldField
          .empty()
          .append($("<option>").text("---------").attr("value", ""));

        data.fields.forEach(function (field) {
          fieldField.append(
            $("<option>").text(field).attr("value", field)
          );
        });

        fieldField.val(null).trigger("change");  // reset y refresca select2
      });

      objectField.empty().append($("<option>").text("---------").attr("value", ""));
    });

    fieldField.on("change", function () {
      const model = modelField.val();
      const field = $(this).val();
      if (!model || !field) return;

      console.log(`🔎 Cargando objetos para ${model}.${field}...`);

      $.get("/admin/get-objects/", { model, field }, function (data) {
        objectField
          .empty()
          .append($("<option>").text("---------").attr("value", ""));

        data.objects.forEach(function (obj) {
          objectField.append(
            $("<option>").text(obj[field]).attr("value", obj.id)
          );
        });

        objectField.val(null).trigger("change");  // reset y refresca select2
      });
    });

    // Si usás popups o recargas parciales, volver a inicializar
    $(document).on("formset:added", function () {
      initSelect2();
    });
  });
})(typeof django !== "undefined" ? django.jQuery : jQuery);
