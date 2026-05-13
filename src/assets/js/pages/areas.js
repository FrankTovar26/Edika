document.addEventListener("DOMContentLoaded", () => {
    protegerPaginaAdmin();
    configurarFormularioArea();
    configurarFormularioReserva();
    cargarSelectsReserva();
    renderizarAreas();
    renderizarReservas();
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

function configurarFormularioArea() {
    const form = document.getElementById("formArea");

    if (!form) return;

    form.addEventListener("submit", event => {
        event.preventDefault();

        const nombre = document.getElementById("nombreArea").value.trim();
        const aforo = document.getElementById("aforoArea").value;
        const descripcion = document.getElementById("descripcionArea").value.trim();
        const estado = document.getElementById("estadoArea").value;

        const resultado = agregarAreaComun({
            nombre,
            aforo,
            descripcion,
            estado
        });

        if (!resultado.ok) {
            alert(resultado.error);
            return;
        }

        form.reset();
        renderizarAreas();
        cargarSelectsReserva();

        alert("Área común registrada correctamente.");
    });
}

function configurarFormularioReserva() {
    const form = document.getElementById("formReserva");

    if (!form) return;

    form.addEventListener("submit", event => {
        event.preventDefault();

        const reservaId = document.getElementById("reservaAdminId").value;
        const areaId = document.getElementById("areaReserva").value;
        const departamentoId = document.getElementById("departamentoReserva").value;
        const fecha = document.getElementById("fechaReserva").value;

        if (!areaId || !departamentoId || !fecha) {
            alert("Completa todos los campos de la reserva.");
            return;
        }

        const db = obtenerTodo();
        const area = (db.areasComunes || []).find(a => String(a.id) === String(areaId));

        if (!area || normalizarEstadoArea(area.estado) !== "disponible") {
            alert("Esta área no está disponible para reservas.");
            return;
        }

        const resultado = reservaId
            ? editarReservaArea(reservaId, { areaId, departamentoId, fecha })
            : agregarReservaArea({ areaId, departamentoId, fecha });

        if (!resultado.ok) {
            alert(resultado.error);
            return;
        }

        limpiarFormularioReservaAdmin();
        renderizarReservas();

        alert(reservaId ? "Reserva actualizada correctamente." : "Reserva registrada correctamente.");
    });
}

function cargarSelectsReserva() {
    const db = obtenerTodo();

    const selectArea = document.getElementById("areaReserva");
    const selectDepartamento = document.getElementById("departamentoReserva");

    if (selectArea) {
        const areasDisponibles = (db.areasComunes || []).filter(area =>
            normalizarEstadoArea(area.estado) === "disponible"
        );

        selectArea.innerHTML = `<option value="">Seleccione un área</option>`;

        areasDisponibles.forEach(area => {
            selectArea.innerHTML += `
                <option value="${area.id}">
                    ${area.nombre}
                </option>
            `;
        });
    }

    if (selectDepartamento) {
        const departamentos = db.departamentos || [];

        selectDepartamento.innerHTML = `<option value="">Seleccione unidad</option>`;

        departamentos.forEach(dep => {
            selectDepartamento.innerHTML += `
                <option value="${dep.id}">
                    ${dep.numero}
                </option>
            `;
        });
    }
}

function renderizarAreas() {
    const db = obtenerTodo();
    const tabla = document.getElementById("tablaAreas");

    if (!tabla) return;

    const areas = db.areasComunes || [];

    if (areas.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="5">No hay áreas comunes registradas.</td>
            </tr>
        `;
        return;
    }

    tabla.innerHTML = areas.map(area => {
        const estado = normalizarEstadoArea(area.estado);
        const disponible = estado === "disponible";

        return `
            <tr>
                <td><strong>${area.nombre}</strong></td>
                <td>${area.aforo}</td>
                <td>${area.descripcion || "-"}</td>
                <td>
                    <span class="badge ${disponible ? "vacio" : "ocupado"}">
                        ${disponible ? "Disponible" : "No disponible"}
                    </span>
                </td>
                <td>
                    <button class="btn btn-blue" onclick="cambiarEstadoArea('${area.id}')">
                        ${disponible ? "Bloquear" : "Habilitar"}
                    </button>

                    <button class="btn btn-red" onclick="eliminarArea('${area.id}')">
                        Eliminar
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

function renderizarReservas() {
    const db = obtenerTodo();
    const tabla = document.getElementById("tablaReservas");

    if (!tabla) return;

    const reservas = db.reservas || [];
    const areas = db.areasComunes || [];
    const departamentos = db.departamentos || [];

    if (reservas.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="5">No hay reservas registradas.</td>
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
                <td>${reserva.fecha}</td>
                <td>
                    <button class="btn btn-blue" onclick="cargarReservaAdminParaEditar('${reserva.id}')">
                        Editar
                    </button>

                    <button class="btn btn-red" onclick="eliminarReserva('${reserva.id}')">
                        Cancelar
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

function cambiarEstadoArea(id) {
    const db = obtenerTodo();

    const area = (db.areasComunes || []).find(a => String(a.id) === String(id));

    if (!area) {
        alert("Área no encontrada.");
        return;
    }

    const estadoActual = normalizarEstadoArea(area.estado);

    area.estado = estadoActual === "disponible"
        ? "no_disponible"
        : "disponible";

    guardarTodo(db);

    renderizarAreas();
    cargarSelectsReserva();

    alert("Estado del área actualizado.");
}

function eliminarArea(id) {
    const confirmar = confirm("¿Deseas eliminar esta área común?");

    if (!confirmar) return;

    const resultado = eliminarAreaComun(id);

    if (!resultado.ok) {
        alert(resultado.error);
        return;
    }

    renderizarAreas();
    cargarSelectsReserva();
}

function eliminarReserva(id) {
    const confirmar = confirm("¿Deseas eliminar esta reserva?");

    if (!confirmar) return;

    const resultado = eliminarReservaArea(id);

    if (!resultado.ok) {
        alert(resultado.error);
        return;
    }

    renderizarReservas();
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

function cargarReservaAdminParaEditar(id) {
    const db = obtenerTodo();

    const reserva = (db.reservas || []).find(r => String(r.id) === String(id));

    if (!reserva) {
        alert("Reserva no encontrada.");
        return;
    }

    document.getElementById("reservaAdminId").value = reserva.id;
    document.getElementById("areaReserva").value = reserva.areaId;
    document.getElementById("departamentoReserva").value = reserva.departamentoId;
    document.getElementById("fechaReserva").value = reserva.fecha;

    window.scrollTo({
        top: document.getElementById("formReserva").offsetTop - 80,
        behavior: "smooth"
    });
}

function limpiarFormularioReservaAdmin() {
    const form = document.getElementById("formReserva");
    const reservaId = document.getElementById("reservaAdminId");

    if (form) form.reset();
    if (reservaId) reservaId.value = "";
}