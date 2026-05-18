/* =========================================================
   AREAS SERVICE - EDIFIKA
   Maneja áreas comunes, reservas, mantenimientos y anuncios
========================================================= */

/* =========================
   HELPERS BASE
========================= */

function generarIdAreaService() {
    return Date.now().toString() + Math.random().toString(36).substring(2, 8);
}

function obtenerSesionAreaService() {
    try {
        return JSON.parse(localStorage.getItem("usuarioSesion"));
    } catch (error) {
        return null;
    }
}

function normalizarTextoAreaService(texto) {
    return String(texto || "").trim().toLowerCase();
}

function fechaHoyAreaService() {
    return new Date().toISOString().split("T")[0];
}

function fechasSeCruzanAreaService(inicioA, finA, inicioB, finB) {
    return String(inicioA) <= String(finB) && String(finA) >= String(inicioB);
}

function fechaEnRangoAreaService(fecha, inicio, fin) {
    return String(fecha) >= String(inicio) && String(fecha) <= String(fin);
}

/* =========================
   NORMALIZADORES
========================= */

function normalizarEstadoAreaService(estado) {
    const valor = String(estado || "").toLowerCase().trim();

    if (valor === "disponible") return "disponible";
    if (valor === "bloqueada") return "bloqueada";
    if (valor === "no_disponible") return "bloqueada";
    if (valor === "no disponible") return "bloqueada";

    return "disponible";
}

function normalizarEstadoReservaService(estado) {
    const valor = String(estado || "").toLowerCase().trim();

    if (valor === "registrada") return "aprobada";
    if (valor === "aprobada") return "aprobada";
    if (valor === "rechazada") return "rechazada";
    if (valor === "cancelada") return "cancelada";

    return "aprobada";
}

function normalizarEstadoMantenimientoService(estado) {
    const valor = String(estado || "").toLowerCase().trim();

    if (valor === "programado") return "programado";
    if (valor === "finalizado") return "finalizado";
    if (valor === "cancelado") return "cancelado";

    return "programado";
}

/* =========================
   ÁREAS COMUNES
========================= */

function agregarAreaComun(area) {
    const db = obtenerTodo();

    db.areasComunes = db.areasComunes || [];

    const nombre = String(area.nombre || "").trim();

    if (!area.edificioId) {
        return {
            ok: false,
            error: "Debe seleccionar un edificio para registrar el área."
        };
    }

    if (!nombre) {
        return {
            ok: false,
            error: "Debe ingresar el nombre del área común."
        };
    }

    if (!area.aforo || Number(area.aforo) < 1) {
        return {
            ok: false,
            error: "Debe ingresar un aforo válido."
        };
    }

    const existe = db.areasComunes.some(item =>
        String(item.edificioId) === String(area.edificioId) &&
        normalizarTextoAreaService(item.nombre) === normalizarTextoAreaService(nombre)
    );

    if (existe) {
        return {
            ok: false,
            error: "Ya existe un área común con ese nombre en este edificio."
        };
    }

    db.areasComunes.push({
        id: generarIdAreaService(),
        edificioId: area.edificioId,
        nombre,
        aforo: Number(area.aforo),
        descripcion: area.descripcion || "",
        estado: normalizarEstadoAreaService(area.estado),
        fechaRegistro: new Date().toISOString(),
        creadoPor: obtenerSesionAreaService()?.id || "sistema"
    });

    guardarTodo(db);

    return { ok: true };
}

function editarAreaComun(id, datos) {
    const db = obtenerTodo();

    const area = (db.areasComunes || []).find(item =>
        String(item.id) === String(id)
    );

    if (!area) {
        return {
            ok: false,
            error: "Área común no encontrada."
        };
    }

    if (!datos.nombre || !datos.nombre.trim()) {
        return {
            ok: false,
            error: "Debe ingresar el nombre del área común."
        };
    }

    if (!datos.aforo || Number(datos.aforo) < 1) {
        return {
            ok: false,
            error: "Debe ingresar un aforo válido."
        };
    }

    const existe = (db.areasComunes || []).some(item =>
        String(item.id) !== String(id) &&
        String(item.edificioId) === String(area.edificioId) &&
        normalizarTextoAreaService(item.nombre) === normalizarTextoAreaService(datos.nombre)
    );

    if (existe) {
        return {
            ok: false,
            error: "Ya existe otra área común con ese nombre en este edificio."
        };
    }

    area.nombre = datos.nombre.trim();
    area.aforo = Number(datos.aforo);
    area.descripcion = datos.descripcion || "";
    area.estado = normalizarEstadoAreaService(datos.estado);
    area.fechaActualizacion = new Date().toISOString();

    guardarTodo(db);

    return { ok: true };
}

function cambiarEstadoAreaComun(id, nuevoEstado) {
    const db = obtenerTodo();

    const area = (db.areasComunes || []).find(item =>
        String(item.id) === String(id)
    );

    if (!area) {
        return {
            ok: false,
            error: "Área común no encontrada."
        };
    }

    area.estado = normalizarEstadoAreaService(nuevoEstado);
    area.fechaActualizacion = new Date().toISOString();

    guardarTodo(db);

    return { ok: true };
}

function eliminarAreaComun(id) {
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

function agregarReservaArea(reservaData) {
    const db = obtenerTodo();

    db.reservas = db.reservas || [];

    if (!reservaData.areaId || !reservaData.departamentoId || !reservaData.fecha) {
        return {
            ok: false,
            error: "Completa todos los campos de la reserva."
        };
    }

    const area = (db.areasComunes || []).find(area =>
        String(area.id) === String(reservaData.areaId)
    );

    if (!area) {
        return {
            ok: false,
            error: "Área común no encontrada."
        };
    }

    if (normalizarEstadoAreaService(area.estado) !== "disponible") {
        return {
            ok: false,
            error: "Esta área no está disponible para reservas."
        };
    }

    const unidad = (db.departamentos || []).find(dep =>
        String(dep.id) === String(reservaData.departamentoId)
    );

    if (!unidad) {
        return {
            ok: false,
            error: "Unidad no encontrada."
        };
    }

    if (String(unidad.edificioId) !== String(area.edificioId)) {
        return {
            ok: false,
            error: "El área y la unidad deben pertenecer al mismo edificio."
        };
    }

    const existeReserva = existeReservaAprobadaArea(
        db,
        reservaData.areaId,
        reservaData.fecha
    );

    if (existeReserva) {
        return {
            ok: false,
            error: "Ya existe una reserva aprobada para esta área en la fecha seleccionada."
        };
    }

    const existeMantenimiento = existeMantenimientoProgramadoArea(
        db,
        reservaData.areaId,
        reservaData.fecha,
        reservaData.fecha
    );

    if (existeMantenimiento) {
        return {
            ok: false,
            error: "No se puede reservar esta área porque tiene mantenimiento programado en esa fecha."
        };
    }

    db.reservas.push({
        id: generarIdAreaService(),
        areaId: reservaData.areaId,
        departamentoId: reservaData.departamentoId,
        edificioId: area.edificioId,
        fecha: reservaData.fecha,
        estado: "aprobada",
        observacion: reservaData.observacion || "",
        motivoRechazo: "",
        fechaRegistro: new Date().toISOString(),
        creadoPor: obtenerSesionAreaService()?.id || "sistema"
    });

    guardarTodo(db);

    return { ok: true };
}

function editarReservaArea(id, reservaData) {
    const db = obtenerTodo();

    const reserva = (db.reservas || []).find(item =>
        String(item.id) === String(id)
    );

    if (!reserva) {
        return {
            ok: false,
            error: "Reserva no encontrada."
        };
    }

    const area = (db.areasComunes || []).find(area =>
        String(area.id) === String(reservaData.areaId)
    );

    if (!area) {
        return {
            ok: false,
            error: "Área común no encontrada."
        };
    }

    const unidad = (db.departamentos || []).find(dep =>
        String(dep.id) === String(reservaData.departamentoId)
    );

    if (!unidad) {
        return {
            ok: false,
            error: "Unidad no encontrada."
        };
    }

    if (String(unidad.edificioId) !== String(area.edificioId)) {
        return {
            ok: false,
            error: "El área y la unidad deben pertenecer al mismo edificio."
        };
    }

    if (
        existeReservaAprobadaArea(
            db,
            reservaData.areaId,
            reservaData.fecha,
            id
        )
    ) {
        return {
            ok: false,
            error: "Ya existe otra reserva aprobada para esta área en la fecha seleccionada."
        };
    }

    if (
        existeMantenimientoProgramadoArea(
            db,
            reservaData.areaId,
            reservaData.fecha,
            reservaData.fecha
        )
    ) {
        return {
            ok: false,
            error: "No se puede guardar la reserva porque existe mantenimiento programado en esa fecha."
        };
    }

    reserva.areaId = reservaData.areaId;
    reserva.departamentoId = reservaData.departamentoId;
    reserva.edificioId = area.edificioId;
    reserva.fecha = reservaData.fecha;
    reserva.estado = normalizarEstadoReservaService(reservaData.estado || "aprobada");
    reserva.observacion = reservaData.observacion || "";
    reserva.motivoRechazo = reservaData.motivoRechazo || "";
    reserva.fechaActualizacion = new Date().toISOString();

    guardarTodo(db);

    return { ok: true };
}

function rechazarReservaArea(id, motivo, observacion) {
    const db = obtenerTodo();

    const reserva = (db.reservas || []).find(item =>
        String(item.id) === String(id)
    );

    if (!reserva) {
        return {
            ok: false,
            error: "Reserva no encontrada."
        };
    }

    if (!motivo || !observacion) {
        return {
            ok: false,
            error: "Debe ingresar un motivo y una observación."
        };
    }

    reserva.estado = "rechazada";
    reserva.motivoRechazo = motivo;
    reserva.observacion = observacion;
    reserva.fechaActualizacion = new Date().toISOString();

    crearAnuncioReservaRechazadaAreaService(db, reserva, observacion);

    guardarTodo(db);

    return { ok: true };
}

function cancelarReservaArea(id, observacion = "Reserva cancelada por administración.") {
    const db = obtenerTodo();

    const reserva = (db.reservas || []).find(item =>
        String(item.id) === String(id)
    );

    if (!reserva) {
        return {
            ok: false,
            error: "Reserva no encontrada."
        };
    }

    reserva.estado = "cancelada";
    reserva.observacion = observacion;
    reserva.fechaActualizacion = new Date().toISOString();

    guardarTodo(db);

    return { ok: true };
}

function eliminarReservaArea(id) {
    const db = obtenerTodo();

    db.reservas = (db.reservas || []).filter(reserva =>
        String(reserva.id) !== String(id)
    );

    guardarTodo(db);

    return { ok: true };
}

/* =========================
   MANTENIMIENTO
========================= */

function agregarMantenimientoArea(datos) {
    const db = obtenerTodo();

    db.mantenimientosAreas = db.mantenimientosAreas || [];

    if (!datos.areaId || !datos.fechaInicio || !datos.fechaFin || !datos.motivo || !datos.descripcion) {
        return {
            ok: false,
            error: "Completa todos los campos del mantenimiento."
        };
    }

    if (String(datos.fechaFin) < String(datos.fechaInicio)) {
        return {
            ok: false,
            error: "La fecha fin no puede ser anterior a la fecha inicio."
        };
    }

    const area = (db.areasComunes || []).find(area =>
        String(area.id) === String(datos.areaId)
    );

    if (!area) {
        return {
            ok: false,
            error: "Área común no encontrada."
        };
    }

    const reservasCruzadas = obtenerReservasAprobadasEnRangoArea(
        db,
        datos.areaId,
        datos.fechaInicio,
        datos.fechaFin
    );

    if (reservasCruzadas.length > 0 && !datos.forzar) {
        return {
            ok: false,
            requiereConfirmacion: true,
            reservasCruzadas,
            error: `Ya existen ${reservasCruzadas.length} reserva(s) aprobada(s) en ese periodo.`
        };
    }

    const mantenimiento = {
        id: generarIdAreaService(),
        areaId: datos.areaId,
        edificioId: area.edificioId,
        fechaInicio: datos.fechaInicio,
        fechaFin: datos.fechaFin,
        motivo: datos.motivo,
        descripcion: datos.descripcion,
        estado: "programado",
        notificarResidentes: datos.notificarResidentes || "si",
        creadoPor: obtenerSesionAreaService()?.id || "sistema",
        fechaRegistro: new Date().toISOString()
    };

    db.mantenimientosAreas.push(mantenimiento);

    if (datos.notificarResidentes === "si") {
        crearAnuncioMantenimientoAreaService(db, mantenimiento, area);
    }

    guardarTodo(db);

    return {
        ok: true,
        mantenimiento
    };
}

function finalizarMantenimientoAreaService(id) {
    const db = obtenerTodo();

    const mantenimiento = (db.mantenimientosAreas || []).find(item =>
        String(item.id) === String(id)
    );

    if (!mantenimiento) {
        return {
            ok: false,
            error: "Mantenimiento no encontrado."
        };
    }

    mantenimiento.estado = "finalizado";
    mantenimiento.fechaActualizacion = new Date().toISOString();

    guardarTodo(db);

    return { ok: true };
}

function cancelarMantenimientoAreaService(id) {
    const db = obtenerTodo();

    const mantenimiento = (db.mantenimientosAreas || []).find(item =>
        String(item.id) === String(id)
    );

    if (!mantenimiento) {
        return {
            ok: false,
            error: "Mantenimiento no encontrado."
        };
    }

    mantenimiento.estado = "cancelado";
    mantenimiento.fechaActualizacion = new Date().toISOString();

    guardarTodo(db);

    return { ok: true };
}

/* =========================
   VALIDACIONES
========================= */

function existeReservaAprobadaArea(db, areaId, fecha, reservaIdIgnorar = "") {
    return (db.reservas || []).some(reserva =>
        String(reserva.areaId) === String(areaId) &&
        String(reserva.fecha) === String(fecha) &&
        String(reserva.id) !== String(reservaIdIgnorar) &&
        normalizarEstadoReservaService(reserva.estado) === "aprobada"
    );
}

function existeMantenimientoProgramadoArea(db, areaId, fechaInicio, fechaFin) {
    return (db.mantenimientosAreas || []).some(mantenimiento =>
        String(mantenimiento.areaId) === String(areaId) &&
        normalizarEstadoMantenimientoService(mantenimiento.estado) === "programado" &&
        fechasSeCruzanAreaService(fechaInicio, fechaFin, mantenimiento.fechaInicio, mantenimiento.fechaFin)
    );
}

function obtenerReservasAprobadasEnRangoArea(db, areaId, fechaInicio, fechaFin) {
    return (db.reservas || []).filter(reserva =>
        String(reserva.areaId) === String(areaId) &&
        normalizarEstadoReservaService(reserva.estado) === "aprobada" &&
        fechaEnRangoAreaService(reserva.fecha, fechaInicio, fechaFin)
    );
}

/* =========================
   ANUNCIOS AUTOMÁTICOS
========================= */

function crearAnuncioReservaRechazadaAreaService(db, reserva, observacion) {
    db.anuncios = db.anuncios || [];

    const unidad = (db.departamentos || []).find(dep =>
        String(dep.id) === String(reserva.departamentoId)
    );

    const area = (db.areasComunes || []).find(item =>
        String(item.id) === String(reserva.areaId)
    );

    const destinatarioUsuarioId = obtenerUsuarioIdPorUnidadAreaService(db, unidad);

    db.anuncios.push({
        id: generarIdAreaService(),
        tipo: "reserva_rechazada",
        titulo: "Reserva rechazada",
        mensaje: `Tu reserva para ${area?.nombre || "el área común"} del día ${formatearFechaAreaService(reserva.fecha)} fue rechazada. Motivo: ${observacion}`,
        edificioId: reserva.edificioId,
        unidadId: reserva.departamentoId,
        destinatarioUsuarioId,
        alcance: destinatarioUsuarioId ? "usuario" : "unidad",
        fechaPublicacion: fechaHoyAreaService(),
        fechaRegistro: new Date().toISOString(),
        creadoPor: obtenerSesionAreaService()?.id || "sistema",
        estado: "publicado"
    });
}

function crearAnuncioMantenimientoAreaService(db, mantenimiento, area) {
    db.anuncios = db.anuncios || [];

    const periodo = mantenimiento.fechaInicio === mantenimiento.fechaFin
        ? formatearFechaAreaService(mantenimiento.fechaInicio)
        : `${formatearFechaAreaService(mantenimiento.fechaInicio)} al ${formatearFechaAreaService(mantenimiento.fechaFin)}`;

    db.anuncios.push({
        id: generarIdAreaService(),
        tipo: "mantenimiento_area",
        titulo: "Mantenimiento programado",
        mensaje: `El área común ${area.nombre} estará en mantenimiento del ${periodo}. Motivo: ${formatearMotivoMantenimientoAreaService(mantenimiento.motivo)}. ${mantenimiento.descripcion}`,
        edificioId: mantenimiento.edificioId,
        alcance: "residentes_edificio",
        fechaPublicacion: fechaHoyAreaService(),
        fechaRegistro: new Date().toISOString(),
        creadoPor: obtenerSesionAreaService()?.id || "sistema",
        estado: "publicado"
    });
}

function obtenerUsuarioIdPorUnidadAreaService(db, unidad) {
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
   FORMATEADORES
========================= */

function formatearFechaAreaService(fecha) {
    if (!fecha) return "-";

    const partes = String(fecha).split("-");

    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }

    return fecha;
}

function formatearMotivoMantenimientoAreaService(motivo) {
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