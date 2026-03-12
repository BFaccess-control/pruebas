import { db } from './jslg.js';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { guardarRegistro, aprenderPatente } from './jsmtr.js';

let datosPendienteSalida = null; 

export const inicializarAbastecimiento = () => {
    const form = document.getElementById('form-abastecimiento');
    if(!form) return;

    form.onsubmit = async (e) => {
        e.preventDefault();
        
        // --- PASO 1: CAPTURA DE TIEMPO EXACTO ---
        const ahora = new Date(); 
        const patCamion = document.getElementById('a-patente').value.toUpperCase();
        const patRampla = document.getElementById('a-rampla').value.toUpperCase();
        
        const data = {
            tipo: "ABASTECIMIENTO",
            guardia: document.getElementById('a-guardia-id').value,
            rut: document.getElementById('a-rut').value,
            nombre: document.getElementById('a-nombre').value,
            guia: document.getElementById('a-guia').value,
            patente: patCamion,
            rampla: patRampla,
            estado: "En Recinto",
            // Campos mejorados para Supply
            fecha: ahora.toLocaleDateString('es-CL'), 
            hora: ahora.toLocaleTimeString('es-CL', { hour12: false, hour: '2-digit', minute: '2-digit' }),
            timestampIngreso: ahora.getTime() // Milisegundos para cálculo matemático real
        };

        try {
            await guardarRegistro(data);
            await addDoc(collection(db, "registros"), data);
            await aprenderPatente(patCamion);
            if(patRampla) await aprenderPatente(patRampla);
            
            e.target.reset();
            alert("✅ Ingreso registrado con éxito");
        } catch (error) {
            alert("Error al registrar: " + error.message);
        }
    };

    document.getElementById('btn-cancelar-salida').onclick = () => {
        document.getElementById('modal-confirmar-salida').style.display = 'none';
    };

    document.getElementById('btn-confirmar-salida-final').onclick = async () => {
        if (datosPendienteSalida) {
            await ejecutarSalida(datosPendienteSalida);
            document.getElementById('modal-confirmar-salida').style.display = 'none';
        }
    };
};

export const cargarCamionesEnRecinto = () => {
    const tablaBody = document.getElementById('tabla-abastecimiento-recinto');
    if (!tablaBody) return;

    const q = query(collection(db, "registros"), where("tipo", "==", "ABASTECIMIENTO"), where("estado", "==", "En Recinto"));

    onSnapshot(q, (snapshot) => {
        tablaBody.innerHTML = "";
        snapshot.forEach((docSnap) => {
            const res = docSnap.data();
            const fila = document.createElement('tr');
            fila.innerHTML = `
                <td><strong>${res.nombre}</strong><br><small>${res.rut}</small></td>
                <td><strong>C:</strong> ${res.patente}<br><strong>R:</strong> ${res.rampla || '---'}</td>
                <td>${res.fecha}<br>${res.hora}</td>
                <td>
                    <button class="btn-salida-rojo" 
                            data-id="${docSnap.id}" 
                            data-patente="${res.patente}" 
                            data-nombre="${res.nombre}"
                            data-guia="${res.guia || 'N/A'}"
                            data-hora="${res.hora}"
                            data-fecha="${res.fecha}"
                            data-timestamp-ingreso="${res.timestampIngreso}"> 
                        MARCAR SALIDA
                    </button>
                </td>
            `;
            tablaBody.appendChild(fila);
        });

        document.querySelectorAll('.btn-salida-rojo').forEach(btn => {
            btn.onclick = () => mostrarValidacionSalida(btn.dataset);
        });
    });
};

function mostrarValidacionSalida(datos) {
    datosPendienteSalida = datos;
    const infoDiv = document.getElementById('detalle-salida-camion');
    
    infoDiv.innerHTML = `
        <strong>Conductor:</strong> ${datos.nombre}<br>
        <strong>Patente Camión:</strong> ${datos.patente}<br>
        <strong>Número de Guía:</strong> ${datos.guia}<br>
        <strong>Ingreso:</strong> ${datos.fecha} a las ${datos.hora}
    `;
    
    document.getElementById('modal-confirmar-salida').style.display = 'flex';
}

async function ejecutarSalida(datos) {
    const { id, patente, timestampIngreso } = datos;
    const ahoraSalida = new Date();
    const horaS = ahoraSalida.toLocaleTimeString('es-CL', { hour12: false, hour: '2-digit', minute: '2-digit' });
    const fechaS = ahoraSalida.toLocaleDateString('es-CL');
    
    // NUEVO CÁLCULO DE PERMANENCIA BASADO EN TIMESTAMP
    let perm = "---";
    if (timestampIngreso && timestampIngreso !== "undefined") {
        const msDiferencia = ahoraSalida.getTime() - Number(timestampIngreso);
        const minutosTotales = Math.floor(msDiferencia / (1000 * 60));
        const horas = Math.floor(minutosTotales / 60);
        const minutos = minutosTotales % 60;
        perm = `${horas}h ${minutos}m`;
    }

    try {
        const dataUpdate = { 
            estado: "Finalizado", 
            fechaSalida: fechaS,
            horaSalida: horaS, 
            permanencia: perm 
        };

        await updateDoc(doc(db, "registros", id), dataUpdate);
        
        const qIng = query(collection(db, "ingresos"), where("tipo", "==", "ABASTECIMIENTO"), where("patente", "==", patente), where("estado", "==", "En Recinto"));
        const snapIng = await getDocs(qIng);
        snapIng.forEach(async (d) => {
            await updateDoc(doc(db, "ingresos", d.id), dataUpdate);
        });

        alert(`✅ Salida confirmada. Permanencia total: ${perm}`);
    } catch (e) { 
        console.error(e);
        alert("Error al procesar salida"); 
    }
}
