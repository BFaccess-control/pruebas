/**
 * vst.js — Módulo de Visitas
 * ──────────────────────────
 * Responsabilidades:
 *   • Registro de visitantes con timestamp automático
 *   • Toggle condicional para vehículo (campo patente visible/oculto)
 *   • Campo "A quién visita" obligatorio
 *   • Autocompletado por RUT desde colección Registros (historial de visitas)
 *   • Visualización en tiempo real de visitas del día
 *
 * Colecciones Firestore:
 *   - Ingresos   (tipo: 'visita')
 *   - Registros  (historial de visitantes para autocompletado)
 */

// ──────────────────────────────────────────────
// Variables de estado del módulo
// ──────────────────────────────────────────────
let _vstDb       = null;
let _vstRol      = null;
let _vstListener = null;

/**
 * Inicializa el módulo de Visitas.
 * @param {object} db
 * @param {string} rol
 */
function vstInit(db, rol) {
  _vstDb  = db;
  _vstRol = rol;

  // Cargar combobox de guardias
  FX.loadGuardias(db, 'vst-guardia');

  // Binding de formateos
  FX.bindRUTInput(document.getElementById('vst-rut'));
  FX.bindPatenteInput(document.getElementById('vst-patente'));

  // Autocompletado inteligente por RUT (busca en historial de visitas)
  FX.initRUTAutocomplete({
    inputId:    'vst-rut',
    suggestId:  'vst-rut-suggestions',
    db,
    collection: 'Registros',
    onSelect:   vstAutoFill,
  });

  // Toggle de vehículo: muestra/oculta campo de patente
  vstBindVehiculoToggle();

  // Botón de registro
  const btnReg = document.getElementById('btn-vst-registrar');
  if (btnReg) {
    const newBtn = btnReg.cloneNode(true);
    btnReg.replaceWith(newBtn);
    document.getElementById('btn-vst-registrar')
      .addEventListener('click', vstRegistrarVisita);
  }

  // Iniciar listener de visitas del día
  vstStartListener();
}

/**
 * Limpia listeners del módulo.
 */
function vstDestroy() {
  if (_vstListener) { _vstListener(); _vstListener = null; }
}

// ──────────────────────────────────────────────
// TOGGLE CONDICIONAL DE VEHÍCULO
// ──────────────────────────────────────────────

/**
 * Vincula el checkbox de "Ingresa con vehículo" para
 * mostrar/ocultar el campo de patente condicionalmente.
 */
function vstBindVehiculoToggle() {
  const toggle = document.getElementById('vst-tiene-vehiculo');
  const fields = document.getElementById('vst-vehiculo-fields');
  if (!toggle || !fields) return;

  toggle.addEventListener('change', () => {
    if (toggle.checked) {
      fields.classList.remove('hidden');
      // Animar entrada
      fields.style.animation = 'fadeUp .2s ease';
    } else {
      fields.classList.add('hidden');
      // Limpiar patente al ocultar
      const pat = document.getElementById('vst-patente');
      if (pat) pat.value = '';
    }
  });
}

// ──────────────────────────────────────────────
// AUTOCOMPLETADO
// ──────────────────────────────────────────────

/**
 * Rellena campos con datos del visitante seleccionado del historial.
 * @param {object} data - Documento de Registros
 */
function vstAutoFill(data) {
  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el && v) el.value = v;
  };
  setVal('vst-nombre',  data.nombre);
  setVal('vst-empresa', data.empresa);
  // Destino habitual (si tiene)
  if (data.destino) setVal('vst-destino', data.destino);
}

// ──────────────────────────────────────────────
// REGISTRO DE VISITA
// ──────────────────────────────────────────────

/**
 * Valida y registra una nueva visita en Firestore.
 */
async function vstRegistrarVisita() {
  const errorDiv = document.getElementById('vst-error');
  errorDiv.classList.add('hidden');

  const tieneVehiculo = document.getElementById('vst-tiene-vehiculo').checked;

  // ── 1. Campos siempre obligatorios ──
  const camposBase = ['vst-guardia', 'vst-rut', 'vst-nombre', 'vst-empresa', 'vst-destino'];

  // ── 2. Agregar patente si el toggle de vehículo está activo ──
  const camposExtra = tieneVehiculo ? ['vst-patente'] : [];
  const { valid } = FX.validateFields([...camposBase, ...camposExtra]);

  if (!valid) {
    errorDiv.textContent = '⚠️ Complete todos los campos obligatorios.';
    errorDiv.classList.remove('hidden');
    return;
  }

  const guardia = document.getElementById('vst-guardia').value.trim();
  const rut     = document.getElementById('vst-rut').value.trim();
  const nombre  = document.getElementById('vst-nombre').value.trim();
  const empresa = document.getElementById('vst-empresa').value.trim();
  const destino = document.getElementById('vst-destino').value.trim();
  const patente = tieneVehiculo
    ? FX.formatPatente(document.getElementById('vst-patente').value.trim())
    : null;

  // ── 3. Construir documento ──
  const doc = {
    tipo:        'visita',
    guardia,
    rut,
    nombre,
    empresa,
    destino,
    tieneVehiculo,
    patente:     patente || null,
    ingreso:     firebase.firestore.FieldValue.serverTimestamp(),
    fecha:       FX.dateNow(),
  };

  try {
    // ── 4. Guardar en colección Ingresos ──
    await _vstDb.collection('Ingresos').add(doc);

    // ── 5. Actualizar historial de Registros (para autocompletado futuro) ──
    await _vstDb.collection('Registros').doc(rut).set(
      { rut, nombre, empresa, destino, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );

    vstClearForm();
    FX.toast('Visita registrada correctamente', 'success');

  } catch (err) {
    console.error('[vst] Error al registrar visita:', err);
    FX.toast('Error al guardar el registro.', 'error');
  }
}

// ──────────────────────────────────────────────
// LISTENER EN TIEMPO REAL — Visitas del día
// ──────────────────────────────────────────────

/**
 * Suscribe a los ingresos tipo 'visita' del día actual.
 */
function vstStartListener() {
  if (_vstListener) _vstListener();

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  _vstListener = _vstDb.collection('Ingresos')
    .where('tipo', '==', 'visita')
    .where('ingreso', '>=', hoy)
    .orderBy('ingreso', 'desc')
    .onSnapshot(snap => {
      vstRenderTabla(snap.docs);
    }, err => {
      console.error('[vst] Error en listener:', err);
    });
}

/**
 * Renderiza la tabla de visitas del día.
 * @param {Array} docs
 */
function vstRenderTabla(docs) {
  const tbody = document.getElementById('vst-tbody');
  const badge = document.getElementById('vst-count');
  if (!tbody) return;

  badge.textContent = docs.length;
  tbody.innerHTML = '';

  if (docs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-msg">Sin visitas hoy.</td></tr>`;
    return;
  }

  docs.forEach((doc, idx) => {
    const d  = doc.data();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="num-cell">${docs.length - idx}</td>
      <td class="time-cell">${FX.formatTimeShort(d.ingreso)}</td>
      <td>${d.rut || '—'}</td>
      <td>${d.nombre || '—'}</td>
      <td>${d.empresa || '—'}</td>
      <td>${d.destino || '—'}</td>
      <td>${d.patente || (d.tieneVehiculo ? '—' : 'Sin vehículo')}</td>
      <td>${d.guardia || '—'}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ──────────────────────────────────────────────
// LIMPIEZA DE FORMULARIO
// ──────────────────────────────────────────────

function vstClearForm() {
  ['vst-rut', 'vst-nombre', 'vst-empresa', 'vst-destino', 'vst-patente'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  // Resetear toggle de vehículo
  const toggle = document.getElementById('vst-tiene-vehiculo');
  if (toggle) toggle.checked = false;
  document.getElementById('vst-vehiculo-fields').classList.add('hidden');
  document.getElementById('vst-guardia').selectedIndex = 0;
  document.getElementById('vst-error').classList.add('hidden');
}

// ──────────────────────────────────────────────
// EXPORTACIÓN GLOBAL
// ──────────────────────────────────────────────

window.VST = {
  init:    vstInit,
  destroy: vstDestroy,
};
