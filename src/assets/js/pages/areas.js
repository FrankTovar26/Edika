document.addEventListener("DOMContentLoaded", () => {
    protegerPaginaAdmin();

    inicializarDatosAreas();

    configurarFormularioArea();
    configurarFormularioReserva();
    configurarFormularioMantenimiento();
    configurarCambioEdificioArea();
    configurarModalRechazoReserva();

    cargarSelectEdificiosArea();
    cargarSelectsReserva();
    cargarSelectsMantenimiento();

    renderizarAreas();
    renderizarReservas();
    renderizarMantenimientosAreas();
});

function protegerPaginaAdmin() {
    const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));

    if (!sesion) {
        window.location.href = "../../../index.html";
        return;
    }

    if (sesion.rol !== "admin" && sesion.rol !== "superadmin") {
        alert("No tienes permisos para acceder a esta página.");
        window.location.href = "../residente/inicio.html";
    }
}

function inicializarDatosAreas() {
    const db = obtenerTodo();

    db.areasComunes = db.areasComunes || [];
    db.reservas = db.reservas || [];
    db.mantenimientosAreas = db.mantenimientosAreas || [];
    db.anuncios = db.anuncios || [];

    db.reservas.forEach(reserva => {
        reserva.estado = normalizarEstadoReserva(reserva.estado || "aprobada");
        reserva.observacion = reserva.observacion || "";
        reserva.motivoRechazo = reserva.motivoRechazo || "";
    });

    guardarTodo(db);
}

/* =========================
   EDIFICIOS / PERMISOS
========================= */

function configurarCambioEdificioArea() {
    const select = document.getElementById("edificioArea");

    if (!select) return;

    select.addEventListener("change", () => {
        cargarSelectsReserva();
        cargarSelectsMantenimiento();
        renderizarAreas();
        renderizarReservas();
        renderizarMantenimientosAreas();
    });
}

function cargarSelectEdificiosArea() {
    const db = obtenerTodo();
    const select = document.getElementById("edificioArea");

    if (!select) return;

    const edificios = obtenerEdificiosPermitidosObjetos(db);
    const valorActual = select.value;

    select.innerHTML = `<option value="">Seleccione edificio...</option>`;

    edificios.forEach(edificio => {
        select.innerHTML += `
            <option value="${edificio.id}">
                ${edificio.nombre}
            </option>
        `;
    });

    if (edificios.some(e => String(e.id) === String(valorActual))) {
        select.value = valorActual;
    } else if (edificios.length === 1) {
        select.value = edificios[0].id;
    }
}

function obtenerIdsEdificiosAsignadosSesion(sesion) {
    if (!sesion) return [];

    if (Array.isArray(sesion.edificioIds) && sesion.edificioIds.length > 0) {
        return sesion.edificioIds.filter(Boolean).map(String);
    }

    if (sesion.edificioId) {
        return [String(sesion.edificioId)];
    }

    return [];
}

function obtenerEdificiosPermitidosAreas() {
    const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));
    const db = obtenerTodo();

    if (!sesion) return [];

    const edificios = db.edificios || [];

    if (sesion.rol === "superadmin") {
        return edificios
            .filter(edificio => edificio.activo !== false)
            .map(edificio => String(edificio.id));
    }

    if (sesion.rol === "admin") {
        const asignados = obtenerIdsEdificiosAsignadosSesion(sesion);

        return edificios
            .filter(edificio =>
                edificio.activo !== false &&
                asignados.includes(String(edificio.id))
            )
            .map(edificio => String(edificio.id));
    }

    return [];
}

function obtenerEdificiosPermitidosObjetos(db) {
    const permitidos = obtenerEdificiosPermitidosAreas();

    return (db.edificios || []).filter(edificio =>
        permitidos.includes(String(edificio.id))
    );
}

function obtenerEdificioSeleccionadoArea() {
    const select = document.getElementById("edificioArea");

    if (select && select.value) {
        return select.value;
    }

    const permitidos = obtenerEdificiosPermitidosAreas();

    return permitidos[0] || null;
}

function obtenerAreasPermitidas(db) {
    const permitidos = obtenerEdificiosPermitidosAreas();
    const edificioSeleccionado = document.getElementById("edificioArea")?.value || "";

    let areas = db.areasComunes || [];

    areas = areas.filter(area =>
        permitidos.includes(String(area.edificioId || ""))
    );

    if (edificioSeleccionado) {
        areas = areas.filter(area =>
            String(area.edificioId) === String(edificioSeleccionado)
        );
    }

    return areas;
}

function obtenerDepartamentosPermitidosAreas(db) {
    const permitidos = obtenerEdificiosPermitidosAreas();
    const edificioSeleccionado = document.getElementById("edificioArea")?.value || "";

    let unidades = db.departamentos || [];

    unidades = unidades.filter(dep =>
        permitidos.includes(String(dep.edificioId || ""))
    );

    unidades = unidades.filter(dep => {
        const tipo = normalizarTipoUnidad(dep.tipo);
        return tipo === "departamento" || tipo === "oficina";
    });

    if (edificioSeleccionado) {
        unidades = unidades.filter(dep =>
            String(dep.edificioId) === String(edificioSeleccionado)
        );
    }

    return unidades;
}

/* =========================
   ÁREAS
========================= */

function configurarFormularioArea() {
    const form = document.getElementById("formArea");

    if (!form) return;

    form.addEventListener("submit", event => {
        event.preventDefault();

        const nombre = document.getElementById("nombreArea").value.trim();
        const aforo = Number(document.getElementById("aforoArea").value);
        const descripcion = document.getElementById("descripcionArea").value.trim();
        const estado = document.getElementById("estadoArea").value;
        const edificioId = obtenerEdificioSeleccionadoArea();

        if (!edificioId) {
            alert("Selecciona el edificio al que pertenece el área.");
            return;
        }

        if (!nombre) {
            alert("Ingresa el nombre del área común.");
            return;
        }

        if (!aforo || aforo < 1) {
            alert("Ingresa un aforo válido.");
            return;
        }

        const resultado = agregarAreaComunSeguro({
            edificioId,
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

        cargarSelectEdificiosArea();
        cargarSelectsReserva();
        cargarSelectsMantenimiento();
        renderizarAreas();

        alert("Área común registrada correctamente.");
    });
}

function agregarAreaComunSeguro(area) {
    if (typeof agregarAreaComun === "function") {
        return agregarAreaComun(area);
    }

    const db = obtenerTodo();

    db.areasComunes = db.areasComunes || [];

    const existe = db.areasComunes.some(item =>
        String(item.edificioId) === String(area.edificioId) &&
        item.nombre.trim().toLowerCase() === area.nombre.trim().toLowerCase()
    );

    if (existe) {
        return {
            ok: false,
            error: "Ya existe un área común con ese nombre en este edificio."
        };
    }

    db.areasComunes.push({
        id: generarId(),
        edificioId: area.edificioId,
        nombre: area.nombre,
        aforo: Number(area.aforo),
        descripcion: area.descripcion || "",
        estado: normalizarEstadoArea(area.estado),
        fechaRegistro: new Date().toISOString()
    });

    guardarTodo(db);

    return { ok: true };
}

function renderizarAreas() {
    const db = obtenerTodo();
    const tabla = document.getElementById("tablaAreas");

    if (!tabla) return;

    const areas = obtenerAreasPermitidas(db);

    if (areas.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="6">No hay áreas comunes registradas para tus edificios.</td>
            </tr>
        `;
        return;
    }

    tabla.innerHTML = areas.map(area => {
        const estado = normalizarEstadoArea(area.estado);
        const edificio = obtenerNombreEdificio(db, area.edificioId);
        const clase = claseEstadoArea(estado);

        return `
            <tr>
                <td><strong>${area.nombre}</strong></td>
                <td>${edificio}</td>
                <td>${area.aforo}</td>
                <td>${area.descripcion || "-"}</td>
                <td>
                    <span class="badge ${clase}">
                        ${formatearEstadoArea(estado)}
                    </span>
                </td>
                <td>
                    <button class="btn btn-blue" onclick="cambiarEstadoArea('${area.id}')">
                        ${estado === "disponible" ? "Bloquear" : "Habilitar"}
                    </button>

                    <button class="btn btn-red" onclick="eliminarArea('${area.id}')">
                        Eliminar
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

function cambiarEstadoArea(id) {
    const db = obtenerTodo();

    const area = obtenerAreasPermitidas(db).find(a =>
        String(a.id) === String(id)
    );

    if (!area) {
        alert("Área no encontrada.");
        return;
    }

    const estadoActual = normalizarEstadoArea(area.estado);

    area.estado = estadoActual === "disponible"
        ? "bloqueada"
        : "disponible";

    guardarTodo(db);

    renderizarAreas();
    cargarSelectsReserva();
    cargarSelectsMantenimiento();

    alert("Estado del área actualizado.");
}

function eliminarArea(id) {
    const confirmar = confirm("¿Deseas eliminar esta área común?");

    if (!confirmar) return;

    const resultado = eliminarAreaComunSeguro(id);

    if (!resultado.ok) {
        alert(resultado.error);
        return;
    }

    renderizarAreas();
    cargarSelectsReserva();
    cargarSelectsMantenimiento();

    alert("Área común eliminada correctamente.");
}

function eliminarAreaComunSeguro(id) {
    if (typeof eliminarAreaComun === "function") {
        return eliminarAreaComun(id);
    }

    const db = obtenerTodo();

    const tieneReservas = (db.reservas || []).some(reserva =>
        String(reserva.areaId) === String(id)
    );

    const tieneMantenimientos = (db.mantenimientosAreas || []).some(mantenimiento =>
        String(mantenimiento.areaId) === String(id)
    );

    if (tieneReservas || tieneMantenimientos) {
        return {
            ok: false,
            error: "No puedes eliminar esta área porque tiene reservas o mantenimientos registrados."
        };
    }

    db.areasComunes = (db.areasComunes || []).filter(area =>
        String(area.id) !== String(id)
    );

    guardarTodo(db);

    return { ok: true };
}

/* =========================
   RESERVAS
========================= */

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

        const area = obtenerAreasPermitidas(db).find(a =>
            String(a.id) === String(areaId)
        );

        if (!area || normalizarEstadoArea(area.estado) !== "disponible") {
            alert("Esta área no está disponible para reservas.");
            return;
        }

        const unidad = obtenerDepartamentosPermitidosAreas(db).find(dep =>
            String(dep.id) === String(departamentoId)
        );

        if (!unidad) {
            alert("Selecciona un departamento u oficina válida.");
            return;
        }

        if (String(unidad.edificioId) !== String(area.edificioId)) {
            alert("El área y la unidad deben pertenecer al mismo edificio.");
            return;
        }

        const cruceReserva = existeReservaAprobada(db, areaId, fecha, reservaId);

        if (cruceReserva) {
            alert("Ya existe una reserva aprobada para esta área en la fecha seleccionada.");
            return;
        }

        const cruceMantenimiento = existeMantenimientoProgramado(db, areaId, fecha, fecha);

        if (cruceMantenimiento) {
            alert("No se puede reservar esta área porque tiene mantenimiento programado en esa fecha.");
            return;
        }

        const reservaData = {
            areaId,
            departamentoId,
            fecha,
            edificioId: area.edificioId,
            estado: "aprobada",
            observacion: "",
            motivoRechazo: ""
        };

        const resultado = reservaId
            ? editarReservaAreaSeguro(reservaId, reservaData)
            : agregarReservaAreaSeguro(reservaData);

        if (!resultado.ok) {
            alert(resultado.error);
            return;
        }

        limpiarFormularioReservaAdmin();
        cargarSelectsReserva();
        renderizarReservas();

        alert(
            reservaId
                ? "Reserva actualizada correctamente."
                : "Reserva aprobada y registrada correctamente."
        );
    });
}

function agregarReservaAreaSeguro(reservaData) {
    if (typeof agregarReservaArea === "function") {
        return agregarReservaArea({
            ...reservaData,
            estado: "aprobada"
        });
    }

    const db = obtenerTodo();

    db.reservas = db.reservas || [];

    const duplicada = db.reservas.some(reserva =>
        String(reserva.areaId) === String(reservaData.areaId) &&
        String(reserva.fecha) === String(reservaData.fecha) &&
        normalizarEstadoReserva(reserva.estado) === "aprobada"
    );

    if (duplicada) {
        return {
            ok: false,
            error: "Ya existe una reserva aprobada para esta área en la fecha seleccionada."
        };
    }

    db.reservas.push({
        id: generarId(),
        ...reservaData,
        estado: "aprobada",
        fechaRegistro: new Date().toISOString()
    });

    guardarTodo(db);

    return { ok: true };
}

function editarReservaAreaSeguro(id, reservaData) {
    if (typeof editarReservaArea === "function") {
        return editarReservaArea(id, reservaData);
    }

    const db = obtenerTodo();

    const reserva = (db.reservas || []).find(r =>
        String(r.id) === String(id)
    );

    if (!reserva) {
        return {
            ok: false,
            error: "Reserva no encontrada."
        };
    }

    reserva.areaId = reservaData.areaId;
    reserva.departamentoId = reservaData.departamentoId;
    reserva.fecha = reservaData.fecha;
    reserva.edificioId = reservaData.edificioId;
    reserva.estado = reservaData.estado || "aprobada";
    reserva.observacion = reservaData.observacion || "";
    reserva.motivoRechazo = reservaData.motivoRechazo || "";

    guardarTodo(db);

    return { ok: true };
}

function renderizarReservas() {
    const db = obtenerTodo();
    const tabla = document.getElementById("tablaReservas");

    if (!tabla) return;

    const permitidos = obtenerEdificiosPermitidosAreas();
    const edificioSeleccionado = document.getElementById("edificioArea")?.value || "";

    let reservas = db.reservas || [];

    reservas = reservas.filter(reserva =>
        permitidos.includes(String(reserva.edificioId || ""))
    );

    if (edificioSeleccionado) {
        reservas = reservas.filter(reserva =>
            String(reserva.edificioId) === String(edificioSeleccionado)
        );
    }

    const areas = db.areasComunes || [];
    const departamentos = db.departamentos || [];

    if (reservas.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="7">No hay reservas registradas.</td>
            </tr>
        `;
        return;
    }

    reservas.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

    tabla.innerHTML = reservas.map(reserva => {
        const area = areas.find(a => String(a.id) === String(reserva.areaId));
        const departamento = departamentos.find(d => String(d.id) === String(reserva.departamentoId));
        const edificio = obtenerNombreEdificio(db, reserva.edificioId);
        const estado = normalizarEstadoReserva(reserva.estado);

        return `
            <tr>
                <td>${area?.nombre || "-"}</td>
                <td>${edificio}</td>
                <td>
                    ${departamento?.numero || "-"}<br>
                    <small>${formatearTipoUnidad(normalizarTipoUnidad(departamento?.tipo))}</small>
                </td>
                <td>${formatearFechaReserva(reserva.fecha)}</td>
                <td>
                    <span class="badge ${claseEstadoReserva(estado)}">
                        ${formatearEstadoReserva(estado)}
                    </span>
                </td>
                <td>${reserva.observacion || "-"}</td>
                <td>
                    <button class="btn btn-blue" onclick="cargarReservaAdminParaEditar('${reserva.id}')">
                        Editar
                    </button>

                    ${
                        estado === "aprobada"
                            ? `
                                <button class="btn btn-red" onclick="abrirModalRechazarReserva('${reserva.id}')">
                                    Rechazar
                                </button>
                            `
                            : ""
                    }

                    ${
                        estado !== "cancelada"
                            ? `
                                <button class="btn btn-secondary" onclick="cancelarReserva('${reserva.id}')">
                                    Cancelar
                                </button>
                            `
                            : ""
                    }
                </td>
            </tr>
        `;
    }).join("");
}

function cargarReservaAdminParaEditar(id) {
    const db = obtenerTodo();

    const reserva = (db.reservas || []).find(r =>
        String(r.id) === String(id)
    );

    if (!reserva) {
        alert("Reserva no encontrada.");
        return;
    }

    const selectEdificio = document.getElementById("edificioArea");

    if (selectEdificio) {
        selectEdificio.value = reserva.edificioId;
    }

    cargarSelectsReserva();

    document.getElementById("reservaAdminId").value = reserva.id;
    document.getElementById("areaReserva").value = reserva.areaId;
    document.getElementById("departamentoReserva").value = reserva.departamentoId;
    document.getElementById("fechaReserva").value = reserva.fecha;

    window.scrollTo({
        top: document.getElementById("formReserva").offsetTop - 80,
        behavior: "smooth"
    });
}

function cancelarReserva(id) {
    const confirmar = confirm("¿Deseas cancelar esta reserva?");

    if (!confirmar) return;

    const db = obtenerTodo();
    const reserva = (db.reservas || []).find(r => String(r.id) === String(id));

    if (!reserva) {
        alert("Reserva no encontrada.");
        return;
    }

    reserva.estado = "cancelada";
    reserva.observacion = reserva.observacion || "Reserva cancelada por administración.";
    reserva.fechaActualizacion = new Date().toISOString();

    guardarTodo(db);

    renderizarReservas();

    alert("Reserva cancelada correctamente.");
}

function limpiarFormularioReservaAdmin() {
    const form = document.getElementById("formReserva");
    const reservaId = document.getElementById("reservaAdminId");

    if (form) form.reset();
    if (reservaId) reservaId.value = "";
}

/* =========================
   RECHAZO DE RESERVA
========================= */

function configurarModalRechazoReserva() {
    const cerrar = document.getElementById("cerrarModalRechazo");
    const cancelar = document.getElementById("btnCancelarRechazoReserva");
    const confirmar = document.getElementById("btnConfirmarRechazoReserva");

    if (cerrar) cerrar.addEventListener("click", cerrarModalRechazarReserva);
    if (cancelar) cancelar.addEventListener("click", cerrarModalRechazarReserva);
    if (confirmar) confirmar.addEventListener("click", confirmarRechazoReserva);
}

function abrirModalRechazarReserva(id) {
    const modal = document.getElementById("modalRechazarReserva");

    if (!modal) return;

    document.getElementById("reservaRechazoId").value = id;
    document.getElementById("motivoRechazoReserva").value = "";
    document.getElementById("observacionRechazoReserva").value = "";

    modal.style.display = "flex";
}

function cerrarModalRechazarReserva() {
    const modal = document.getElementById("modalRechazarReserva");

    if (modal) modal.style.display = "none";
}

function confirmarRechazoReserva() {
    const id = document.getElementById("reservaRechazoId").value;
    const motivo = document.getElementById("motivoRechazoReserva").value;
    const observacion = document.getElementById("observacionRechazoReserva").value.trim();

    if (!id || !motivo || !observacion) {
        alert("Selecciona un motivo e ingresa una observación.");
        return;
    }

    const db = obtenerTodo();

    const reserva = (db.reservas || []).find(r =>
        String(r.id) === String(id)
    );

    if (!reserva) {
        alert("Reserva no encontrada.");
        return;
    }

    reserva.estado = "rechazada";
    reserva.motivoRechazo = motivo;
    reserva.observacion = observacion;
    reserva.fechaActualizacion = new Date().toISOString();

    crearAnuncioReservaRechazada(db, reserva, observacion);

    guardarTodo(db);

    cerrarModalRechazarReserva();
    renderizarReservas();

    alert("Reserva rechazada y anuncio enviado al residente.");
}

/* =========================
   MANTENIMIENTO
========================= */

function configurarFormularioMantenimiento() {
    const form = document.getElementById("formMantenimientoArea");

    if (!form) return;

    form.addEventListener("submit", event => {
        event.preventDefault();

        const areaId = document.getElementById("areaMantenimiento").value;
        const fechaInicio = document.getElementById("fechaInicioMantenimiento").value;
        const fechaFin = document.getElementById("fechaFinMantenimiento").value;
        const motivo = document.getElementById("motivoMantenimiento").value;
        const descripcion = document.getElementById("descripcionMantenimiento").value.trim();
        const notificar = document.getElementById("notificarMantenimiento").value;

        if (!areaId || !fechaInicio || !fechaFin || !motivo || !descripcion) {
            alert("Completa todos los campos del mantenimiento.");
            return;
        }

        if (fechaFin < fechaInicio) {
            alert("La fecha fin no puede ser anterior a la fecha inicio.");
            return;
        }

        const db = obtenerTodo();

        const area = obtenerAreasPermitidas(db).find(a =>
            String(a.id) === String(areaId)
        );

        if (!area) {
            alert("Área no encontrada.");
            return;
        }

        const reservasCruzadas = obtenerReservasAprobadasEnRango(db, areaId, fechaInicio, fechaFin);

        if (reservasCruzadas.length > 0) {
            const confirmar = confirm(
                `Ya existen ${reservasCruzadas.length} reserva(s) aprobada(s) en ese periodo. ` +
                "Se recomienda rechazar o reprogramar esas reservas antes de crear el mantenimiento. ¿Deseas continuar de todas formas?"
            );

            if (!confirmar) return;
        }

        db.mantenimientosAreas = db.mantenimientosAreas || [];

        const mantenimiento = {
            id: generarId(),
            areaId,
            edificioId: area.edificioId,
            fechaInicio,
            fechaFin,
            motivo,
            descripcion,
            estado: "programado",
            notificarResidentes: notificar,
            creadoPor: obtenerSesionActual()?.id || "sistema",
            fechaRegistro: new Date().toISOString()
        };

        db.mantenimientosAreas.push(mantenimiento);

        if (notificar === "si") {
            crearAnuncioMantenimientoArea(db, mantenimiento, area);
        }

        guardarTodo(db);

        form.reset();

        cargarSelectsReserva();
        cargarSelectsMantenimiento();
        renderizarMantenimientosAreas();

        alert(
            notificar === "si"
                ? "Mantenimiento programado y anuncio enviado a residentes."
                : "Mantenimiento programado correctamente."
        );
    });
}

function cargarSelectsMantenimiento() {
    const db = obtenerTodo();
    const select = document.getElementById("areaMantenimiento");

    if (!select) return;

    const areas = obtenerAreasPermitidas(db);

    select.innerHTML = `<option value="">Seleccione un área</option>`;

    areas.forEach(area => {
        const edificio = obtenerNombreEdificio(db, area.edificioId);

        select.innerHTML += `
            <option value="${area.id}">
                ${area.nombre} - ${edificio}
            </option>
        `;
    });
}

function renderizarMantenimientosAreas() {
    const db = obtenerTodo();
    const tabla = document.getElementById("tablaMantenimientosAreas");

    if (!tabla) return;

    const permitidos = obtenerEdificiosPermitidosAreas();
    const edificioSeleccionado = document.getElementById("edificioArea")?.value || "";

    let mantenimientos = db.mantenimientosAreas || [];

    mantenimientos = mantenimientos.filter(m =>
        permitidos.includes(String(m.edificioId || ""))
    );

    if (edificioSeleccionado) {
        mantenimientos = mantenimientos.filter(m =>
            String(m.edificioId) === String(edificioSeleccionado)
        );
    }

    if (mantenimientos.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="6">No hay mantenimientos registrados.</td>
            </tr>
        `;
        return;
    }

    mantenimientos.sort((a, b) => String(b.fechaInicio).localeCompare(String(a.fechaInicio)));

    tabla.innerHTML = mantenimientos.map(mantenimiento => {
        const area = (db.areasComunes || []).find(a =>
            String(a.id) === String(mantenimiento.areaId)
        );

        const edificio = obtenerNombreEdificio(db, mantenimiento.edificioId);

        return `
            <tr>
                <td>${area?.nombre || "-"}</td>
                <td>${edificio}</td>
                <td>
                    ${formatearFechaReserva(mantenimiento.fechaInicio)}
                    ${
                        mantenimiento.fechaInicio !== mantenimiento.fechaFin
                            ? ` al ${formatearFechaReserva(mantenimiento.fechaFin)}`
                            : ""
                    }
                </td>
                <td>
                    ${formatearMotivoMantenimiento(mantenimiento.motivo)}<br>
                    <small>${mantenimiento.descripcion || "-"}</small>
                </td>
                <td>
                    <span class="badge ${claseEstadoMantenimiento(mantenimiento.estado)}">
                        ${formatearEstadoMantenimiento(mantenimiento.estado)}
                    </span>
                </td>
                <td>
                    ${
                        mantenimiento.estado === "programado"
                            ? `
                                <button class="btn btn-green" onclick="finalizarMantenimientoArea('${mantenimiento.id}')">
                                    Finalizar
                                </button>
                                <button class="btn btn-red" onclick="cancelarMantenimientoArea('${mantenimiento.id}')">
                                    Cancelar
                                </button>
                            `
                            : "-"
                    }
                </td>
            </tr>
        `;
    }).join("");
}

function finalizarMantenimientoArea(id) {
    const db = obtenerTodo();
    const mantenimiento = (db.mantenimientosAreas || []).find(m =>
        String(m.id) === String(id)
    );

    if (!mantenimiento) return;

    mantenimiento.estado = "finalizado";
    mantenimiento.fechaActualizacion = new Date().toISOString();

    guardarTodo(db);
    renderizarMantenimientosAreas();

    alert("Mantenimiento finalizado correctamente.");
}

function cancelarMantenimientoArea(id) {
    const confirmar = confirm("¿Deseas cancelar este mantenimiento?");

    if (!confirmar) return;

    const db = obtenerTodo();
    const mantenimiento = (db.mantenimientosAreas || []).find(m =>
        String(m.id) === String(id)
    );

    if (!mantenimiento) return;

    mantenimiento.estado = "cancelado";
    mantenimiento.fechaActualizacion = new Date().toISOString();

    guardarTodo(db);
    renderizarMantenimientosAreas();

    alert("Mantenimiento cancelado correctamente.");
}

/* =========================
   SELECTS
========================= */

function cargarSelectsReserva() {
    const db = obtenerTodo();

    const selectArea = document.getElementById("areaReserva");
    const selectDepartamento = document.getElementById("departamentoReserva");

    const areasDisponibles = obtenerAreasPermitidas(db).filter(area =>
        normalizarEstadoArea(area.estado) === "disponible"
    );

    if (selectArea) {
        selectArea.innerHTML = `<option value="">Seleccione un área</option>`;

        areasDisponibles.forEach(area => {
            const edificio = obtenerNombreEdificio(db, area.edificioId);

            selectArea.innerHTML += `
                <option value="${area.id}">
                    ${area.nombre} - ${edificio}
                </option>
            `;
        });
    }

    if (selectDepartamento) {
        const unidades = obtenerDepartamentosPermitidosAreas(db);

        selectDepartamento.innerHTML = `<option value="">Seleccione departamento u oficina</option>`;

        unidades.forEach(dep => {
            const edificio = obtenerNombreEdificio(db, dep.edificioId);
            const tipo = formatearTipoUnidad(normalizarTipoUnidad(dep.tipo));

            selectDepartamento.innerHTML += `
                <option value="${dep.id}">
                    ${dep.numero} - ${tipo} - ${edificio}
                </option>
            `;
        });
    }
}

/* =========================
   VALIDACIONES
========================= */

function existeReservaAprobada(db, areaId, fecha, reservaIdIgnorar = "") {
    return (db.reservas || []).some(reserva =>
        String(reserva.areaId) === String(areaId) &&
        String(reserva.fecha) === String(fecha) &&
        String(reserva.id) !== String(reservaIdIgnorar) &&
        normalizarEstadoReserva(reserva.estado) === "aprobada"
    );
}

function existeMantenimientoProgramado(db, areaId, fechaInicio, fechaFin) {
    return (db.mantenimientosAreas || []).some(mantenimiento =>
        String(mantenimiento.areaId) === String(areaId) &&
        normalizarEstadoMantenimiento(mantenimiento.estado) === "programado" &&
        fechasSeCruzan(fechaInicio, fechaFin, mantenimiento.fechaInicio, mantenimiento.fechaFin)
    );
}

function obtenerReservasAprobadasEnRango(db, areaId, fechaInicio, fechaFin) {
    return (db.reservas || []).filter(reserva =>
        String(reserva.areaId) === String(areaId) &&
        normalizarEstadoReserva(reserva.estado) === "aprobada" &&
        fechaEnRango(reserva.fecha, fechaInicio, fechaFin)
    );
}

function fechasSeCruzan(inicioA, finA, inicioB, finB) {
    return String(inicioA) <= String(finB) && String(finA) >= String(inicioB);
}

function fechaEnRango(fecha, inicio, fin) {
    return String(fecha) >= String(inicio) && String(fecha) <= String(fin);
}

/* =========================
   ANUNCIOS
========================= */

function crearAnuncioReservaRechazada(db, reserva, observacion) {
    db.anuncios = db.anuncios || [];

    const unidad = (db.departamentos || []).find(dep =>
        String(dep.id) === String(reserva.departamentoId)
    );

    const area = (db.areasComunes || []).find(a =>
        String(a.id) === String(reserva.areaId)
    );

    const destinatarioUsuarioId = obtenerUsuarioIdPorUnidad(db, unidad);

    db.anuncios.push({
        id: generarId(),
        tipo: "reserva_rechazada",
        titulo: "Reserva rechazada",
        mensaje: `Tu reserva para ${area?.nombre || "el área común"} del día ${formatearFechaReserva(reserva.fecha)} fue rechazada. Motivo: ${observacion}`,
        edificioId: reserva.edificioId,
        unidadId: reserva.departamentoId,
        destinatarioUsuarioId,
        alcance: destinatarioUsuarioId ? "usuario" : "unidad",
        fechaPublicacion: new Date().toISOString().split("T")[0],
        fechaRegistro: new Date().toISOString(),
        creadoPor: obtenerSesionActual()?.id || "sistema",
        estado: "publicado"
    });
}

function crearAnuncioMantenimientoArea(db, mantenimiento, area) {
    db.anuncios = db.anuncios || [];

    const periodo = mantenimiento.fechaInicio === mantenimiento.fechaFin
        ? formatearFechaReserva(mantenimiento.fechaInicio)
        : `${formatearFechaReserva(mantenimiento.fechaInicio)} al ${formatearFechaReserva(mantenimiento.fechaFin)}`;

    db.anuncios.push({
        id: generarId(),
        tipo: "mantenimiento_area",
        titulo: "Mantenimiento programado",
        mensaje: `El área común ${area.nombre} estará en mantenimiento del ${periodo}. Motivo: ${formatearMotivoMantenimiento(mantenimiento.motivo)}. ${mantenimiento.descripcion}`,
        edificioId: mantenimiento.edificioId,
        alcance: "residentes_edificio",
        fechaPublicacion: new Date().toISOString().split("T")[0],
        fechaRegistro: new Date().toISOString(),
        creadoPor: obtenerSesionActual()?.id || "sistema",
        estado: "publicado"
    });
}

function obtenerUsuarioIdPorUnidad(db, unidad) {
    if (!unidad) return "";

    const usuario = (db.usuarios || []).find(usuario => {
        const unidades = usuario.unidadesAutorizadas || [];

        return unidades.some(vinculo =>
            String(vinculo.edificioId || "") === String(unidad.edificioId || "") &&
            (
                String(vinculo.unidadId || "") === String(unidad.id || "") ||
                String(vinculo.unidadNumero || vinculo.numero || "") === String(unidad.numero || "")
            )
        );
    });

    return usuario?.id || "";
}

/* =========================
   HELPERS
========================= */

function obtenerSesionActual() {
    return JSON.parse(localStorage.getItem("usuarioSesion"));
}

function obtenerNombreEdificio(db, edificioId) {
    const edificio = (db.edificios || []).find(e =>
        String(e.id) === String(edificioId)
    );

    return edificio ? edificio.nombre : "-";
}

function generarId() {
    return Date.now().toString() + Math.random().toString(36).substring(2, 8);
}

function normalizarTipoUnidad(tipo) {
    const valor = String(tipo || "").toLowerCase().trim();

    if (valor === "departamento") return "departamento";
    if (valor === "oficina" || valor === "local") return "oficina";
    if (valor === "estacionamiento") return "estacionamiento";
    if (valor === "deposito" || valor === "depósito") return "deposito";

    return "departamento";
}

function formatearTipoUnidad(tipo) {
    const tipos = {
        departamento: "Departamento",
        oficina: "Oficina / Local",
        estacionamiento: "Estacionamiento",
        deposito: "Depósito"
    };

    return tipos[tipo] || "Departamento";
}

function normalizarEstadoArea(estado) {
    const valor = String(estado || "").toLowerCase().trim();

    if (valor === "disponible") return "disponible";
    if (valor === "bloqueada") return "bloqueada";
    if (valor === "no_disponible") return "bloqueada";
    if (valor === "no disponible") return "bloqueada";

    return "disponible";
}

function formatearEstadoArea(estado) {
    const estados = {
        disponible: "Disponible",
        bloqueada: "Bloqueada"
    };

    return estados[estado] || "Disponible";
}

function claseEstadoArea(estado) {
    if (estado === "disponible") return "vacio";
    return "inactivo";
}

function normalizarEstadoReserva(estado) {
    const valor = String(estado || "").toLowerCase().trim();

    if (valor === "registrada") return "aprobada";
    if (valor === "aprobada") return "aprobada";
    if (valor === "rechazada") return "rechazada";
    if (valor === "cancelada") return "cancelada";

    return "aprobada";
}

function formatearEstadoReserva(estado) {
    const estados = {
        aprobada: "Aprobada",
        rechazada: "Rechazada",
        cancelada: "Cancelada"
    };

    return estados[estado] || "Aprobada";
}

function claseEstadoReserva(estado) {
    if (estado === "aprobada") return "vacio";
    if (estado === "rechazada") return "ocupado";
    if (estado === "cancelada") return "inactivo";

    return "vacio";
}

function normalizarEstadoMantenimiento(estado) {
    const valor = String(estado || "").toLowerCase().trim();

    if (valor === "programado") return "programado";
    if (valor === "finalizado") return "finalizado";
    if (valor === "cancelado") return "cancelado";

    return "programado";
}

function formatearEstadoMantenimiento(estado) {
    const estados = {
        programado: "Programado",
        finalizado: "Finalizado",
        cancelado: "Cancelado"
    };

    return estados[estado] || "Programado";
}

function claseEstadoMantenimiento(estado) {
    if (estado === "programado") return "pendiente";
    if (estado === "finalizado") return "vacio";
    if (estado === "cancelado") return "inactivo";

    return "pendiente";
}

function formatearMotivoMantenimiento(motivo) {
    const motivos = {
        limpieza_profunda: "Limpieza profunda",
        reparacion: "Reparación",
        fumigacion: "Fumigación",
        inspeccion: "Inspección técnica",
        mejora: "Mejora del ambiente",
        otro: "Otro"
    };

    return motivos[motivo] || "Mantenimiento";
}

function formatearFechaReserva(fecha) {
    if (!fecha) return "-";

    const partes = String(fecha).split("-");

    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }

    return fecha;
}