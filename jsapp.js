// Forzamos que el DOM esté listo antes de actuar
document.addEventListener('DOMContentLoaded', () => {
    console.log("JSAPP cargado y listo"); // Esto debe salir en la consola
    inicializarApp();
});

async function inicializarApp() {
    // Importaciones dinámicas para evitar bloqueos al inicio
    const { observarSesion, configurarPermisosSeguros, iniciarSesion, cerrarSesion } = await import('./jslg.js');
    const { activarAutocompletadoRUT, activarAutocompletadoPatente, cargarGuardiasYListados, exportarExcel, formatearRUT } = await import('./jsmtr.js');
    const { db } = await import('./jslg.js');
    const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    const { inicializarTransporte } = await import('./jstte.js');
    const { inicializarVisitas } = await import('./jsvst.js');

    // --- SESIÓN ---
    observarSesion(async (user) => {
        if (user) {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app-body').style.display = 'block';
            await configurarPermisosSeguros(user.email);
            cargarGuardiasYListados();
            inicializarTransporte();
            inicializarVisitas();
        } else {
            document.getElementById('login-screen').style.display = 'flex';
            document.getElementById('app-body').style.display = 'none';
        }
    });

    // --- ACCIONES DE BOTONES (Asignación directa) ---
    
    // Login / Logout
    document.getElementById('btn-login').onclick = () => {
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        iniciarSesion(email, pass).catch(err => alert("Error: " + err.message));
    };

    document.getElementById('btn-logout').onclick = () => cerrarSesion();

    // Modales (Abrir/Cerrar)
    const asignarModal = (btnId, modalId, display) => {
        const btn = document.getElementById(btnId);
        if(btn) btn.onclick = () => document.getElementById(modalId).style.display = display;
    };

    asignarModal('btn-gestionar-guardias', 'modal-gestion-guardias', 'flex');
    asignarModal('btn-cerrar-gestion', 'modal-gestion-guardias', 'none');
    asignarModal('btn-abrir-reportes', 'modal-reportes', 'flex');
    asignarModal('btn-cerrar-reportes', 'modal-reportes', 'none');
    asignarModal('btn-abrir-modal', 'modal-conductor', 'flex');
    asignarModal('btn-cerrar-modal', 'modal-conductor', 'none');

    // Reportes
    document.getElementById('btn-exportar').onclick = () => {
        const inicio = document.getElementById('fecha-inicio').value;
        const fin = document.getElementById('fecha-fin').value;
        const tipoF = document.getElementById('filtro-tipo').value;
        if(!inicio || !fin) return alert("Seleccione fechas");
        exportarExcel(inicio, fin, tipoF);
    };

   // --- NAVEGACIÓN ENTRE PESTAÑAS (Con cambio de color) ---
const btnTte = document.getElementById('btn-tab-transporte');
const btnVst = document.getElementById('btn-tab-visitas');
const secTte = document.getElementById('sec-transporte');
const secVst = document.getElementById('sec-visitas');

btnTte.onclick = () => {
    // Mostrar/Ocultar secciones
    secTte.style.display = 'block';
    secVst.style.display = 'none';
    
    // Cambiar colores (Clases)
    btnTte.classList.add('active'); // Se pone verde
    btnVst.classList.remove('active'); // Vuelve al color normal
};

btnVst.onclick = () => {
    // Mostrar/Ocultar secciones
    secVst.style.display = 'block';
    secTte.style.display = 'none';
    
    // Cambiar colores (Clases)
    btnVst.classList.add('active'); // Se pone verde
    btnTte.classList.remove('active'); // Vuelve al color normal
};

    // Autocompletados
    activarAutocompletadoRUT('t-rut', 't-sugerencias');
    activarAutocompletadoRUT('v-rut', 'v-sugerencias-rut');
}

