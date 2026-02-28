// Forzamos que el DOM esté listo antes de actuar
document.addEventListener('DOMContentLoaded', () => {
    console.log("JSAPP cargado y listo");
    inicializarApp();
});

async function inicializarApp() {
    // Importaciones dinámicas
    const { observarSesion, configurarPermisosSeguros, iniciarSesion, cerrarSesion } = await import('./jslg.js');
    const { activarAutocompletadoRUT, activarAutocompletadoPatente, cargarGuardiasYListados, exportarExcel, formatearRUT } = await import('./jsmtr.js');
    const { db } = await import('./jslg.js');
    const { collection, addDoc, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
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

    // --- ACCIONES DE BOTONES ---
    document.getElementById('btn-login').onclick = () => {
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        iniciarSesion(email, pass).catch(err => alert("Error: " + err.message));
    };

    document.getElementById('btn-logout').onclick = () => cerrarSesion();

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

    document.getElementById('btn-exportar').onclick = () => {
        const inicio = document.getElementById('fecha-inicio').value;
        const fin = document.getElementById('fecha-fin').value;
        const tipoF = document.getElementById('filtro-tipo').value;
        if(!inicio || !fin) return alert("Seleccione fechas");
        exportarExcel(inicio, fin, tipoF);
    };

    // --- NAVEGACIÓN (3 pestañas) ---
    const btnTte = document.getElementById('btn-tab-transporte');
    const btnVst = document.getElementById('btn-tab-visitas');
    const btnAbs = document.getElementById('btn-tab-abastecimiento');

    const secTte = document.getElementById('sec-transporte');
    const secVst = document.getElementById('sec-visitas');
    const secAbs = document.getElementById('sec-abastecimiento');

    const ocultarTodo = () => {
        [secTte, secVst, secAbs].forEach(s => { if(s) s.style.display = 'none'; });
        [btnTte, btnVst, btnAbs].forEach(b => { if(b) b.classList.remove('active'); });
    };

    btnTte.onclick = () => {
        ocultarTodo();
        secTte.style.display = 'block';
        btnTte.classList.add('active');
    };

    btnVst.onclick = () => {
        ocultarTodo();
        secVst.style.display = 'block';
        btnVst.classList.add('active');
    };

    btnAbs.onclick = async () => {
        ocultarTodo();
        secAbs.style.display = 'block';
        btnAbs.classList.add('active');
        // Cargamos la lista de camiones en recinto cada vez que entramos a la pestaña
        const { cargarCamionesEnRecinto } = await import('./jsabs.js');
        cargarCamionesEnRecinto();
    };

    // --- INICIALIZACIÓN DE MÓDULOS Y AUTOCOMPLETADOS ---
    activarAutocompletadoRUT('t-rut', 't-sugerencias');
    activarAutocompletadoRUT('v-rut', 'v-sugerencias-rut');
    
    // Importamos e inicializamos la lógica de Abastecimiento (RUT, Nombre, Patentes)
    import('./jsabs.js').then(m => m.inicializarAbastecimiento());

    // --- MAESTRO CONDUCTOR ---
    const mRut = document.getElementById('m-rut');
    if(mRut) {
        mRut.oninput = (e) => e.target.value = formatearRUT(e.target.value);
    }

    const formMaestro = document.getElementById('form-maestro');
    if(formMaestro) {
        formMaestro.onsubmit = async (e) => {
            e.preventDefault();
            
            const rutValor = document.getElementById('m-rut').value;
            const nombreValor = document.getElementById('m-nombre').value;
            const empresaValor = document.getElementById('m-empresa').value;

            try {
                const q = query(collection(db, "conductores"), where("rut", "==", rutValor));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    alert(`⚠️ El conductor con RUT ${rutValor} ya existe en el Maestro.`);
                    return;
                }

                await addDoc(collection(db, "conductores"), { 
                    rut: rutValor, 
                    nombre: nombreValor, 
                    empresa: empresaValor 
                });

                alert("✅ Conductor agregado exitosamente.");
                formMaestro.reset();
                document.getElementById('modal-conductor').style.display = 'none';

            } catch (error) {
                console.error("Error en Maestro:", error);
                alert("Error al validar datos.");
            }
        };
    }
} // Fin de inicializarApp
