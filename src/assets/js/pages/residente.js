document.addEventListener("DOMContentLoaded", () => {
    protegerPaginaResidente();
    cargarVistaResidente();
});

function protegerPaginaResidente() {
    const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));

    if (!sesion) {
        window.location.href = "../../../index.html";
        return;
    }
}

function cargarVistaResidente() {
    const db = obtenerTodo();
    const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));

    document.getElementById("bienvenida").textContent =
        `Bienvenido, ${sesion?.nombre || "Residente"}`;

    cargarEstadisticasResidente(db);
    renderizarAreasResidente(db);
    renderizarReservasResidente(db);
}

function cargarEstadisticasResidente(db) {
    const areas = db.areasComunes || [];
    const reservas = db.reservas || [];

    document.getElementById("totalAreas").textContent = areas.length;
    document.getElementById("totalReservas").textContent = reservas.length;
}

function renderizarAreasResidente(db) {
    const tabla = document.getElementById("tablaAreasResidente");
    const areas = db.areasComunes || [];

    if (!tabla) return;

    if (areas.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="4">No hay áreas comunes registradas.</td>
            </tr>
        `;
        return;
    }

    tabla.innerHTML = areas.map(area => `
        <tr>
            <td>${area.nombre}</td>
            <td>${area.aforo}</td>
            <td>${area.descripcion || "-"}</td>
            <td>
                <span class="badge ${area.estado === "disponible" ? "vacio" : "ocupado"}">
                    ${area.estado === "disponible" ? "Disponible" : "No disponible"}
                </span>
            </td>
        </tr>
    `).join("");
}

function renderizarReservasResidente(db) {
    const tabla = document.getElementById("tablaReservasResidente");

    const reservas = db.reservas || [];
    const areas = db.areasComunes || [];
    const departamentos = db.departamentos || [];

    if (!tabla) return;

    if (reservas.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="3">No tienes reservas registradas.</td>
            </tr>
        `;
        return;
    }

    tabla.innerHTML = reservas.map(reserva => {
        const area = areas.find(a => String(a.id) === String(reserva.areaId));
        const departamento = departamentos.find(d => String(d.id) === String(reserva.departamentoId));

        return `
            <tr>
                <td>${area?.nombre || "-"}</td>
                <td>${departamento?.numero || "-"}</td>
                <td>${reserva.fecha || "-"}</td>
            </tr>
        `;
    }).join("");
}