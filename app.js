/**
 * app.js — Orquestador Principal de la Aplicación
 * ─────────────────────────────────────────────────
 * Responsabilidades:
 *   • Punto de entrada de la SPA (inicialización)
 *   • Gestión de vistas (login ↔ main) y transición entre módulos
 *   • Navegación de sidebar con activación de módulos
 *   • Reloj en tiempo real (fecha + hora)
 *   • Motor de Exportación Excel (XLSX) con filtros por fecha y tipo
 *   • Módulo de administración (gestión de guardias)
 *   • Control de visibilidad basado en roles (RBAC)
 */

// ══════════════════════════════════════════════
// SECCIÓN 1 — ESTADO GLOBAL DE LA APP
// ══════════════════════════════════════════════

const APP = {
  db:           null,    // Instancia Firestore
  user:         null,    // Objeto Firebase Auth User
  rol:          null,    // 'admin' | 'jefatura' | 'usuario'
  moduloActual: null,    // Nombre del módulo activo
  clockTimer:   null,    // Timer del reloj
};

// ══════════════════════════════════════════════
// SECCIÓN 2 — PUNTO DE ENTRADA
// ══════════════════════════════════════════════

/**
 * Función principal. Se ejecuta al cargar el DOM.
 * Inicializa Firebase y registra el observer de sesión.
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('[app] Inicializando Control de Ingreso...');

  try {
    // ── 1. Inicializar Firebase ──
    const { db, auth } = LG.initFirebase();
    APP.db = db;

    // ── 2. Inicializar formulario de login ──
    LG.initLoginForm();

    // ── 3. Observer de estado de autenticación ──
    LG.onAuthChange(
      ({ user, rol }) => appOnLogin(user, rol),
      ()              => appOnLogout()
    );

  } catch (err) {
    console.error('[app] Error crítico al inicializar:', err);
    FX.toast('Error al conectar con el servidor.', 'error', 8000);
  }
});

// ══════════════════════════════════════════════
// SECCIÓN 3 — EVENTOS DE SESIÓN
// ══════════════════════════════════════════════

/**
 * Ejecutado al autenticarse exitosamente.
 * Configura la UI principal según el rol del usuario.
 *
 * @param {object} user - Firebase Auth User
 * @param {string} rol  - Rol resuelto
 */
function appOnLogin(user, rol) {
  APP.user = user;
  APP.rol  = rol;
  console.log(`[app] Sesión iniciada: ${user.email} (${rol})`);

  // ── Transición de pantalla ──
  document.getElementById('screen-login').classList.add('hidden');
  document.getElementById('screen-login').classList.remove('active');
  document.getElementById('screen-main').classList.remove('hidden');
  document.getElementById('screen-main').classList.add('active');

  // ── Actualizar info de usuario en sidebar ──
  const nameEl   = document.getElementById('user-name');
  const roleEl   = document.getElementById('user-role');
  const avatarEl = document.getElementById('user-avatar');

  if (nameEl)   nameEl.textContent   = user.displayName || user.email.split('@')[0];
  if (roleEl)   roleEl.textContent   = appRolLabel(rol);
  if (avatarEl) avatarEl.textContent = (user.displayName || user.email)[0].toUpperCase();

  // ── Mostrar/ocultar elementos según rol ──
  appApplyRBAC(rol);

  // ── Inicializar navegación del sidebar ──
  appInitNav();

  // ── Inicializar reloj ──
  appStartClock();

  // ── Iniciar módulo por defecto: Transporte ──
  appSwitchModule('tte');

  // ── Binding botón logout ──
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.onclick = async () => {
      appDestroyCurrentModule();
      await LG.logout();
    };
  }

  // ── Sidebar toggle ──
  appInitSidebarToggle();
}

/**
 * Ejecutado al cerrar sesión. Vuelve a la pantalla de login.
 */
function appOnLogout() {
  APP.user = null;
  APP.rol  = null;
  APP.moduloActual = null;

  // Detener reloj
  if (APP.clockTimer) clearInterval(APP.clockTimer);

  // Transición de pantalla
  document.getElementById('screen-main').classList.add('hidden');
  document.getElementById('screen-main').classList.remove('active');
  document.getElementById('screen-login').classList.remove('hidden');
  document.getElementById('screen-login').classList.add('active');

  console.log('[app] Sesión cerrada. Pantalla de login restaurada.');
}

// ══════════════════════════════════════════════
// SECCIÓN 4 — RBAC (Control de acceso por rol)
// ══════════════════════════════════════════════

/**
 * Aplica visibilidad de elementos según el rol del usuario.
 * @param {string} rol
 */
function appApplyRBAC(rol) {
  const isAdmin    = rol === LG.ROLES.ADMIN;
  const isJef      = rol === LG.ROLES.JEFATURA;
  const canExport  = isAdmin || isJef;

  // Mostrar botón/módulo de administración solo a admin
  document.querySelectorAll('.admin-only').forEach(el => {
    el.classList.toggle('hidden', !isAdmin);
  });

  // Módulo de reportes: admin y jefatura
  const navReport = document.querySelector('[data-module="report"]');
  if (navReport) navReport.classList.toggle('hidden', !canExport);
}

/**
 * Traduce código de rol a texto legible para la UI.
 * @param {string} rol
 * @returns {string}
 */
function appRolLabel(rol) {
  const labels = {
    admin:    'Administrador',
    jefatura: 'Jefatura',
    usuario:  'Guardia',
  };
  return labels[rol] || 'Usuario';
}

// ══════════════════════════════════════════════
// SECCIÓN 5 — NAVEGACIÓN DE MÓDULOS
// ══════════════════════════════════════════════

/**
 * Inicializa los botones de navegación del sidebar.
 */
function appInitNav() {
  document.querySelectorAll('.nav-item[data-module]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mod = btn.getAttribute('data-module');
      appSwitchModule(mod);
    });
  });
}

/**
 * Cambia el módulo activo:
 *  1. Destruye el módulo actual
 *  2. Oculta la sección anterior
 *  3. Muestra la nueva sección
 *  4. Inicializa el nuevo módulo
 *
 * @param {string} modName - 'tte' | 'vst' | 'abs' | 'report' | 'admin'
 */
function appSwitchModule(modName) {
  if (APP.moduloActual === modName) return;

  // ── Destruir módulo anterior ──
  appDestroyCurrentModule();

  // ── Actualizar navegación visual ──
  document.querySelectorAll('.nav-item[data-module]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-module') === modName);
  });

  // ── Ocultar todas las secciones ──
  document.querySelectorAll('.module-section').forEach(s => s.classList.add('hidden'));

  // ── Mostrar sección objetivo ──
  const seccion = document.getElementById(`module-${modName}`);
  if (seccion) seccion.classList.remove('hidden');

  // ── Actualizar título de página ──
  const titles = {
    tte:    'Transporte de Pasajeros',
    vst:    'Visitas',
    abs:    'Abastecimiento',
    report: 'Reportes y Exportación',
    admin:  'Administración',
  };
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titles[modName] || modName;

  APP.moduloActual = modName;

  // ── Inicializar el nuevo módulo ──
  switch (modName) {
    case 'tte':    TTE.init(APP.db, APP.rol); break;
    case 'vst':    VST.init(APP.db, APP.rol); break;
    case 'abs':    ABS.init(APP.db, APP.rol); break;
    case 'report': appInitReport();           break;
    case 'admin':  appInitAdmin();            break;
  }
}

/**
 * Destruye el módulo actual para liberar listeners y recursos.
 */
function appDestroyCurrentModule() {
  switch (APP.moduloActual) {
    case 'tte': if (window.TTE) TTE.destroy(); break;
    case 'vst': if (window.VST) VST.destroy(); break;
    case 'abs': if (window.ABS) ABS.destroy(); break;
  }
}

// ══════════════════════════════════════════════
// SECCIÓN 6 — SIDEBAR TOGGLE (colapsar / expandir)
// ══════════════════════════════════════════════

function appInitSidebarToggle() {
  const btn     = document.getElementById('btn-sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  const main    = document.getElementById('main-content');

  if (!btn || !sidebar) return;

  btn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    main.classList.toggle('collapsed');
  });
}

// ══════════════════════════════════════════════
// SECCIÓN 7 — RELOJ EN TIEMPO REAL
// ══════════════════════════════════════════════

/**
 * Actualiza el reloj del header cada segundo.
 */
function appStartClock() {
  function tick() {
    const now = new Date();
    const dateEl = document.getElementById('clock-date');
    const timeEl = document.getElementById('clock-time');

    if (dateEl) {
      const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
      const dd   = String(now.getDate()).padStart(2, '0');
      const mm   = String(now.getMonth() + 1).padStart(2, '0');
      const yy   = now.getFullYear();
      dateEl.textContent = `${dias[now.getDay()]} ${dd}-${mm}-${yy}`;
    }
    if (timeEl) {
      const hh = String(now.getHours()).padStart(2, '0');
      const mi = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      timeEl.textContent = `${hh}:${mi}:${ss}`;
    }
  }

  tick(); // Ejecutar inmediatamente
  APP.clockTimer = setInterval(tick, 1000);
}

// ══════════════════════════════════════════════
// SECCIÓN 8 — MOTOR DE EXPORTACIÓN EXCEL
// ══════════════════════════════════════════════

/**
 * Inicializa el módulo de reportes:
 * binding del botón de exportar y previsualización.
 */
function appInitReport() {
  const btnExport = document.getElementById('btn-exportar');
  if (!btnExport) return;

  // Clonar para limpiar listeners previos
  const newBtn = btnExport.cloneNode(true);
  btnExport.replaceWith(newBtn);

  document.getElementById('btn-exportar').addEventListener('click', appExportarExcel);
}

/**
 * Consulta Firestore con los filtros seleccionados y exporta a Excel.
 * Los datos se exportan en estricto orden cronológico.
 */
async function appExportarExcel() {
  const tipo    = document.getElementById('rep-tipo').value;
  const desdeEl = document.getElementById('rep-desde');
  const hastaEl = document.getElementById('rep-hasta');

  if (!desdeEl.value || !hastaEl.value) {
    FX.toast('Seleccione un rango de fechas.', 'error');
    return;
  }

  // Construir fechas límite
  const dDesde = FX.parseDateInput(desdeEl.value);
  const dHasta = FX.parseDateInput(hastaEl.value);
  dHasta.setHours(23, 59, 59, 999); // Incluir todo el día final

  if (dDesde > dHasta) {
    FX.toast('La fecha de inicio debe ser anterior a la de fin.', 'error');
    return;
  }

  FX.toast('Generando reporte...', 'info', 2000);

  try {
    // ── Consulta sin índice compuesto; filtro de fechas en cliente ──
    // Se filtra por tipo en Firestore si aplica, el rango de fechas en JS.
    let baseQuery = tipo !== 'all'
      ? APP.db.collection('Ingresos').where('tipo', '==', tipo)
      : APP.db.collection('Ingresos');

    const snapRaw = await baseQuery.get();

    // Filtrar por rango de fechas y ordenar cronológicamente en cliente
    const filteredDocs = snapRaw.docs
      .filter(doc => {
        const ts = doc.data().ingreso;
        if (!ts) return false;
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return d >= dDesde && d <= dHasta;
      })
      .sort((a, b) => {
        const ta = a.data().ingreso && a.data().ingreso.toDate ? a.data().ingreso.toDate() : new Date(0);
        const tb = b.data().ingreso && b.data().ingreso.toDate ? b.data().ingreso.toDate() : new Date(0);
        return ta - tb;
      });

    if (filteredDocs.length === 0) {
      FX.toast('No hay registros para los filtros seleccionados.', 'info');
      document.getElementById('rep-thead').innerHTML = '';
      document.getElementById('rep-tbody').innerHTML = '';
      document.getElementById('rep-empty').textContent = 'No se encontraron registros.';
      document.getElementById('rep-empty').style.display = '';
      return;
    }

    // ── Agrupar por tipo para hojas separadas ──
    const porTipo = {};
    filteredDocs.forEach(doc => {
      const d = doc.data();
      if (!porTipo[d.tipo]) porTipo[d.tipo] = [];
      porTipo[d.tipo].push(d);
    });

    // ── Crear workbook XLSX ──
    const wb = XLSX.utils.book_new();

    Object.entries(porTipo).forEach(([tipoHoja, docsHoja]) => {
      const headers = appGetHeaders(tipoHoja);
      const data    = docsHoja.map(d => appBuildRow(tipoHoja, d));

      const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

      // Ancho de columnas automático
      ws['!cols'] = headers.map(() => ({ wch: 18 }));

      XLSX.utils.book_append_sheet(wb, ws, appTipoLabel(tipoHoja));
    });

    // ── Nombre del archivo con rango de fechas ──
    const fname = `Ingresos_${desdeEl.value}_${hastaEl.value}.xlsx`;
    XLSX.writeFile(wb, fname);

    // ── Previsualizar en tabla HTML ──
    appPreviewReport(filteredDocs);

    FX.toast(`Reporte exportado: ${filteredDocs.length} registros`, 'success');

  } catch (err) {
    console.error('[app] Error al exportar:', err);
    FX.toast('Error al generar el reporte.', 'error');
  }
}

/**
 * Retorna los encabezados de columna según el tipo de ingreso.
 * @param {string} tipo
 * @returns {string[]}
 */
function appGetHeaders(tipo) {
  const base = ['Fecha', 'Hora', 'Guardia', 'RUT', 'Nombre', 'Empresa', 'Patente'];
  switch (tipo) {
    case 'transporte':
      return base;
    case 'visita':
      return [...base, 'Visita a', 'Con Vehículo'];
    case 'abastecimiento':
      return [...base, 'Rampla', 'Hora Salida', 'Permanencia'];
    default:
      return [...base, 'Tipo'];
  }
}

/**
 * Construye una fila de datos para el Excel según el tipo de registro.
 * @param {string} tipo
 * @param {object} d - Datos del documento Firestore
 * @returns {Array}
 */
function appBuildRow(tipo, d) {
  const fecha = FX.formatDate(d.ingreso);
  const hora  = FX.formatTime(d.ingreso);

  switch (tipo) {
    case 'transporte':
      return [fecha, hora, d.guardia || '', d.rut || '', d.nombre || '', d.empresa || '', d.patente || ''];
    case 'visita':
      return [fecha, hora, d.guardia || '', d.rut || '', d.nombre || '', d.empresa || '', d.patente || '—', d.destino || '', d.tieneVehiculo ? 'Sí' : 'No'];
    case 'abastecimiento':
      return [
        fecha, hora, d.guardia || '', d.rut || '', d.nombre || '', d.empresa || '', d.patente || '',
        d.rampla || '—',
        d.salida ? FX.formatTime(d.salida) : 'En recinto',
        d.permanencia || (d.activo ? FX.calcPermanencia(d.ingreso) : '—'),
      ];
    default:
      return [fecha, hora, d.guardia || '', d.rut || '', d.nombre || '', d.empresa || '', d.patente || '', d.tipo || ''];
  }
}

/**
 * Retrocompatibilidad: construye fila genérica para previsualización.
 */
function appBuildExcelRow(d) {
  return appBuildRow(d.tipo || 'transporte', d);
}

/**
 * Traduce el código de tipo a etiqueta legible.
 */
function appTipoLabel(tipo) {
  const labels = { transporte: 'Transporte', visita: 'Visitas', abastecimiento: 'Abastecimiento' };
  return labels[tipo] || tipo;
}

/**
 * Genera una previsualización HTML de los registros exportados.
 * @param {Array} docs - Array de DocumentSnapshot
 */
function appPreviewReport(docs) {
  const thead = document.getElementById('rep-thead');
  const tbody = document.getElementById('rep-tbody');
  const empty = document.getElementById('rep-empty');

  if (!thead || !tbody) return;

  empty.style.display = 'none';

  // Encabezados unificados (vista general)
  thead.innerHTML = `
    <tr>
      <th>#</th><th>Tipo</th><th>Fecha</th><th>Hora</th>
      <th>RUT</th><th>Nombre</th><th>Empresa</th><th>Patente</th><th>Guardia</th>
    </tr>
  `;

  tbody.innerHTML = '';
  docs.forEach((doc, idx) => {
    const d  = doc.data();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="num-cell">${idx + 1}</td>
      <td><span class="badge" style="background:${appTipoColor(d.tipo)}">${appTipoLabel(d.tipo)}</span></td>
      <td>${FX.formatDate(d.ingreso)}</td>
      <td class="time-cell">${FX.formatTimeShort(d.ingreso)}</td>
      <td>${d.rut || '—'}</td>
      <td>${d.nombre || '—'}</td>
      <td>${d.empresa || '—'}</td>
      <td>${d.patente || '—'}</td>
      <td>${d.guardia || '—'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function appTipoColor(tipo) {
  const colors = { transporte: '#062244', visita: '#739624', abastecimiento: '#e8920a' };
  return colors[tipo] || '#4a6d91';
}

// ══════════════════════════════════════════════
// SECCIÓN 9 — MÓDULO DE ADMINISTRACIÓN
// ══════════════════════════════════════════════

/**
 * Inicializa el módulo de administración (solo admin).
 * Permite agregar/eliminar guardias de la colección `lista_guardias`.
 */
function appInitAdmin() {
  // Verificar que sea admin
  if (APP.rol !== LG.ROLES.ADMIN) {
    FX.toast('Acceso denegado.', 'error');
    appSwitchModule('tte');
    return;
  }

  appLoadGuardiasList();

  const btnAdd = document.getElementById('btn-admin-guardia-add');
  if (btnAdd) {
    const newBtn = btnAdd.cloneNode(true);
    btnAdd.replaceWith(newBtn);
    document.getElementById('btn-admin-guardia-add')
      .addEventListener('click', appAgregarGuardia);
  }
}

/**
 * Carga y renderiza la lista de guardias desde Firestore.
 */
async function appLoadGuardiasList() {
  const list = document.getElementById('admin-guardias-list');
  if (!list) return;

  list.innerHTML = '<li style="color:var(--c-text-dim);font-size:13px;">Cargando...</li>';

  try {
    const snap = await APP.db.collection('lista_guardias').orderBy('nombre').get();
    list.innerHTML = '';

    if (snap.empty) {
      list.innerHTML = '<li style="color:var(--c-text-dim);font-size:13px;">Sin guardias registrados.</li>';
      return;
    }

    snap.forEach(doc => {
      const d  = doc.data();
      const li = document.createElement('li');
      li.innerHTML = `
        <span>${d.nombre}</span>
        <button class="btn-sm-danger" onclick="appEliminarGuardia('${doc.id}', '${d.nombre}')">Eliminar</button>
      `;
      list.appendChild(li);
    });

  } catch (err) {
    console.error('[app] Error al cargar guardias:', err);
    list.innerHTML = '<li style="color:var(--c-danger);">Error al cargar.</li>';
  }
}

/**
 * Agrega un nuevo guardia a la colección `lista_guardias`.
 */
async function appAgregarGuardia() {
  const input    = document.getElementById('admin-guardia-nombre');
  const errorDiv = document.getElementById('admin-error');
  const nombre   = input.value.trim();

  errorDiv.classList.add('hidden');

  if (!nombre) {
    errorDiv.textContent = '⚠️ Ingrese el nombre del guardia.';
    errorDiv.classList.remove('hidden');
    return;
  }

  try {
    // Verificar que no exista ya
    const existSnap = await APP.db.collection('lista_guardias')
      .where('nombre', '==', nombre).limit(1).get();

    if (!existSnap.empty) {
      errorDiv.textContent = '⚠️ Ya existe un guardia con ese nombre.';
      errorDiv.classList.remove('hidden');
      return;
    }

    await APP.db.collection('lista_guardias').add({
      nombre,
      creadoPor: APP.user.email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    input.value = '';
    appLoadGuardiasList();
    FX.toast(`Guardia "${nombre}" agregado`, 'success');

  } catch (err) {
    console.error('[app] Error al agregar guardia:', err);
    FX.toast('Error al guardar el guardia.', 'error');
  }
}

/**
 * Elimina un guardia de la colección `lista_guardias`.
 * @param {string} docId  - ID del documento
 * @param {string} nombre - Nombre para confirmar
 */
async function appEliminarGuardia(docId, nombre) {
  FX.modal({
    html: `<p>¿Eliminar al guardia <strong>${nombre}</strong>?<br>Esta acción no se puede deshacer.</p>`,
    onConfirm: async () => {
      try {
        await APP.db.collection('lista_guardias').doc(docId).delete();
        appLoadGuardiasList();
        FX.toast(`Guardia "${nombre}" eliminado`, 'success');
      } catch (err) {
        FX.toast('Error al eliminar.', 'error');
      }
    }
  });
}

// Exponer funciones necesarias globalmente para handlers de HTML
window.appEliminarGuardia = appEliminarGuardia;
