import { db } from './jslg.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { guardarRegistro, aprenderPatente } from './jsmtr.js';

export const inicializarVisitas = () => {
    const form = document.getElementById('form-visitas');
    const checkVehiculo = document.getElementById('v-check-vehiculo');
    const inputPatente = document.getElementById('v-patente');

    if (checkVehiculo) {
        checkVehiculo.onchange = (e) => {
            inputPatente.style.display = e.target.checked ? 'block' : 'none';
        };
    }

    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const pat = inputPatente.value;
            
            const data = {
                tipo: "VISITA",
                guardia: document.getElementById('v-guardia-id').value,
                rut: document.getElementById('v-rut').value,
                nombre: document.getElementById('v-nombre').value,
                empresa: document.getElementById('v-representa').value,
                motivo: document.getElementById('v-motivo').value,
                patente: pat || "PEATON"
            };

            await guardarRegistro(data);
            if (pat) await aprenderPatente(pat);
            
            e.target.reset();
            inputPatente.style.display = 'none';
        };
    }
};
