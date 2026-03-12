import { db } from './jslg.js';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { guardarRegistro, aprenderPatente } from './jsmtr.js';

let datosPendienteSalida = null; // Variable para guardar datos temporalmente

export const inicializarAbastecimiento = () => {
    const form = document.getElementById('form-abastecimiento');
    if(!form) return;

    form.onsubmit = async (e) => {
        e.preventDefault();
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
            hora: new Date().toLocaleTimeString('es-CL', { hour12: false, hour: '2-digit', minute: '2-digit' })
        };

        await guardarRegistro(data);
        await addDoc(collection(db, "registros"), data);
        await aprenderPatente(patCamion);
        if(patRampla) await aprenderPatente(patRampla);
        
        e.target.reset();
        alert("✅ Ingreso registrado");
    };

    // Configurar botones del modal de validación
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
                <td>${res.hora || '---'}</td>
                <td>
                    <button class="btn-salida-rojo" 
                            data-id="${docSnap.id}" 
                            data-patente="${res.patente}" 
                            data-nombre="${res.nombre}"
                            data-guia="${res.guia || 'N/A'}"
                            data-hora="${res.hora}">
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

// --- NUEVA INSTANCIA DE VALIDACIÓN ---
function mostrarValidacionSalida(datos) {
    datosPendienteSalida = datos;
    const infoDiv = document.getElementById('detalle-salida-camion');
    
    // Mostramos los datos para que el guardia verifique
    infoDiv.innerHTML = `
        <strong>Conductor:</strong> ${datos.nombre}<br>
        <strong>Patente Camión:</strong> ${datos.patente}<br>
        <strong>Número de Guía:</strong> ${datos.guia}<br>
        <strong>Hora de Ingreso:</strong> ${datos.hora}
    `;
    
    document.getElementById('modal-confirmar-salida').style.display = 'flex';
}

async function ejecutarSalida(datos) {
    const { id, patente, hora } = datos;
    const horaS = new Date().toLocaleTimeString('es-CL', { hour12: false, hour: '2-digit', minute: '2-digit' });
    
    // Cálculo de permanencia
    let perm = "---";
    if (hora && hora.includes(':')) {
        const [h1, m1] = hora.split(':').map(Number);
        const [h2, m2] = horaS.split(':').map(Number);
        const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
        const totalMinutos = diff < 0 ? diff + 1440 : diff;
        perm = `${Math.floor(totalMinutos/60)}h ${totalMinutos%60}m`;
    }

    try {
        await updateDoc(doc(db, "registros", id), { estado: "Finalizado", horaSalida: horaS, permanencia: perm });
        
        const qIng = query(collection(db, "ingresos"), where("tipo", "==", "ABASTECIMIENTO"), where("patente", "==", patente), where("estado", "==", "En Recinto"));
        const snapIng = await getDocs(qIng);
        snapIng.forEach(async (d) => {
            await updateDoc(doc(db, "ingresos", d.id), { estado: "Finalizado", horaSalida: horaS, permanencia: perm });
        });

        alert("✅ Salida confirmada para: " + patente);
    } catch (e) { alert("Error al procesar salida"); }
}
