import { db } from './jslg.js';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { guardarRegistro, aprenderPatente } from './jsmtr.js';

let datosPendienteSalida = null; 

export const inicializarAbastecimiento = () => {
    const form = document.getElementById('form-abastecimiento');
    if(!form) return;

    form.onsubmit = async (e) => {
        e.preventDefault();
        const patCamion = document.getElementById('a-patente').value.toUpperCase();
        const patRampla = document.getElementById('a-rampla').value.toUpperCase();
        
        const ahora = new Date();

        const data = {
            tipo: "ABASTECIMIENTO",
            guardia: document.getElementById('a-guardia-id').value,
            rut: document.getElementById('a-rut').value,
            nombre: document.getElementById('a-nombre').value,
            guia: document.getElementById('a-guia').value,
            patente: patCamion,
            rampla: patRampla,
            estado: "En Recinto",
            fecha: ahora.toLocaleDateString('es-CL'), 
            hora: ahora.toLocaleTimeString('es-CL', { hour12: false, hour: '2-digit', minute: '2-digit' }),
            timestampIngreso: ahora.getTime() 
        };

        await guardarRegistro(data);
        await aprenderPatente(patCamion);
        
        e.target.reset();
        alert("✅ Ingreso de Abastecimiento registrado.");
    };

    const btnConfirmar = document.getElementById('btn-confirmar-salida');
    const btnCancelar = document.getElementById('btn-cancelar-salida');

    if (btnConfirmar) {
        btnConfirmar.onclick = async () => {
            if (datosPendienteSalida) {
                await ejecutarSalida(datosPendienteSalida);
                cerrarModalSalida();
            }
        };
    }

    if (btnCancelar) {
        btnCancelar.onclick = cerrarModalSalida;
    }
};

export const cargarCamionesEnRecinto = () => {
    const tabla = document.getElementById('tabla-camiones-recinto');
    if(!tabla) return;

    // Filtro para ver solo los que están dentro
    const q = query(collection(db, "registros"), where("estado", "==", "En Recinto"), where("tipo", "==", "ABASTECIMIENTO"));
    
    onSnapshot(q, (snapshot) => {
        tabla.innerHTML = "";
        
        // Guardamos los documentos en un array para acceder a ellos luego
        const docsArray = [];
        
        snapshot.forEach((docSnap) => {
            const d = docSnap.data();
            const id = docSnap.id;
            docsArray.push({ id, ...d });

            const fila = document.createElement('tr');
            // Usamos d.hora o un fallback si por alguna razón no existe
            const horaMostrar = d.hora || "---";
            
            fila.innerHTML = `
                <td>${d.patente}</td>
                <td>${d.guia}</td>
                <td>${horaMostrar}</td>
                <td><button class="btn-salida" data-id="${id}">Salida</button></td>
            `;
            tabla.appendChild(fila);
        });

        // Eventos para botones de salida
        document.querySelectorAll('.btn-salida').forEach(btn => {
            btn.onclick = () => {
                const docId = btn.getAttribute('data-id');
                const docData = docsArray.find(item => item.id === docId);
                if (docData) {
                    abrirModalSalida(docData);
                }
            };
        });
    }, (error) => {
        console.error("Error en el snapshot de abastecimiento:", error);
    });
};

function abrirModalSalida(datos) {
    datosPendienteSalida = datos;
    const detalle = document.getElementById('detalle-salida-camion');
    detalle.innerHTML = `
        <strong>Patente Camión:</strong> ${datos.patente}<br>
        <strong>Número de Guía:</strong> ${datos.guia}<br>
        <strong>Fecha de Ingreso:</strong> ${datos.fecha || 'No registrada'}<br>
        <strong>Hora de Ingreso:</strong> ${datos.hora || 'No registrada'}
    `;
    document.getElementById('modal-confirmar-salida').style.display = 'flex';
}

function cerrarModalSalida() {
    document.getElementById('modal-confirmar-salida').style.display = 'none';
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
        console.error("Error al registrar salida:", e);
    }
}
