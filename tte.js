/**
 * tte.js — Módulo de Transporte de Pasajeros
 * ───────────────────────────────────────────
 * Responsabilidades:
 *   • Registro de ingreso de conductores/buses con timestamp automático
 *   • Autocompletado inteligente por RUT desde colección Conductores
 *   • Visualización de registros del día en tabla
 *   • Persistencia en colección `Ingresos` con tipo 'transporte'
 *
 * Colecciones Firestore:
 *   - Ingresos    (tipo: 'transporte')
 *   - Conductores (historial para autocompletado)
 */

// ──────────────────────────────────────────────
// Variables de estado del módulo
// ──────────────────────────────────────────────
let _tteDb       = null;  // Instancia Firestore
let _tteRol      = null;  // Rol del usuario actual
let _tteListener = null;  // Unsubscribe del listener en tiempo real

/**
 * Inicializa el módulo de Transporte.
 * @param {object} db  - Instancia de Firestore
 * @param {string} rol - Rol del usuario actual
 */
function tteInit(db, rol) {
  _tteDb  = db;
  _tteRol = rol;

  // Cargar combobox de guardias
  FX.loadGuardias(db, 'tte-guardia');

  // Binding de formateos automáticos
  FX.bindRUTInput(document.getElementById('tte-rut'));
  FX.bindPatenteInput(document.getElementById('tte-patente'));

  // Autocompletado inteligente por RUT
  FX.initRUTAutocomplete({
    inputId:    'tte-rut',
    suggestId:  'tte-rut-suggestions',
    db,
    collection: 'Conductores',
    onSelect:   tteAutoFill,
  });

  // Binding del botón de registro
  const btnReg = document.getElementById('btn-tte-registrar');
  if (btnReg) {
    const newBtn = btnReg.cloneNode(true);
    btnReg.replaceWith(newBtn);
    document.getElementById('btn-tte-registrar')
      .addEventListener('click', tteRegistrarIngreso);
  }

  // Iniciar listener de registros de hoy
  tteStartListener();
}

/**
 * Limpia listeners del módulo.
 */
function tteDestroy() {
  if (_tteListener) { _tteListener(); _tteListener = null; }
}

// ──────────────────────────────────────────────
// AUTOCOMPLETADO
// ──────────────────────────────────────────────

/**
 * Rellena campos automáticamente al seleccionar un conductor del historial.
 * @param {object} data - Documento de Conductores
 */
function tteAutoFill(data) {
  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el && v) el.value = v;
  };
  setVal('tte-nombre',  data.nombre);
  setVal('tte-empresa', data.empresa);
  if (data.patente) setVal('tte-patente', data.patente);
}

// ──────────────────────────────────────────────
// REGISTRO DE INGRESO
// ──────────────────────────────────────────────

/**
 * Valida el formulario y registra un nuevo ingreso de transporte.
 */
async function tteRegistrarIngreso() {
  const errorDiv = document.getElementById('tte-error');
  errorDiv.classList.add('hidden');

  // ── 1. Validar campos obligatorios ──
  const { valid } = FX.validateFields([
    'tte-guardia', 'tte-rut', 'tte-nombre', 'tte-empresa', 'tte-patente'
  ]);
  if (!valid) {
    errorDiv.textContent = '⚠️ Complete todos los campos obligatorios.';
    errorDiv.classList.remove('hidden');
    return;
  }

  const guardia = document.getElementById('tte-guardia').value.trim();
  const rut     = document.getElementById('tte-rut').value.trim();
  const nombre  = document.getElementById('tte-nombre').value.trim();
  const empresa = document.getElementById('tte-empresa').value.trim();
  const patente = FX.formatPatente(document.getElementById('tte-patente').value.trim());

  // ── 2. Construir documento ──
  const doc = {
    tipo:    'transporte',
    guardia,
    rut,
    nombre,
    empresa,
    patente,
    ingreso: firebase.firestore.FieldValue.serverTimestamp(),
    fecha:   FX.dateNow(), // DD-MM-YYYY para filtrado por día
  };

  try {
    // ── 3. Guardar ingreso ──
    await _tteDb.collection('Ingresos').add(doc);

    // ── 4. Actualizar historial de conductores (para autocompletado) ──
    await _tteDb.collection('Conductores').doc(rut).set(
      { rut, nombre, empresa, patente, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );

    tteClearForm();
    FX.toast('Ingreso de transporte registrado', 'success');

  } catch (err) {
    console.error('[tte] Error al registrar:', err);
    FX.toast('Error al guardar el registro.', 'error');
  }
}

// ──────────────────────────────────────────────
// LISTENER EN TIEMPO REAL — Registros de hoy
// ──────────────────────────────────────────────

/**
 * Escucha en tiempo real los ingresos de transporte del día actual.
 */
function tteStartListener() {
  if (_tteListener) _tteListener();

  // Calcular inicio del día actual (00:00:00)
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  _tteListener = _tteDb.collection('Ingresos')
    .where('tipo', '==', 'transporte')
    .where('ingreso', '>=', hoy)
    .orderBy('ingreso', 'desc')
    .onSnapshot(snap => {
      tteRenderTabla(snap.docs);
    }, err => {
      console.error('[tte] Error en listener:', err);
    });
}

/**
 * Renderiza la tabla de registros de transporte del día.
 * @param {Array} docs
 */
function tteRenderTabla(docs) {
  const tbody = document.getElementById('tte-tbody');
  const badge = document.getElementById('tte-count');
  if (!tbody) return;

  badge.textContent = docs.length;
  tbody.innerHTML = '';

  if (docs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-msg">Sin registros hoy.</td></tr>`;
    return;
  }

  // Número correlativo: los más recientes primero (ya vienen ordenados desc)
  docs.forEach((doc, idx) => {
    const d  = doc.data();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="num-cell">${docs.length - idx}</td>
      <td class="time-cell">${FX.formatTimeShort(d.ingreso)}</td>
      <td>${d.rut || '—'}</td>
      <td>${d.nombre || '—'}</td>
      <td>${d.empresa || '—'}</td>
      <td><strong>${d.patente || '—'}</strong></td>
      <td>${d.guardia || '—'}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ──────────────────────────────────────────────
// LIMPIEZA DE FORMULARIO
// ──────────────────────────────────────────────

function tteClearForm() {
  ['tte-rut', 'tte-nombre', 'tte-empresa', 'tte-patente'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const sel = document.getElementById('tte-guardia');
  if (sel) sel.selectedIndex = 0;
  document.getElementById('tte-error').classList.add('hidden');
}

// ──────────────────────────────────────────────
// EXPORTACIÓN GLOBAL
// ──────────────────────────────────────────────

window.TTE = {
  init:    tteInit,
  destroy: tteDestroy,
};
