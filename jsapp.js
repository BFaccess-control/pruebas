import { observarSesion, configurarPermisosSeguros } from './jslg.js';
import { activarAutocompletadoRUT, activarAutocompletadoPatente, cargarGuardiasYListados } from './jsmtr.js';
// Importamos los nuevos módulos
import { inicializarTransporte } from './jstte.js';
import { inicializarVisitas } from './jsvst.js';

observarSesion(async (user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-body').style.display = 'block';
        await configurarPermisosSeguros(user.email);
        cargarGuardiasYListados();
        
        // Arrancamos la lógica de cada ventana
        inicializarTransporte();
        inicializarVisitas();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('app-body').style.display = 'none';
    }
});

// Autocompletados (Se mantienen aquí porque son transversales)
activarAutocompletadoRUT('t-rut', 't-sugerencias');
activarAutocompletadoRUT('v-rut', 'v-sugerencias-rut');
activarAutocompletadoPatente('t-patente', 'p-sugerencias');
activarAutocompletadoPatente('v-patente', 'v-sugerencias-patente');

// Navegación de pestañas (Control visual)
document.getElementById('btn-tab-transporte').onclick = () => {
    document.getElementById('sec-transporte').style.display='block';
    document.getElementById('sec-visitas').style.display='none';
};
document.getElementById('btn-tab-visitas').onclick = () => {
    document.getElementById('sec-visitas').style.display='block';
    document.getElementById('sec-transporte').style.display='none';
};
import { exportarExcel } from './jsmtr.js';

// --- BOTÓN REPORTES EXCEL ---
document.getElementById('btn-exportar').onclick = () => {
    const inicio = document.getElementById('fecha-inicio').value;
    const fin = document.getElementById('fecha-fin').value;
    const tipoF = document.getElementById('filtro-tipo').value;
    if(!inicio || !fin) return alert("Por favor, seleccione un rango de fechas.");
    exportarExcel(inicio, fin, tipoF);
};

// --- BOTÓN GESTIONAR GUARDIAS Y OTROS MODALES ---
// Estos botones solo abren y cierran ventanas (UI), deben estar en jsapp.js
document.getElementById('btn-gestionar-guardias').onclick = () => {
    document.getElementById('modal-gestion-guardias').style.display = 'flex';
};

document.getElementById('btn-cerrar-gestion').onclick = () => {
    document.getElementById('modal-gestion-guardias').style.display = 'none';
};

document.getElementById('btn-abrir-reportes').onclick = () => {
    document.getElementById('modal-reportes').style.display = 'flex';
};

document.getElementById('btn-cerrar-reportes').onclick = () => {
    document.getElementById('modal-reportes').style.display = 'none';
};

// Botón para agregar guardia nuevo
document.getElementById('btn-add-guardia').onclick = async () => {
    const n = document.getElementById('nuevo-guardia-nombre');
    if(n.value) {
        // Importamos db de jslg para poder guardar
        import { db } from './jslg.js';
        import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
        await addDoc(collection(db, "lista_guardias"), { nombre: n.value });
        n.value = "";
    }
};
