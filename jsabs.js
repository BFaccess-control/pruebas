import { db } from './jslg.js';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { activarAutocompletadoRUT, activarAutocompletadoPatente, aprenderPatente } from './jsmtr.js';

export const inicializarAbastecimiento = () => {
    const form = document.getElementById('form-form-abastecimiento');
    if(!form) return;

    // Activar Autocompletados (Punto 1: Aprendizaje y sugerencias)
    activarAutocompletadoRUT('a-rut', 'a-sugerencias-rut');
    activarAutocompletadoPatente('a-patente', 'a-sugerencias-patente');
    activarAutocompletadoPatente('a-rampla', 'a-sugerencias-rampla');

    form.onsubmit = async (e) => {
        e.preventDefault();
        
        const patenteCamion = document.getElementById('a-patente').value.toUpperCase();
        const patenteRampla = document.getElementById('a-rampla').value.toUpperCase();

        // VALIDADOR DE SEGURIDAD (Punto 4: No permitir duplicados en recinto)
        const q = query(collection(db, "registros"), 
            where("tipo", "==", "ABASTECIMIENTO"),
            where("estado", "==", "En Recinto"),
            where("patente", "==", patenteCamion));
        
        const check = await getDocs(q);
        if(!check.empty) {
            alert("⚠️ El camión " + patenteCamion + " ya está en el recinto.");
            return;
        }

        const data = {
            tipo: "ABASTECIMIENTO",
            guardia: document.getElementById('a-guardia').value,
            rut: document.getElementById('a-rut').value,
            nombre: document.getElementById('a-nombre').value,
            guia: document.getElementById('a-guia').value,
            patente: patenteCamion,
            rampla: patenteRampla,
            horaIngreso: new Date().toLocaleTimeString('es-CL', {hour12:false}),
            fecha: new Date().toISOString().split('T')[0],
            estado: "En Recinto",
            horaSalida: "Pendiente",
            permanencia: "Calculando..."
        };

        await addDoc(collection(db, "registros"), data);
        await aprenderPatente(patenteCamion);
        if(patenteRampla) await aprenderPatente(patenteRampla);
        
        alert("✅ Ingreso registrado");
        form.reset();
        cargarCamionesEnRecinto();
    };
};

// LISTA EN RECINTO Y BOTÓN DE SALIDA (Punto 2)
export const cargarCamionesEnRecinto = async () => {
    const tabla = document.getElementById('tabla-abastecimiento-recinto');
    const q = query(collection(db, "registros"), 
                where("tipo", "==", "ABASTECIMIENTO"), 
                where("estado", "==", "En Recinto"));
    
    const snap = await getDocs(q);
    tabla.innerHTML = "";

    snap.forEach(res => {
        const d = res.data();
        const row = `
            <tr>
                <td>${d.nombre}<br><small>${d.rut}</small></td>
                <td>C: ${d.patente}${d.rampla ? '<br>R: '+d.rampla : ''}</td>
                <td>${d.horaIngreso}</td>
                <td><button class="btn-salida" data-id="${res.id}" data-ingreso="${d.horaIngreso}">Salida</button></td>
            </tr>`;
        tabla.innerHTML += row;
    });

    // Eventos para los botones de salida
    document.querySelectorAll('.btn-salida').forEach(btn => {
        btn.onclick = async (e) => {
            const id = e.target.dataset.id;
            const horaI = e.target.dataset.ingreso;
            const horaS = new Date().toLocaleTimeString('es-CL', {hour12:false});
            
            // Cálculo de permanencia (Punto 9)
            const [h1, m1] = horaI.split(':').map(Number);
            const [h2, m2] = horaS.split(':').map(Number);
            const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
            const perm = `${Math.floor(diff/60)}h ${diff%60}m`;

            await updateDoc(doc(db, "registros", id), {
                estado: "Finalizado",
                horaSalida: horaS,
                permanencia: perm
            });
            
            alert("✅ Salida registrada: " + horaS);
            cargarCamionesEnRecinto();
        };
    });
};
