import { db } from './jslg.js';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { guardarRegistro, aprenderPatente } from './jsmtr.js';

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
            estado: "En Recinto"
        };

        // Guardar en histórico (ingresos) y en activos (registros)
        await guardarRegistro(data);
        await addDoc(collection(db, "registros"), data);
        
        await aprenderPatente(patCamion);
        if(patRampla) await aprenderPatente(patRampla);
        
        e.target.reset();
        alert("✅ Ingreso de camión registrado");
    };
};

export const cargarCamionesEnRecinto = () => {
    const tabla = document.getElementById('tabla-abastecimiento-recinto');
    if (!tabla) return;

    const q = query(collection(db, "registros"), 
        where("tipo", "==", "ABASTECIMIENTO"), 
        where("estado", "==", "En Recinto"));

    onSnapshot(q, (snapshot) => {
        tabla.innerHTML = "";
        snapshot.forEach((docSnap) => {
            const res = docSnap.data();
            const fila = document.createElement('tr');
            fila.innerHTML = `
                <td>${res.nombre}<br><small>${res.rut}</small></td>
                <td>C: ${res.patente}<br>R: ${res.rampla || '---'}</td>
                <td>${res.hora || res.horaIngreso}</td>
                <td>
                    <button class="btn-salida-tabla" data-id="${docSnap.id}" data-patente="${res.patente}" data-hora="${res.hora || res.horaIngreso}">
                        Salida
                    </button>
                </td>
            `;
            tabla.appendChild(fila);
        });

        // Eventos para botones de salida
        document.querySelectorAll('.btn-salida-tabla').forEach(btn => {
            btn.onclick = () => marcarSalida(btn.dataset.id, btn.dataset.patente, btn.dataset.hora);
        });
    });
};

async function marcarSalida(id, patente, horaI) {
    const horaS = new Date().toLocaleTimeString('es-CL', { hour12: false, hour: '2-digit', minute: '2-digit' });
    
    // Cálculo de permanencia
    const [h1, m1] = horaI.split(':').map(Number);
    const [h2, m2] = horaS.split(':').map(Number);
    const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    const perm = `${Math.floor(diff/60)}h ${diff%60}m`;

    try {
        await updateDoc(doc(db, "registros", id), { estado: "Finalizado", horaSalida: horaS, permanencia: perm });
        
        // Actualizar el historial para el Excel
        const qIng = query(collection(db, "ingresos"), 
            where("tipo", "==", "ABASTECIMIENTO"),
            where("patente", "==", patente),
            where("estado", "==", "En Recinto"));
        const snapIng = await getDocs(qIng);
        snapIng.forEach(async (d) => {
            await updateDoc(doc(db, "ingresos", d.id), { estado: "Finalizado", horaSalida: horaS, permanencia: perm });
        });

        alert("✅ Salida registrada: " + horaS);
    } catch (e) { alert("Error al marcar salida"); }
}
