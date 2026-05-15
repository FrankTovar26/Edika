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

function obtenerUnidadesVinculadasSesion(sesion) {
    return sesion?.unidadesAutorizadas || [];
}

function obtenerIdsUnidadesVinculadas(sesion) {
    const ids = obtenerUnidadesVinculadasSesion(sesion)
        .map(unidad => String(unidad.unidadId))
        .filter(Boolean);

    if (sesion?.departamentoId) {
        ids.push(String(sesion.departamentoId));
    }

    return [...new Set(ids)];
}

function obtenerEdificiosVinculadosSesion(sesion) {
    const ids = obtenerUnidadesVinculadasSesion(sesion)
        .map(unidad => unidad.edificioId)
        .filter(Boolean)
        .map(String);

    if (sesion?.edificioId) {
        ids.push(String(sesion.edificioId));
    }

    return [...new Set(ids)];
}

function obtenerAreasPermitidasResidente(db, sesion) {
    const edificiosPermitidos = obtenerEdificiosVinculadosSesion(sesion);

    return (db.areasComunes || []).filter(area => {
        const perteneceEdificio =
            edificiosPermitidos.length === 0 ||
            edificiosPermitidos.includes(String(area.edificioId || ""));

        return perteneceEdificio &&
            normalizarEstadoArea(area.estado) === "disponible";
    });
}

function obtenerReservasPermitidasResidente(db, sesion) {
    const edificiosPermitidos = obtenerEdificiosVinculadosSesion(sesion);

    return (db.reservas || []).filter(reserva =>
        !reserva.edificioId ||
        edificiosPermitidos.includes(String(reserva.edificioId))
    );
}

function configurarFormularioReserva() {
    const form = document.getElementById("formReservaResidente");

    if (!form) return;

    form.addEventListener("submit", event => {
        event.preventDefault();

        const db = obtenerTodo();
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

        const area = obtenerAreasPermitidasResidente(db, sesion).find(a =>
            String(a.id) === String(areaId)
        );

        if (!area) {
            alert("El área seleccionada no pertenece a tus edificios vinculados o no está disponible.");
            return;
        }

        const unidadParaReserva = obtenerUnidadValidaParaReserva(db, sesion, area.edificioId);

        if (!unidadParaReserva) {
            alert("No tienes una unidad vinculada en el edificio de esta área.");
            return;
        }

        const datosReserva = {
            areaId,
            departamentoId: unidadParaReserva.id,
            edificioId: area.edificioId,
            fecha
        };

        const resultado = reservaId
            ? editarReservaArea(reservaId, datosReserva)
            : agregarReservaArea(datosReserva);

        if (!resultado.ok) {
            alert(resultado.error);
            return;
        }

        limpiarFormularioReserva();
        cargarPaginaReservas();

        alert(reservaId ? "Reserva actualizada correctamente." : "Reserva registrada correctamente.");
    });
}

function obtenerUnidadValidaParaReserva(db, sesion, edificioId) {
    const idsUnidades = obtenerIdsUnidadesVinculadas(sesion);

    const unidades = (db.departamentos || []).filter(unidad =>
        idsUnidades.includes(String(unidad.id)) &&
        String(unidad.edificioId || "") === String(edificioId || "")
    );

    const departamento = unidades.find(unidad =>
        normalizarTipoUnidad(unidad.tipo) === "departamento"
    );

    return departamento || unidades[0] || null;
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

    const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));
    const valorActual = select.value;

    const areasDisponibles = obtenerAreasPermitidasResidente(db, sesion);

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

    const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));

    let reservas = obtenerReservasPermitidasResidente(db, sesion);
    const areas = obtenerAreasPermitidasResidente(db, sesion);

    if (areaSeleccionada) {
        reservas = reservas.filter(reserva =>
            String(reserva.areaId) === String(areaSeleccionada)
        );
    }

    if (reservas.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="2">No hay reservas registradas para esta área.</td>
            </tr>
        `;
        return;
    }

    tabla.innerHTML = reservas.map(reserva => {
        const area = areas.find(a => String(a.id) === String(reserva.areaId));

        return `
            <tr>
                <td>${area?.nombre || "-"}</td>
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
    const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));

    const reserva = obtenerReservasDelResidente(db, sesion).find(r =>
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

    const db = obtenerTodo();
    const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));

    const reserva = obtenerReservasDelResidente(db, sesion).find(r =>
        String(r.id) === String(id)
    );

    if (!reserva) {
        alert("Reserva no encontrada o no pertenece a tus unidades vinculadas.");
        return;
    }

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
    const idsUnidades = obtenerIdsUnidadesVinculadas(sesion);
    const edificiosPermitidos = obtenerEdificiosVinculadosSesion(sesion);

    return (db.reservas || []).filter(reserva => {
        const perteneceUnidad = idsUnidades.includes(String(reserva.departamentoId));

        const perteneceEdificio =
            !reserva.edificioId ||
            edificiosPermitidos.includes(String(reserva.edificioId));

        return perteneceUnidad && perteneceEdificio;
    });
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

function normalizarTipoUnidad(tipo) {
    const valor = String(tipo || "").toLowerCase().trim();

    if (valor === "estacionamiento") return "estacionamiento";
    if (valor === "deposito" || valor === "depósito") return "deposito";
    if (valor === "oficina" || valor === "local") return "oficina";

    return "departamento";
}