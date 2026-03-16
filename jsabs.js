import { db } from './jslg.js';
import { collection, query, where, onSnapshot, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { guardarRegistro, aprenderPatente } from './jsmtr.js';

let datosPendienteSalida = null; 

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
            alert("✅ Ingreso de Abastecimiento registrado.");
        } catch (error) {
            console.error("Error al guardar ingreso:", error);
        }
    };

    // Configuración de botones del modal (usando delegación o verificación)
    const btnConfirmar = document.getElementById('btn-confirmar-salida');
    if (btnConfirmar) {
        btnConfirmar.onclick = async () => {
            if (datosPendienteSalida) {
                await ejecutarSalida(datosPendienteSalida);
                cerrarModalSalida();
            }
        };
    }

    const btnCancelar = document.getElementById('btn-cancelar-salida');
    if (btnCancelar) btnCancelar.onclick = cerrarModalSalida;
};

export const cargarCamionesEnRecinto = () => {
    const tabla = document.getElementById('tabla-camiones-recinto');
    if(!tabla) {
        console.warn("No se encontró el elemento 'tabla-camiones-recinto'");
        return;
    }

    const q = query(
        collection(db, "registros"), 
        where("estado", "==", "En Recinto"), 
        where("tipo", "==", "ABASTECIMIENTO")
    );
    
    // El onSnapshot es el que mantiene la tabla viva
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
                <td><button class="btn-salida-accion" data-id="${id}">Salida</button></td>
            `;
            tabla.appendChild(fila);
        });

        // Eventos para los botones recién creados
        tabla.querySelectorAll('.btn-salida-accion').forEach(btn => {
            btn.onclick = () => {
                const docId = btn.getAttribute('data-id');
                const docData = snapshot.docs.find(doc => doc.id === docId).data();
                abrirModalSalida({ id: docId, ...docData });
            };
        });
    }, (error) => {
        console.error("Error en tiempo real de la tabla:", error);
    });
};

function abrirModalSalida(datos) {
    datosPendienteSalida = datos;
    const detalle = document.getElementById('detalle-salida-camion');
    if (detalle) {
        detalle.innerHTML = `
            <strong>Patente:</strong> ${datos.patente}<br>
            <strong>Guía:</strong> ${datos.guia}<br>
            <strong>Ingreso:</strong> ${datos.fecha} ${datos.hora}
        `;
    }
    const modal = document.getElementById('modal-confirmar-salida');
    if (modal) modal.style.display = 'flex';
}

function cerrarModalSalida() {
    const modal = document.getElementById('modal-confirmar-salida');
    if (modal) modal.style.display = 'none';
    datosPendienteSalida = null;
}

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
    } catch (e) {
        console.error("Error al procesar salida:", e);
        alert("Hubo un error al registrar la salida.");
    }
}
