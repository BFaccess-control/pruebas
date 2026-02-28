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

    // --- MAESTRO CONDUCTOR (Dentro de inicializarApp) ---
    
    // 1. Formatear RUT automáticamente al escribir en el modal
    const mRut = document.getElementById('m-rut');
    if(mRut) {
        mRut.oninput = (e) => e.target.value = formatearRUT(e.target.value);
    }

    // 2. Lógica de Guardado con Validación de Duplicados
    const formMaestro = document.getElementById('form-maestro');
    if(formMaestro) {
        formMaestro.onsubmit = async (e) => {
            e.preventDefault();
            
            // Importamos herramientas de búsqueda de Firestore
            const { query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            
            const rutValor = document.getElementById('m-rut').value;
            const nombreValor = document.getElementById('m-nombre').value;
            const empresaValor = document.getElementById('m-empresa').value;

            try {
                // VALIDACIÓN: ¿Ya existe este RUT?
                const q = query(collection(db, "conductores"), where("rut", "==", rutValor));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    alert(`⚠️ El conductor con RUT ${rutValor} ya existe en el Maestro.`);
                    return; // Abortamos el guardado
                }

                // Si no existe, lo agregamos
                await addDoc(collection(db, "conductores"), { 
                    rut: rutValor, 
                    nombre: nombreValor, 
                    empresa: empresaValor 
                });

                alert("✅ Conductor agregado exitosamente.");
                e.target.reset();
                document.getElementById('modal-conductor').style.display = 'none';

            } catch (error) {
                console.error("Error en Maestro:", error);
                alert("Error al validar datos.");
            }
        };
    }
} // <--- Esta es la llave que cierra inicializarApp




