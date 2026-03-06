document.addEventListener('DOMContentLoaded', () => {
    console.log("JSAPP cargado y listo");
    inicializarApp();
});

async function inicializarApp() {
    // --- 1. IMPORTACIONES ---
    const { observarSesion, configurarPermisosSeguros, iniciarSesion, cerrarSesion, db } = await import('./jslg.js');
    const { activarAutocompletadoRUT, activarAutocompletadoPatente, cargarGuardiasYListados, exportarExcel, formatearRUT } = await import('./jsmtr.js');
    const { collection, addDoc, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    const { inicializarTransporte } = await import('./jstte.js');
    const { inicializarVisitas } = await import('./jsvst.js');
    const { inicializarAbastecimiento, cargarCamionesEnRecinto } = await import('./jsabs.js');

    // --- 2. SESIÓN Y PERMISOS ---
    observarSesion(async (user) => {
        if (user) {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app-body').style.display = 'block';
            
            await configurarPermisosSeguros(user.email);
            
            // Carga de datos iniciales
            cargarGuardiasYListados();
            inicializarTransporte();
            inicializarVisitas();
            inicializarAbastecimiento();

            // ACTIVACIÓN DE AUTOCOMPLETADOS
            activarAutocompletadoRUT('t-rut', 't-sugerencias');
            activarAutocompletadoRUT('v-rut', 'v-sugerencias-rut');
            activarAutocompletadoRUT('a-rut', 'a-sugerencias-rut');
            
            activarAutocompletadoPatente('t-patente', 'p-sugerencias');
            activarAutocompletadoPatente('v-patente', 'v-sugerencias-patente');
            activarAutocompletadoPatente('a-patente', 'a-sugerencias-patente');
            activarAutocompletadoPatente('a-rampla', 'a-sugerencias-rampla');

        } else {
            document.getElementById('login-screen').style.display = 'flex';
            document.getElementById('app-body').style.display = 'none';
        }
    });

    // --- 3. BOTONES DE ACCESO ---
    document.getElementById('btn-login').onclick = () => {
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        iniciarSesion(email, pass).catch(err => alert("Error: " + err.message));
    };
    document.getElementById('btn-logout').onclick = () => cerrarSesion();

    // --- 4. GESTIÓN DE MODALES ---
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

    // --- 5. REPORTES EXCEL ---
    document.getElementById('btn-exportar').onclick = () => {
        const inicio = document.getElementById('fecha-inicio').value;
        const fin = document.getElementById('fecha-fin').value;
        const tipoF = document.getElementById('filtro-tipo').value;
        if(!inicio || !fin) return alert("⚠️ Seleccione el rango de fechas.");
        exportarExcel(inicio, fin, tipoF);
    };

    // --- 6. NAVEGACIÓN (TABS) ---
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

    btnTte.onclick = () => { ocultarTodo(); secTte.style.display = 'block'; btnTte.classList.add('active'); };
    btnVst.onclick = () => { ocultarTodo(); secVst.style.display = 'block'; btnVst.classList.add('active'); };
    btnAbs.onclick = () => { 
        ocultarTodo(); 
        secAbs.style.display = 'block'; 
        btnAbs.classList.add('active'); 
        cargarCamionesEnRecinto(); // <--- Carga la tabla al entrar a la pestaña
    };

    // --- 7. MAESTRO CONDUCTOR ---
    const mRut = document.getElementById('m-rut');
    if(mRut) mRut.oninput = (e) => e.target.value = formatearRUT(e.target.value);
    const formMaestro = document.getElementById('form-maestro');
    if(formMaestro) {
        formMaestro.onsubmit = async (e) => {
            e.preventDefault();
            const rutVal = document.getElementById('m-rut').value;
            try {
                const q = query(collection(db, "conductores"), where("rut", "==", rutVal));
                const snap = await getDocs(q);
                if (!snap.empty) return alert(`⚠️ El RUT ${rutVal} ya existe.`);
                await addDoc(collection(db, "conductores"), { 
                    rut: rutVal, 
                    nombre: document.getElementById('m-nombre').value, 
                    empresa: document.getElementById('m-empresa').value 
                });
                alert("✅ Conductor agregado.");
                formMaestro.reset();
                document.getElementById('modal-conductor').style.display = 'none';
            } catch (err) { alert("Error al guardar maestro."); }
        };
    }
}
