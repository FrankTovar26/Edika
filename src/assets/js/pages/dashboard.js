document.addEventListener("DOMContentLoaded", () => {
    protegerPaginaAdmin();
    cargarDashboard();
    configurarEventosDashboard();
});

function protegerPaginaAdmin() {
    const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));

    if (!sesion) {
        window.location.href = "../../../index.html";
        return;
    }

    if (sesion.rol !== "admin") {
        alert("No tienes permisos para acceder a esta página.");
        window.location.href = "../residente/inicio.html";
    }
}

function cargarDashboard() {
    const db = obtenerTodo();

    cargarNombreEdificio(db);
    cargarFiltroPisos(db);
    cargarEstadisticas(db);
    renderizarUnidades(db);
}

function cargarNombreEdificio(db) {
    const titulo = document.getElementById("tituloEdificio");

    if (!titulo) return;

    titulo.textContent = db.configEdificio?.nombre || "Dashboard Administrador";
}

function cargarFiltroPisos(db) {
    const filtroPiso = document.getElementById("filtroPiso");

    if (!filtroPiso) return;

    filtroPiso.innerHTML = `<option value="">Todos</option>`;

    const pisos = db.configEdificio?.pisos || 0;

    for (let i = 1; i <= pisos; i++) {
        filtroPiso.innerHTML += `<option value="${i}">Piso ${i}</option>`;
    }
}

function cargarEstadisticas(db) {
    const unidades = db.departamentos || [];
    const total = unidades.length;
    const ocupadas = unidades.filter(u => u.residente).length;
    const porcentaje = total > 0 ? Math.round((ocupadas / total) * 100) : 0;

    document.getElementById("totalUnidades").textContent = total;
    document.getElementById("unidadesOcupadas").textContent = ocupadas;
    document.getElementById("porcentajeOcupacion").textContent = `${porcentaje}%`;
}

function renderizarUnidades(db) {
    const tabla = document.getElementById("tablaUnidades");
    if (!tabla) return;

    const filtroPiso = document.getElementById("filtroPiso").value;
    const filtroEstado = document.getElementById("filtroEstado").value;

    let unidades = db.departamentos || [];

    if (filtroPiso) {
        unidades = unidades.filter(u => String(u.piso) === String(filtroPiso));
    }

    if (filtroEstado) {
        unidades = unidades.filter(u => {
            const estado = u.residente ? "ocupado" : "vacio";
            return estado === filtroEstado;
        });
    }

    if (unidades.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="5">No hay unidades registradas.</td>
            </tr>
        `;
        return;
    }

    tabla.innerHTML = unidades.map(unidad => {
        const estado = unidad.residente ? "ocupado" : "vacio";
        const residente = unidad.residente || "Sin residente";

        return `
            <tr>
                <td>${unidad.numero || "-"}</td>
                <td>${unidad.piso || "-"}</td>
                <td>${residente}</td>
                <td>
                    <span class="badge ${estado}">
                        ${estado === "ocupado" ? "Ocupado" : "Vacío"}
                    </span>
                </td>
                <td>
                    <button class="btn btn-blue" onclick="abrirDetalleUnidad('${unidad.id}')">
                        Ver
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

function configurarEventosDashboard() {
    const filtroPiso = document.getElementById("filtroPiso");
    const filtroEstado = document.getElementById("filtroEstado");
    const cerrarModal = document.getElementById("cerrarModal");
    const modal = document.getElementById("modalDetalle");

    if (filtroPiso) {
        filtroPiso.addEventListener("change", () => {
            renderizarUnidades(obtenerTodo());
        });
    }

    if (filtroEstado) {
        filtroEstado.addEventListener("change", () => {
            renderizarUnidades(obtenerTodo());
        });
    }

    if (cerrarModal) {
        cerrarModal.addEventListener("click", cerrarDetalleUnidad);
    }

    if (modal) {
        modal.addEventListener("click", event => {
            if (event.target === modal) {
                cerrarDetalleUnidad();
            }
        });
    }
}

function abrirDetalleUnidad(idUnidad) {
    const db = obtenerTodo();
    const unidad = (db.departamentos || []).find(u => String(u.id) === String(idUnidad));

    if (!unidad) {
        alert("No se encontró la unidad.");
        return;
    }

    const detalle = document.getElementById("detalleUnidad");
    const modal = document.getElementById("modalDetalle");

    detalle.innerHTML = `
        <p><strong>Unidad:</strong> ${unidad.numero || "-"}</p>
        <p><strong>Piso:</strong> ${unidad.piso || "-"}</p>
        <p><strong>Residente:</strong> ${unidad.residente || "Sin residente"}</p>
        <p><strong>Estado:</strong> ${unidad.residente ? "Ocupado" : "Vacío"}</p>
    `;

    modal.style.display = "flex";
}

function cerrarDetalleUnidad() {
    const modal = document.getElementById("modalDetalle");
    modal.style.display = "none";
}