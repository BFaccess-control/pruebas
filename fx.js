/**
 * fx.js — Módulo de Utilidades y Procesamiento de Datos
 * ─────────────────────────────────────────────────────
 * Responsabilidades:
 *   • Formateo y validación de RUT chileno
 *   • Formateo y normalización de patentes vehiculares
 *   • Formateo de fechas y cálculo de permanencia
 *   • Generación de IDs únicos
 *   • Gestión de Toasts (notificaciones UI)
 *   • Gestión de Modales de confirmación
 */

// ══════════════════════════════════════════════
// SECCIÓN 1 — RUT CHILENO
// ══════════════════════════════════════════════

/**
 * Aplica la máscara xxxxxxxx-x a un string de RUT.
 * Acepta entrada con o sin guión y con o sin puntos.
 * @param {string} raw - Valor crudo del campo de texto
 * @returns {string} RUT formateado o string vacío
 */
function fxFormatRUT(raw) {
  // Limpiar: solo dígitos y letra K
  let clean = raw.replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length < 2) return clean;

  // Separar cuerpo y dígito verificador
  const dv   = clean.slice(-1);
  const body = clean.slice(0, -1);

  return `${body}-${dv}`;
}

/**
 * Valida el dígito verificador de un RUT chileno.
 * @param {string} rut - RUT con formato xxxxxxxx-x
 * @returns {boolean}
 */
function fxValidateRUT(rut) {
  if (!rut || typeof rut !== 'string') return false;
  const clean = rut.replace(/\./g, '').replace('-', '');
  if (clean.length < 2) return false;

  const body = clean.slice(0, -1);
  const dvInput = clean.slice(-1).toUpperCase();

  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const dvCalc = 11 - (sum % 11);
  const dvExpected = dvCalc === 11 ? '0' : dvCalc === 10 ? 'K' : String(dvCalc);

  return dvInput === dvExpected;
}

/**
 * Listener para aplicar máscara de RUT en tiempo real sobre un <input>.
 * @param {HTMLInputElement} input
 */
function fxBindRUTInput(input) {
  input.addEventListener('input', () => {
    const pos   = input.selectionStart;
    const prev  = input.value;
    const formatted = fxFormatRUT(prev);
    input.value = formatted;
    // Reposicionar cursor aproximadamente
    const diff = formatted.length - prev.length;
    input.setSelectionRange(pos + diff, pos + diff);
  });
}

// ══════════════════════════════════════════════
// SECCIÓN 2 — PATENTES VEHICULARES
// ══════════════════════════════════════════════

/**
 * Normaliza una patente a mayúsculas y sin espacios.
 * @param {string} raw
 * @returns {string}
 */
function fxFormatPatente(raw) {
  return raw.replace(/\s/g, '').toUpperCase();
}

/**
 * Listener para auto-uppercase de patentes en tiempo real.
 * @param {HTMLInputElement} input
 */
function fxBindPatenteInput(input) {
  input.addEventListener('input', () => {
    const start = input.selectionStart;
    input.value = fxFormatPatente(input.value);
    input.setSelectionRange(start, start);
  });
}

// ══════════════════════════════════════════════
// SECCIÓN 3 — FECHAS Y TIEMPOS
// ══════════════════════════════════════════════

/**
 * Retorna la fecha actual en formato DD-MM-YYYY.
 * @returns {string}
 */
function fxDateNow() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return `${dd}-${mm}-${yy}`;
}

/**
 * Formatea un objeto Date o timestamp Firestore en DD-MM-YYYY.
 * @param {Date|object} ts - Fecha o timestamp de Firestore
 * @returns {string}
 */
function fxFormatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return `${dd}-${mm}-${yy}`;
}

/**
 * Formatea un timestamp a HH:MM:SS.
 * @param {Date|object} ts
 * @returns {string}
 */
function fxFormatTime(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mi}:${ss}`;
}

/**
 * Formatea un timestamp a HH:MM.
 * @param {Date|object} ts
 * @returns {string}
 */
function fxFormatTimeShort(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mi}`;
}

/**
 * Calcula la permanencia entre dos timestamps.
 * Soporta estancias superiores a 24 horas.
 * @param {Date|object} inicio - Timestamp de ingreso
 * @param {Date|object|null} fin - Timestamp de salida (null = ahora)
 * @returns {string} "Xd Xh Xm" o "Xh Xm"
 */
function fxCalcPermanencia(inicio, fin = null) {
  if (!inicio) return '—';
  const dInicio = inicio.toDate ? inicio.toDate() : new Date(inicio);
  const dFin    = fin ? (fin.toDate ? fin.toDate() : new Date(fin)) : new Date();

  const diffMs  = dFin - dInicio;
  if (diffMs < 0) return '—';

  const totalMin = Math.floor(diffMs / 60000);
  const dias     = Math.floor(totalMin / 1440);
  const horas    = Math.floor((totalMin % 1440) / 60);
  const minutos  = totalMin % 60;

  if (dias > 0) return `${dias}d ${horas}h ${minutos}m`;
  if (horas > 0) return `${horas}h ${minutos}m`;
  return `${minutos}m`;
}

/**
 * Convierte una cadena DD-MM-YYYY a objeto Date.
 * @param {string} str
 * @returns {Date}
 */
function fxParseDate(str) {
  if (!str) return null;
  const [dd, mm, yy] = str.split('-');
  return new Date(parseInt(yy), parseInt(mm) - 1, parseInt(dd));
}

/**
 * Convierte un string tipo "YYYY-MM-DD" (input[type=date]) a Date.
 * @param {string} str
 * @returns {Date}
 */
function fxParseDateInput(str) {
  if (!str) return null;
  const [yy, mm, dd] = str.split('-');
  return new Date(parseInt(yy), parseInt(mm) - 1, parseInt(dd));
}

// ══════════════════════════════════════════════
// SECCIÓN 4 — GENERADOR DE IDs
// ══════════════════════════════════════════════

/**
 * Genera un ID alfanumérico único de longitud dada.
 * @param {number} len - Longitud del ID (default 12)
 * @returns {string}
 */
function fxUID(len = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < len; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ══════════════════════════════════════════════
// SECCIÓN 5 — VALIDACIÓN DE FORMULARIOS
// ══════════════════════════════════════════════

/**
 * Verifica que todos los campos requeridos tengan valor.
 * Bloquea submit si existen campos nulos.
 * @param {Array<string>} ids - Array de IDs de inputs
 * @returns {{ valid: boolean, emptyIds: string[] }}
 */
function fxValidateFields(ids) {
  const emptyIds = [];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const val = el.value ? el.value.trim() : '';
    if (!val) {
      emptyIds.push(id);
      el.classList.add('field-error');
      // Limpiar clase de error al escribir
      el.addEventListener('input', () => el.classList.remove('field-error'), { once: true });
    }
  });
  return { valid: emptyIds.length === 0, emptyIds };
}

// ══════════════════════════════════════════════
// SECCIÓN 6 — TOASTS (notificaciones flotantes)
// ══════════════════════════════════════════════

/**
 * Muestra un toast de notificación.
 * @param {string} msg    - Mensaje a mostrar
 * @param {'success'|'error'|'info'} type
 * @param {number} duration - ms antes de desaparecer (default 3500)
 */
function fxToast(msg, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${msg}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hide');
    toast.addEventListener('animationend', () => toast.remove());
  }, duration);
}

// ══════════════════════════════════════════════
// SECCIÓN 7 — MODAL DE CONFIRMACIÓN
// ══════════════════════════════════════════════

/**
 * Gestiona el modal de confirmación genérico.
 * @param {object} opts
 * @param {string} opts.html        - HTML del cuerpo del modal
 * @param {Function} opts.onConfirm - Callback al confirmar
 * @param {Function} [opts.onCancel] - Callback al cancelar
 */
function fxModal({ html, onConfirm, onCancel }) {
  const overlay  = document.getElementById('modal-overlay');
  const body     = document.getElementById('modal-body');
  const btnConf  = document.getElementById('modal-confirm');
  const btnCancel = document.getElementById('modal-cancel');

  if (!overlay) return;

  body.innerHTML = html;
  overlay.classList.remove('hidden');

  // Clonar botones para eliminar listeners anteriores
  const newConf   = btnConf.cloneNode(true);
  const newCancel = btnCancel.cloneNode(true);
  btnConf.replaceWith(newConf);
  btnCancel.replaceWith(newCancel);

  function close() { overlay.classList.add('hidden'); }

  document.getElementById('modal-confirm').addEventListener('click', () => {
    close();
    if (typeof onConfirm === 'function') onConfirm();
  });

  document.getElementById('modal-cancel').addEventListener('click', () => {
    close();
    if (typeof onCancel === 'function') onCancel();
  });

  // Cerrar al hacer click fuera
  overlay.addEventListener('click', e => {
    if (e.target === overlay) close();
  }, { once: true });
}

// ══════════════════════════════════════════════
// SECCIÓN 8 — AUTOCOMPLETADO POR RUT
// ══════════════════════════════════════════════

/**
 * Inicializa el sistema de autocompletado inteligente sobre un campo RUT.
 * Consulta registros históricos de Firestore y sugiere datos al tipear.
 *
 * @param {object} opts
 * @param {string}            opts.inputId      - ID del <input> de RUT
 * @param {string}            opts.suggestId    - ID del <ul> de sugerencias
 * @param {object}            opts.db           - Instancia de Firebase Firestore
 * @param {string}            opts.collection   - Nombre de colección a consultar
 * @param {Function}          opts.onSelect     - Callback(docData) al seleccionar sugerencia
 */
function fxInitRUTAutocomplete({ inputId, suggestId, db, collection, onSelect }) {
  const input = document.getElementById(inputId);
  const list  = document.getElementById(suggestId);

  if (!input || !list) return;

  fxBindRUTInput(input);

  let debounceTimer = null;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const val = input.value.replace(/[^0-9kK]/g, '');

    if (val.length < 3) {
      list.classList.add('hidden');
      list.innerHTML = '';
      return;
    }

    // Debounce de 300ms para no disparar en cada tecla
    debounceTimer = setTimeout(async () => {
      try {
        // Buscar en Firestore por RUT que comience con los dígitos ingresados
        const snap = await db.collection(collection)
          .where('rut', '>=', val)
          .where('rut', '<=', val + '\uf8ff')
          .limit(6)
          .get();

        list.innerHTML = '';

        if (snap.empty) {
          list.classList.add('hidden');
          return;
        }

        snap.forEach(doc => {
          const d  = doc.data();
          const li = document.createElement('li');
          li.innerHTML = `
            <div>${d.nombre || '—'}</div>
            <div class="ac-rut">${d.rut || ''} · ${d.empresa || ''}</div>
          `;
          li.addEventListener('mousedown', e => {
            e.preventDefault();
            input.value = fxFormatRUT(d.rut || '');
            list.classList.add('hidden');
            if (typeof onSelect === 'function') onSelect(d);
          });
          list.appendChild(li);
        });

        list.classList.remove('hidden');
      } catch (err) {
        console.warn('[fx] Autocomplete error:', err);
      }
    }, 300);
  });

  // Ocultar al perder foco
  input.addEventListener('blur', () => {
    setTimeout(() => list.classList.add('hidden'), 200);
  });
}

// ══════════════════════════════════════════════
// SECCIÓN 9 — POBLACIÓN DE COMBOBOX DE GUARDIAS
// ══════════════════════════════════════════════

/**
 * Carga la colección `lista_guardias` de Firestore
 * y puebla un <select> con los datos.
 * @param {object} db     - Instancia Firestore
 * @param {string} selectId - ID del <select>
 */
async function fxLoadGuardias(db, selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;

  try {
    const snap = await db.collection('lista_guardias').orderBy('nombre').get();
    sel.innerHTML = '<option value="">— Seleccione guardia —</option>';
    snap.forEach(doc => {
      const d = doc.data();
      const opt = document.createElement('option');
      opt.value = d.nombre;
      opt.textContent = d.nombre;
      sel.appendChild(opt);
    });
  } catch (err) {
    console.warn('[fx] No se pudo cargar lista de guardias:', err);
    sel.innerHTML = '<option value="">Sin guardias registrados</option>';
  }
}

// Exponer globalmente para uso entre módulos
window.FX = {
  formatRUT:         fxFormatRUT,
  validateRUT:       fxValidateRUT,
  bindRUTInput:      fxBindRUTInput,
  formatPatente:     fxFormatPatente,
  bindPatenteInput:  fxBindPatenteInput,
  dateNow:           fxDateNow,
  formatDate:        fxFormatDate,
  formatTime:        fxFormatTime,
  formatTimeShort:   fxFormatTimeShort,
  calcPermanencia:   fxCalcPermanencia,
  parseDate:         fxParseDate,
  parseDateInput:    fxParseDateInput,
  uid:               fxUID,
  validateFields:    fxValidateFields,
  toast:             fxToast,
  modal:             fxModal,
  initRUTAutocomplete: fxInitRUTAutocomplete,
  loadGuardias:      fxLoadGuardias,
};
