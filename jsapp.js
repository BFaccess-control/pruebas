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
