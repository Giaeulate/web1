(function () {
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function updateButtonState(btn) {
    const anySelected = document.querySelector('input.action-select:checked');
    if (anySelected) {
      btn.className = 'btn btn-success';
      btn.disabled = false;
    } else {
      btn.className = 'btn btn-secondary';
      btn.disabled = true;
    }
  }

  ready(function () {
    const form = document.getElementById('changelist-form');
    if (!form) return;

    const container =
      document.querySelector('.object-tools') ||
      document.querySelector('.actions') ||
      form;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Exportar seleccionados';
    btn.className = 'btn btn-success';

    container.insertBefore(btn, container.firstChild);

    updateButtonState(btn);

    document.addEventListener('change', function (e) {
      if (e.target && e.target.matches('input.action-select')) {
        updateButtonState(btn);
      }
    });

    btn.addEventListener('click', function () {
      if (btn.disabled) return;

      const checkboxes = Array.from(
        document.querySelectorAll('input.action-select:checked')
      );
      const ids = checkboxes.map((c) => c.value);

      if (!ids.length) {
        Swal.fire({
          icon: 'warning',
          title: 'Atención',
          text: 'Selecciona al menos un registro para exportar',
        });
        return;
      }

      // Mostrar alerta de "descargando" con auto-cierre en 5s
      Swal.fire({
        title: 'Generando archivo...',
        text: 'Por favor espera mientras se prepara la descarga',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
          setTimeout(() => {
            Swal.close();
          }, 5000);
        }
      });

      // Construir y enviar el formulario
      const post = document.createElement('form');
      post.method = 'POST';
      post.action = window.location.pathname.replace(/\/+$/, '') + '/export-selected/';

      // CSRF
      const csrf = document.querySelector('[name=csrfmiddlewaretoken]');
      if (csrf) {
        const i = document.createElement('input');
        i.type = 'hidden';
        i.name = 'csrfmiddlewaretoken';
        i.value = csrf.value;
        post.appendChild(i);
      }

      // IDs
      ids.forEach((id) => {
        const i = document.createElement('input');
        i.type = 'hidden';
        i.name = 'ids';
        i.value = id;
        post.appendChild(i);
      });

      document.body.appendChild(post);
      post.submit();
    });
  });
})();
