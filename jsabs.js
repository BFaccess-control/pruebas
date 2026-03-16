import { db } from './jslg.js';
import { collection, query, where, onSnapshot, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { guardarRegistro, aprenderPatente } from './jsmtr.js';

let datosPendienteSalida = null; 

// --- 1. FUNCIONES DEL MODAL ---
const cerrarModalSalida = () => {
    const modal = document.getElementById('modal-confirmar-salida');
    if (modal) modal.style.display = 'none';
    datosPendienteSalida = null;
};

const abrirModalSalida = (datos) => {
    datosPendienteSalida = datos;
    const detalle = document.getElementById('detalle-salida-camion');
    if (detalle) {
        detalle.innerHTML = `
            <strong>Patente:</strong> ${datos.patente || 'S/P'}<br>
            <strong>Guía:</strong> ${datos.guia || '---'}<br>
            <strong>Ingreso:</strong> ${datos.fecha || ''} ${datos.hora || ''}
        `;
    }
    const modal = document.getElementById('modal-confirmar-salida');
    if (modal) modal.style.display = 'flex';
};

// --- 2. LÓGICA DE SALIDA (Cálculo corregido días/horas) ---
async function ejecutarSalida(datos) {
    const { id, timestampIngreso } = datos;
    const ahora = new Date();
    const timestampSalida = ahora.getTime();
    
    let perm = "---";
    if (timestampIngreso) {
        const diffMs = timestampSalida - timestampIngreso;
        const totalMinutos = Math.floor(diffMs / (1000 * 60));
        const dias = Math.floor(totalMinutos / 1440);
        const horas = Math.floor((totalMinutos % 1440) / 60);
        const minutos = totalMinutos % 60;
        perm = (dias > 0) ? `${dias}d ${horas}h ${minutos}m` : `${horas}h ${minutos}m`;
    }

    try {
        await updateDoc(doc(db, "registros", id), { 
            estado: "Finalizado", 
            fechaSalida: ahora.toLocaleDateString('es-CL'),
            horaSalida: ahora.toLocaleTimeString('es-CL', { hour12: false, hour: '2-digit', minute: '2-digit' }),
            timestampSalida: timestampSalida,
            permanencia: perm 
        });
        cerrarModalSalida();
    } catch (e) {
        console.error("Error al procesar salida:", e);
    }
}

// --- 3. CARGA DE TABLA (Usando tu ID real: tabla-abastecimiento-recinto) ---
export const cargarCamionesEnRecinto = () => {
    const tabla = document.getElementById('tabla-abastecimiento-recinto');
    
    if(!tabla) {
        console.warn("Esperando a que la tabla cargue...");
        setTimeout(cargarCamionesEnRecinto, 500);
        return;
    }

    const q = query(
        collection(db, "registros"), 
        where("estado", "==", "En Recinto"), 
        where("tipo", "==", "ABASTECIMIENTO")
    );
    
    onSnapshot(q, (snapshot) => {
        tabla.innerHTML = "";
        
        if (snapshot.empty) {
            tabla.innerHTML = "<tr><td colspan='4' style='text-align:center;'>No hay camiones en recinto</td></tr>";
            return;
        }

        snapshot.forEach((docSnap) => {
            const d = docSnap.data();
            const id = docSnap.id;
            const fila = document.createElement('tr');
            
            fila.innerHTML = `
                <td>${d.patente || 'S/P'}</td>
                <td>${d.guia || '---'}</td>
                <td>${d.hora || '---'}</td>
                <td><button class="btn-salida-final" data-id="${id}">Salida</button></td>
            `;
            tabla.appendChild(fila);
        });

        tabla.querySelectorAll('.btn-salida-final').forEach(btn => {
            btn.onclick = () => {
                const docId = btn.getAttribute('data-id');
                const docData = snapshot.docs.find(doc => doc.id === docId).data();
                abrirModalSalida({ id: docId, ...docData });
            };
        });
    });
};

// --- 4. INICIALIZACIÓN ---
export const inicializarAbastecimiento = () => {
    const form = document.getElementById('form-abastecimiento');
    if(!form) return;

    form.onsubmit = async (e) => {
        e.preventDefault();
        const patCamion = document.getElementById('a-patente').value.toUpperCase();
        const ahora = new Date();

        const data = {
            tipo: "ABASTECIMIENTO",
            guardia: document.getElementById('a-guardia-id').value,
            rut: document.getElementById('a-rut').value,
            nombre: document.getElementById('a-nombre').value,
            guia: document.getElementById('a-guia').value,
            patente: patCamion,
            rampla: document.getElementById('a-rampla').value.toUpperCase(),
            estado: "En Recinto",
            fecha: ahora.toLocaleDateString('es-CL'), 
            hora: ahora.toLocaleTimeString('es-CL', { hour12: false, hour: '2-digit', minute: '2-digit' }),
            timestampIngreso: ahora.getTime() 
        };

        try {
            await guardarRegistro(data);
            await aprenderPatente(patCamion);
            e.target.reset();
            alert("✅ Registro guardado.");
        } catch (error) {
            console.error(error);
        }
    };

    const btnConfirmar = document.getElementById('btn-confirmar-salida');
    if (btnConfirmar) {
        btnConfirmar.onclick = () => {
            if (datosPendienteSalida) ejecutarSalida(datosPendienteSalida);
        };
    }

    const btnCancelar = document.getElementById('btn-cancelar-salida');
    if (btnCancelar) btnCancelar.onclick = cerrarModalSalida;
};
