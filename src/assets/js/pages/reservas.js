document.addEventListener("DOMContentLoaded", () => {
    protegerPaginaResidente();
    cargarPaginaReservas();
    configurarFormularioReserva();
    configurarFiltroPorArea();
    configurarFechaMinima();
});

function protegerPaginaResidente() {
    const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));

    if (!sesion) {
        window.location.href = "../../../index.html";
        return;
    }

    if (sesion.rol !== "residente") {
        alert("Esta vista corresponde al portal del residente.");
        window.location.href = "../admin/dashboard.html";
    }
}

function cargarPaginaReservas() {
    const db = obtenerTodo();

    cargarAreasDisponibles(db);
    renderizarReservasExistentes(db);
    renderizarMisReservas(db);
}

function configurarFormularioReserva() {
    const form = document.getElementById("formReservaResidente");

    if (!form) return;

    form.addEventListener("submit", event => {
        event.preventDefault();

        const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));
        const reservaId = document.getElementById("reservaId")?.value || "";
        const areaId = document.getElementById("areaReservaResidente").value;
        const fecha = document.getElementById("fechaReservaResidente").value;

        if (!areaId || !fecha) {
            alert("Selecciona un área y una fecha.");
            return;
        }

        if (fecha < obtenerFechaHoy()) {
            alert("No puedes registrar reservas en fechas pasadas.");
            return;
        }

        if (!sesion.departamentoId) {
            alert("Tu usuario no tiene una unidad vinculada.");
            return;
        }

        const resultado = reservaId
            ? editarReservaArea(reservaId, { areaId, fecha })
            : agregarReservaArea({
                areaId,
                departamentoId: sesion.departamentoId,
                fecha
            });

        if (!resultado.ok) {
            alert(resultado.error);
            return;
        }

        limpiarFormularioReserva();
        cargarPaginaReservas();

        alert(reservaId ? "Reserva actualizada correctamente." : "Reserva registrada correctamente.");
    });
}

function configurarFiltroPorArea() {
    const selectArea = document.getElementById("areaReservaResidente");

    if (!selectArea) return;

    selectArea.addEventListener("change", () => {
        renderizarReservasExistentes(obtenerTodo());
    });
}

function cargarAreasDisponibles(db) {
    const select = document.getElementById("areaReservaResidente");

    if (!select) return;

    const valorActual = select.value;

    const areasDisponibles = (db.areasComunes || []).filter(area =>
        normalizarEstadoArea(area.estado) === "disponible"
    );

    select.innerHTML = `<option value="">Seleccione un área</option>`;

    areasDisponibles.forEach(area => {
        select.innerHTML += `
            <option value="${area.id}">
                ${area.nombre}
            </option>
        `;
    });

    if (valorActual) {
        select.value = valorActual;
    }
}

function renderizarReservasExistentes(db) {
    const tabla = document.getElementById("tablaReservasExistentes");
    const areaSeleccionada = document.getElementById("areaReservaResidente")?.value;

    if (!tabla) return;

    let reservas = db.reservas || [];
    const areas = db.areasComunes || [];
    const departamentos = db.departamentos || [];

    if (areaSeleccionada) {
        reservas = reservas.filter(reserva =>
            String(reserva.areaId) === String(areaSeleccionada)
        );
    }

    if (reservas.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="3">No hay reservas registradas para esta área.</td>
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

function renderizarMisReservas(db) {
    const tabla = document.getElementById("tablaMisReservas");

    if (!tabla) return;

    const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));
    const reservas = obtenerReservasDelResidente(db, sesion);
    const areas = db.areasComunes || [];
    const departamentos = db.departamentos || [];

    if (reservas.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="5">No tienes reservas registradas.</td>
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
                <td>
                    <span class="badge vacio">
                        ${reserva.estado || "activa"}
                    </span>
                </td>
                <td>
                    <button class="btn btn-blue" onclick="cargarReservaParaEditar('${reserva.id}')">
                        Editar
                    </button>

                    <button class="btn btn-red" onclick="cancelarMiReserva('${reserva.id}')">
                        Cancelar
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

function cargarReservaParaEditar(id) {
    const db = obtenerTodo();

    const reserva = (db.reservas || []).find(r =>
        String(r.id) === String(id)
    );

    if (!reserva) {
        alert("Reserva no encontrada.");
        return;
    }

    document.getElementById("reservaId").value = reserva.id;
    document.getElementById("areaReservaResidente").value = reserva.areaId;
    document.getElementById("fechaReservaResidente").value = reserva.fecha;

    renderizarReservasExistentes(db);
}

function cancelarMiReserva(id) {
    const confirmar = confirm("¿Deseas cancelar esta reserva? La fecha quedará liberada.");

    if (!confirmar) return;

    const resultado = eliminarReservaArea(id);

    if (!resultado.ok) {
        alert(resultado.error);
        return;
    }

    limpiarFormularioReserva();
    cargarPaginaReservas();

    alert("Reserva cancelada correctamente.");
}

function limpiarFormularioReserva() {
    const form = document.getElementById("formReservaResidente");
    const reservaId = document.getElementById("reservaId");

    if (form) form.reset();
    if (reservaId) reservaId.value = "";
}

function obtenerReservasDelResidente(db, sesion) {
    return (db.reservas || []).filter(reserva =>
        String(reserva.departamentoId) === String(sesion?.departamentoId)
    );
}

function configurarFechaMinima() {
    const inputFecha = document.getElementById("fechaReservaResidente");

    if (!inputFecha) return;

    inputFecha.min = obtenerFechaHoy();
}

function obtenerFechaHoy() {
    const hoy = new Date();

    const year = hoy.getFullYear();
    const month = String(hoy.getMonth() + 1).padStart(2, "0");
    const day = String(hoy.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function normalizarEstadoArea(estado) {
    if (!estado) return "disponible";

    const valor = String(estado).toLowerCase().trim();

    if (valor === "disponible") return "disponible";
    if (valor === "no disponible") return "no_disponible";
    if (valor === "no_disponible") return "no_disponible";
    if (valor === "mantenimiento") return "no_disponible";

    return "disponible";
}