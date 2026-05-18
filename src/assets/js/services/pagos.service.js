/* =========================================================
   PAGOS SERVICE - EDIFIKA
   Maneja cuotas, pagos, comprobantes, morosidad y avisos
========================================================= */

/* =========================
   HELPERS BASE
========================= */

function generarIdPagoService() {
    return Date.now().toString() + Math.random().toString(36).substring(2, 8);
}

function obtenerSesionPagoService() {
    try {
        return JSON.parse(localStorage.getItem("usuarioSesion"));
    } catch (error) {
        return null;
    }
}

function fechaHoyPagoService() {
    const hoy = new Date();

    const year = hoy.getFullYear();
    const month = String(hoy.getMonth() + 1).padStart(2, "0");
    const day = String(hoy.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function fechaHoraPagoService() {
    return new Date().toISOString();
}

function normalizarTextoPagoService(texto) {
    return String(texto || "").trim().toLowerCase();
}

function convertirMontoPagoService(valor) {
    const numero = Number(valor);

    return Number.isFinite(numero) ? numero : 0;
}

/* =========================
   INICIALIZACIÓN
========================= */

function inicializarPagosService() {
    const db = obtenerTodo();

    db.cuotas = db.cuotas || [];
    db.pagos = db.pagos || [];
    db.anuncios = db.anuncios || [];

    db.cuotas.forEach(cuota => {
        cuota.tipo = normalizarTipoCuota(cuota.tipo);
        cuota.estado = normalizarEstadoCuota(cuota.estado);
        cuota.periodo = cuota.periodo || "";
        cuota.monto = convertirMontoPagoService(cuota.monto);
        cuota.historial = cuota.historial || [];
        cuota.comprobanteBase = cuota.comprobanteBase || "";
    });

    db.pagos.forEach(pago => {
        pago.estadoValidacion = normalizarEstadoPago(pago.estadoValidacion);
        pago.voucher = pago.voucher || "";
        pago.historial = pago.historial || [];
    });

    actualizarCuotasVencidas(db);

    guardarTodo(db);

    return {
        cuotas: db.cuotas,
        pagos: db.pagos
    };
}

/* =========================
   GENERAR CUOTAS
========================= */

function generarCuotasMasivas(datos) {
    const db = obtenerTodo();
    const sesion = obtenerSesionPagoService();

    db.cuotas = db.cuotas || [];
    db.anuncios = db.anuncios || [];

    const validacion = validarDatosCuota(datos);

    if (!validacion.ok) {
        return validacion;
    }

    const edificio = (db.edificios || []).find(item =>
        String(item.id) === String(datos.edificioId)
    );

    if (!edificio) {
        return {
            ok: false,
            error: "Edificio no encontrado."
        };
    }

    if (!usuarioPuedeGestionarEdificioPago(datos.edificioId)) {
        return {
            ok: false,
            error: "No tienes permisos para generar cuotas en este edificio."
        };
    }

    const unidades = obtenerUnidadesActivasParaCuota(db, datos.edificioId);

    if (unidades.length === 0) {
        return {
            ok: false,
            error: "No hay departamentos u oficinas activas para generar cuotas."
        };
    }

    const duplicados = unidades.filter(unidad =>
        existeCuotaDuplicada(db, {
            edificioId: datos.edificioId,
            unidadId: unidad.id,
            concepto: datos.concepto,
            periodo: datos.periodo,
            tipo: datos.tipo
        })
    );

    if (duplicados.length > 0 && !datos.forzarDuplicados) {
        return {
            ok: false,
            requiereConfirmacion: true,
            duplicados,
            error: `Ya existen cuotas para ${duplicados.length} unidad(es) con el mismo concepto, tipo y periodo.`
        };
    }

    const cuotasGeneradas = [];

    unidades.forEach(unidad => {
        const yaExiste = existeCuotaDuplicada(db, {
            edificioId: datos.edificioId,
            unidadId: unidad.id,
            concepto: datos.concepto,
            periodo: datos.periodo,
            tipo: datos.tipo
        });

        if (yaExiste && !datos.forzarDuplicados) return;

        const cuota = crearObjetoCuota({
            edificioId: datos.edificioId,
            unidadId: unidad.id,
            concepto: datos.concepto,
            tipo: datos.tipo,
            periodo: datos.periodo,
            monto: datos.monto,
            fechaVencimiento: datos.fechaVencimiento,
            comprobanteBase: datos.comprobanteBase || "",
            observacion: datos.observacion || "",
            creadoPor: sesion?.id || "sistema"
        });

        db.cuotas.push(cuota);
        cuotasGeneradas.push(cuota);

        crearAnuncioNuevaCuota(db, cuota, unidad);
    });

    guardarTodo(db);

    return {
        ok: true,
        cuotasGeneradas,
        totalGeneradas: cuotasGeneradas.length,
        totalUnidades: unidades.length
    };
}

function generarCuotaIndividual(datos) {
    const db = obtenerTodo();
    const sesion = obtenerSesionPagoService();

    db.cuotas = db.cuotas || [];

    const validacion = validarDatosCuota(datos);

    if (!validacion.ok) {
        return validacion;
    }

    if (!datos.unidadId) {
        return {
            ok: false,
            error: "Debe seleccionar una unidad."
        };
    }

    const unidad = (db.departamentos || []).find(item =>
        String(item.id) === String(datos.unidadId)
    );

    if (!unidad) {
        return {
            ok: false,
            error: "Unidad no encontrada."
        };
    }

    if (String(unidad.edificioId) !== String(datos.edificioId)) {
        return {
            ok: false,
            error: "La unidad no pertenece al edificio seleccionado."
        };
    }

    if (!usuarioPuedeGestionarEdificioPago(datos.edificioId)) {
        return {
            ok: false,
            error: "No tienes permisos para generar cuotas en este edificio."
        };
    }

    if (
        existeCuotaDuplicada(db, {
            edificioId: datos.edificioId,
            unidadId: datos.unidadId,
            concepto: datos.concepto,
            periodo: datos.periodo,
            tipo: datos.tipo
        }) &&
        !datos.forzarDuplicados
    ) {
        return {
            ok: false,
            requiereConfirmacion: true,
            error: "Ya existe una cuota para esta unidad con el mismo concepto, tipo y periodo."
        };
    }

    const cuota = crearObjetoCuota({
        edificioId: datos.edificioId,
        unidadId: datos.unidadId,
        concepto: datos.concepto,
        tipo: datos.tipo,
        periodo: datos.periodo,
        monto: datos.monto,
        fechaVencimiento: datos.fechaVencimiento,
        comprobanteBase: datos.comprobanteBase || "",
        observacion: datos.observacion || "",
        creadoPor: sesion?.id || "sistema"
    });

    db.cuotas.push(cuota);

    crearAnuncioNuevaCuota(db, cuota, unidad);

    guardarTodo(db);

    return {
        ok: true,
        cuota
    };
}

function crearObjetoCuota(datos) {
    const estadoInicial = String(datos.fechaVencimiento) < String(fechaHoyPagoService())
        ? "vencido"
        : "pendiente";

    return {
        id: generarIdPagoService(),

        edificioId: datos.edificioId,
        unidadId: datos.unidadId,

        concepto: String(datos.concepto || "").trim(),
        tipo: normalizarTipoCuota(datos.tipo),
        periodo: String(datos.periodo || "").trim(),

        monto: convertirMontoPagoService(datos.monto),
        moneda: "PEN",

        fechaVencimiento: datos.fechaVencimiento,

        estado: estadoInicial,

        comprobanteBase: datos.comprobanteBase || "",
        observacion: datos.observacion || "",

        creadoPor: datos.creadoPor || "sistema",
        fechaRegistro: fechaHoraPagoService(),
        fechaActualizacion: fechaHoraPagoService(),

        historial: [
            {
                id: generarIdPagoService(),
                estado: estadoInicial,
                observacion: "Cuota generada por administración.",
                usuarioId: datos.creadoPor || "sistema",
                usuarioNombre: obtenerSesionPagoService()?.nombre || obtenerSesionPagoService()?.nombres || "Administración",
                fecha: fechaHoraPagoService()
            }
        ]
    };
}

function validarDatosCuota(datos) {
    if (!datos.edificioId) {
        return {
            ok: false,
            error: "Debe seleccionar un edificio."
        };
    }

    if (!datos.concepto || !datos.concepto.trim()) {
        return {
            ok: false,
            error: "Debe ingresar el concepto de la cuota."
        };
    }

    if (!datos.tipo) {
        return {
            ok: false,
            error: "Debe seleccionar el tipo de cuota."
        };
    }

    if (!datos.periodo || !datos.periodo.trim()) {
        return {
            ok: false,
            error: "Debe ingresar el periodo de la cuota."
        };
    }

    if (!datos.monto || convertirMontoPagoService(datos.monto) <= 0) {
        return {
            ok: false,
            error: "Debe ingresar un monto válido."
        };
    }

    if (!datos.fechaVencimiento) {
        return {
            ok: false,
            error: "Debe ingresar la fecha de vencimiento."
        };
    }

    return { ok: true };
}

/* =========================
   DUPLICADOS
========================= */

function existeCuotaDuplicada(db, datos) {
    return (db.cuotas || []).some(cuota =>
        String(cuota.edificioId || "") === String(datos.edificioId || "") &&
        String(cuota.unidadId || "") === String(datos.unidadId || "") &&
        normalizarTextoPagoService(cuota.concepto) === normalizarTextoPagoService(datos.concepto) &&
        normalizarTextoPagoService(cuota.periodo) === normalizarTextoPagoService(datos.periodo) &&
        normalizarTipoCuota(cuota.tipo) === normalizarTipoCuota(datos.tipo) &&
        normalizarEstadoCuota(cuota.estado) !== "anulado"
    );
}

function obtenerDuplicadosCuotaMasiva(datos) {
    const db = obtenerTodo();

    const unidades = obtenerUnidadesActivasParaCuota(db, datos.edificioId);

    return unidades.filter(unidad =>
        existeCuotaDuplicada(db, {
            edificioId: datos.edificioId,
            unidadId: unidad.id,
            concepto: datos.concepto,
            periodo: datos.periodo,
            tipo: datos.tipo
        })
    );
}

/* =========================
   COMPROBANTES / PAGOS
========================= */

function registrarComprobantePago(datos) {
    const db = obtenerTodo();
    const sesion = obtenerSesionPagoService();

    db.pagos = db.pagos || [];

    const cuota = (db.cuotas || []).find(item =>
        String(item.id) === String(datos.cuotaId)
    );

    if (!cuota) {
        return {
            ok: false,
            error: "Cuota no encontrada."
        };
    }

    if (!usuarioPuedeVerCuotaPago(cuota)) {
        return {
            ok: false,
            error: "No tienes permisos para registrar este pago."
        };
    }

    const estadoCuota = normalizarEstadoCuota(cuota.estado);

    if (estadoCuota === "pagado" || estadoCuota === "anulado") {
        return {
            ok: false,
            error: "Esta cuota no admite registro de pago."
        };
    }

    if (!datos.voucher) {
        return {
            ok: false,
            error: "Debe adjuntar el comprobante de pago."
        };
    }

    if (!datos.fechaPago) {
        return {
            ok: false,
            error: "Debe ingresar la fecha de pago."
        };
    }

    if (!datos.banco || !datos.banco.trim()) {
        return {
            ok: false,
            error: "Debe ingresar el banco o medio de pago."
        };
    }

    if (!datos.numeroOperacion || !datos.numeroOperacion.trim()) {
        return {
            ok: false,
            error: "Debe ingresar el número de operación."
        };
    }

    const pagoAnteriorPendiente = (db.pagos || []).find(pago =>
        String(pago.cuotaId) === String(cuota.id) &&
        normalizarEstadoPago(pago.estadoValidacion) === "pendiente"
    );

    if (pagoAnteriorPendiente) {
        return {
            ok: false,
            error: "Ya existe un comprobante pendiente de validación para esta cuota."
        };
    }

    const pago = {
        id: generarIdPagoService(),
        cuotaId: cuota.id,
        edificioId: cuota.edificioId,
        unidadId: cuota.unidadId,

        voucher: datos.voucher,
        banco: datos.banco.trim(),
        numeroOperacion: datos.numeroOperacion.trim(),
        fechaPago: datos.fechaPago,

        montoDeclarado: convertirMontoPagoService(datos.montoDeclarado || cuota.monto),

        estadoValidacion: "pendiente",
        observacionAdmin: "",

        registradoPor: sesion?.id || "",
        fechaRegistro: fechaHoraPagoService(),
        fechaActualizacion: fechaHoraPagoService(),

        historial: [
            {
                id: generarIdPagoService(),
                estado: "pendiente",
                observacion: "Comprobante registrado por el residente.",
                usuarioId: sesion?.id || "",
                usuarioNombre: sesion?.nombre || sesion?.nombres || "Residente",
                fecha: fechaHoraPagoService()
            }
        ]
    };

    db.pagos.push(pago);

    cuota.estado = "observado";
    cuota.fechaActualizacion = fechaHoraPagoService();

    cuota.historial = cuota.historial || [];
    cuota.historial.push({
        id: generarIdPagoService(),
        estado: "observado",
        observacion: "Comprobante enviado y pendiente de validación.",
        usuarioId: sesion?.id || "",
        usuarioNombre: sesion?.nombre || sesion?.nombres || "Residente",
        fecha: fechaHoraPagoService()
    });

    guardarTodo(db);

    return {
        ok: true,
        pago
    };
}

function aprobarPago(idPago, observacion = "Pago validado por administración.") {
    const db = obtenerTodo();
    const sesion = obtenerSesionPagoService();

    const pago = (db.pagos || []).find(item =>
        String(item.id) === String(idPago)
    );

    if (!pago) {
        return {
            ok: false,
            error: "Pago no encontrado."
        };
    }

    const cuota = (db.cuotas || []).find(item =>
        String(item.id) === String(pago.cuotaId)
    );

    if (!cuota) {
        return {
            ok: false,
            error: "Cuota asociada no encontrada."
        };
    }

    if (!usuarioPuedeGestionarEdificioPago(cuota.edificioId)) {
        return {
            ok: false,
            error: "No tienes permisos para aprobar este pago."
        };
    }

    pago.estadoValidacion = "aprobado";
    pago.observacionAdmin = observacion;
    pago.validadoPor = sesion?.id || "sistema";
    pago.fechaValidacion = fechaHoraPagoService();
    pago.fechaActualizacion = fechaHoraPagoService();

    pago.historial = pago.historial || [];
    pago.historial.push({
        id: generarIdPagoService(),
        estado: "aprobado",
        observacion,
        usuarioId: sesion?.id || "sistema",
        usuarioNombre: sesion?.nombre || sesion?.nombres || "Administración",
        fecha: fechaHoraPagoService()
    });

    cuota.estado = "pagado";
    cuota.fechaPagoConfirmado = pago.fechaPago;
    cuota.pagoId = pago.id;
    cuota.fechaActualizacion = fechaHoraPagoService();

    cuota.historial = cuota.historial || [];
    cuota.historial.push({
        id: generarIdPagoService(),
        estado: "pagado",
        observacion,
        usuarioId: sesion?.id || "sistema",
        usuarioNombre: sesion?.nombre || sesion?.nombres || "Administración",
        fecha: fechaHoraPagoService()
    });

    crearAnuncioPagoAprobado(db, cuota);

    guardarTodo(db);

    return {
        ok: true,
        pago,
        cuota
    };
}

function rechazarPago(idPago, observacion) {
    const db = obtenerTodo();
    const sesion = obtenerSesionPagoService();

    if (!observacion || !observacion.trim()) {
        return {
            ok: false,
            error: "Debe ingresar una observación para rechazar el pago."
        };
    }

    const pago = (db.pagos || []).find(item =>
        String(item.id) === String(idPago)
    );

    if (!pago) {
        return {
            ok: false,
            error: "Pago no encontrado."
        };
    }

    const cuota = (db.cuotas || []).find(item =>
        String(item.id) === String(pago.cuotaId)
    );

    if (!cuota) {
        return {
            ok: false,
            error: "Cuota asociada no encontrada."
        };
    }

    if (!usuarioPuedeGestionarEdificioPago(cuota.edificioId)) {
        return {
            ok: false,
            error: "No tienes permisos para rechazar este pago."
        };
    }

    pago.estadoValidacion = "rechazado";
    pago.observacionAdmin = observacion.trim();
    pago.validadoPor = sesion?.id || "sistema";
    pago.fechaValidacion = fechaHoraPagoService();
    pago.fechaActualizacion = fechaHoraPagoService();

    pago.historial = pago.historial || [];
    pago.historial.push({
        id: generarIdPagoService(),
        estado: "rechazado",
        observacion: observacion.trim(),
        usuarioId: sesion?.id || "sistema",
        usuarioNombre: sesion?.nombre || sesion?.nombres || "Administración",
        fecha: fechaHoraPagoService()
    });

    cuota.estado = String(cuota.fechaVencimiento) < String(fechaHoyPagoService())
        ? "vencido"
        : "pendiente";

    cuota.fechaActualizacion = fechaHoraPagoService();

    cuota.historial = cuota.historial || [];
    cuota.historial.push({
        id: generarIdPagoService(),
        estado: cuota.estado,
        observacion: `Comprobante rechazado: ${observacion.trim()}`,
        usuarioId: sesion?.id || "sistema",
        usuarioNombre: sesion?.nombre || sesion?.nombres || "Administración",
        fecha: fechaHoraPagoService()
    });

    crearAnuncioPagoRechazado(db, cuota, observacion.trim());

    guardarTodo(db);

    return {
        ok: true,
        pago,
        cuota
    };
}

/* =========================
   CUOTAS: ESTADOS
========================= */

function anularCuota(idCuota, observacion = "Cuota anulada por administración.") {
    const db = obtenerTodo();
    const sesion = obtenerSesionPagoService();

    const cuota = (db.cuotas || []).find(item =>
        String(item.id) === String(idCuota)
    );

    if (!cuota) {
        return {
            ok: false,
            error: "Cuota no encontrada."
        };
    }

    if (!usuarioPuedeGestionarEdificioPago(cuota.edificioId)) {
        return {
            ok: false,
            error: "No tienes permisos para anular esta cuota."
        };
    }

    if (normalizarEstadoCuota(cuota.estado) === "pagado") {
        return {
            ok: false,
            error: "No puedes anular una cuota ya pagada."
        };
    }

    cuota.estado = "anulado";
    cuota.observacion = observacion;
    cuota.fechaActualizacion = fechaHoraPagoService();

    cuota.historial = cuota.historial || [];
    cuota.historial.push({
        id: generarIdPagoService(),
        estado: "anulado",
        observacion,
        usuarioId: sesion?.id || "sistema",
        usuarioNombre: sesion?.nombre || sesion?.nombres || "Administración",
        fecha: fechaHoraPagoService()
    });

    guardarTodo(db);

    return {
        ok: true,
        cuota
    };
}

function actualizarCuotasVencidas(db = obtenerTodo()) {
    const hoy = fechaHoyPagoService();

    let cambio = false;

    (db.cuotas || []).forEach(cuota => {
        const estado = normalizarEstadoCuota(cuota.estado);

        if (
            ["pendiente"].includes(estado) &&
            String(cuota.fechaVencimiento) < String(hoy)
        ) {
            cuota.estado = "vencido";
            cuota.fechaActualizacion = fechaHoraPagoService();

            cuota.historial = cuota.historial || [];
            cuota.historial.push({
                id: generarIdPagoService(),
                estado: "vencido",
                observacion: "La cuota venció automáticamente.",
                usuarioId: "sistema",
                usuarioNombre: "Sistema",
                fecha: fechaHoraPagoService()
            });

            crearAnuncioCuotaVencida(db, cuota);

            cambio = true;
        }
    });

    if (cambio) {
        guardarTodo(db);
    }

    return cambio;
}

/* =========================
   CONSULTAS ADMIN
========================= */

function obtenerCuotas() {
    const db = obtenerTodo();

    db.cuotas = db.cuotas || [];

    actualizarCuotasVencidas(db);

    return db.cuotas;
}

function obtenerPagos() {
    const db = obtenerTodo();

    db.pagos = db.pagos || [];

    return db.pagos;
}

function obtenerCuotaPorId(id) {
    return obtenerCuotas().find(item =>
        String(item.id) === String(id)
    );
}

function obtenerPagoPorId(id) {
    return obtenerPagos().find(item =>
        String(item.id) === String(id)
    );
}

function obtenerCuotasVisiblesAdmin() {
    const sesion = obtenerSesionPagoService();
    const cuotas = obtenerCuotas();

    if (!sesion) return [];

    if (sesion.rol === "superadmin") {
        return cuotas;
    }

    if (sesion.rol === "admin") {
        const edificiosPermitidos = obtenerEdificiosPermitidosPago(sesion);

        return cuotas.filter(cuota =>
            edificiosPermitidos.includes(String(cuota.edificioId || ""))
        );
    }

    return [];
}

function obtenerPagosVisiblesAdmin() {
    const cuotasAdmin = obtenerCuotasVisiblesAdmin();
    const idsCuotas = cuotasAdmin.map(cuota => String(cuota.id));

    return obtenerPagos().filter(pago =>
        idsCuotas.includes(String(pago.cuotaId || ""))
    );
}

/* =========================
   CONSULTAS RESIDENTE
========================= */

function obtenerCuotasVisiblesResidente() {
    const sesion = obtenerSesionPagoService();

    if (!sesion) return [];

    const idsUnidades = obtenerIdsUnidadesPago(sesion);

    return obtenerCuotas().filter(cuota =>
        idsUnidades.includes(String(cuota.unidadId || ""))
    );
}

function obtenerPagosVisiblesResidente() {
    const cuotas = obtenerCuotasVisiblesResidente();
    const idsCuotas = cuotas.map(cuota => String(cuota.id));

    return obtenerPagos().filter(pago =>
        idsCuotas.includes(String(pago.cuotaId || ""))
    );
}

function obtenerUltimoPagoCuota(cuotaId) {
    return obtenerPagos()
        .filter(pago => String(pago.cuotaId) === String(cuotaId))
        .sort((a, b) => String(b.fechaRegistro || "").localeCompare(String(a.fechaRegistro || "")))[0] || null;
}

/* =========================
   MÉTRICAS
========================= */

function calcularMetricasCuotas(cuotas) {
    const totalFacturado = cuotas
        .filter(c => normalizarEstadoCuota(c.estado) !== "anulado")
        .reduce((total, cuota) => total + convertirMontoPagoService(cuota.monto), 0);

    const totalCobrado = cuotas
        .filter(c => normalizarEstadoCuota(c.estado) === "pagado")
        .reduce((total, cuota) => total + convertirMontoPagoService(cuota.monto), 0);

    const totalPendiente = cuotas
        .filter(c => ["pendiente", "vencido", "observado"].includes(normalizarEstadoCuota(c.estado)))
        .reduce((total, cuota) => total + convertirMontoPagoService(cuota.monto), 0);

    return {
        totalCuotas: cuotas.length,
        pendientes: cuotas.filter(c => normalizarEstadoCuota(c.estado) === "pendiente").length,
        pagadas: cuotas.filter(c => normalizarEstadoCuota(c.estado) === "pagado").length,
        vencidas: cuotas.filter(c => normalizarEstadoCuota(c.estado) === "vencido").length,
        observadas: cuotas.filter(c => normalizarEstadoCuota(c.estado) === "observado").length,
        anuladas: cuotas.filter(c => normalizarEstadoCuota(c.estado) === "anulado").length,

        totalFacturado,
        totalCobrado,
        totalPendiente,

        porcentajeCobranza: totalFacturado > 0
            ? Math.round((totalCobrado / totalFacturado) * 100)
            : 0
    };
}

function calcularMetricasPagos(pagos) {
    return {
        totalPagos: pagos.length,
        pendientes: pagos.filter(p => normalizarEstadoPago(p.estadoValidacion) === "pendiente").length,
        aprobados: pagos.filter(p => normalizarEstadoPago(p.estadoValidacion) === "aprobado").length,
        rechazados: pagos.filter(p => normalizarEstadoPago(p.estadoValidacion) === "rechazado").length
    };
}

function obtenerMorososPorEdificio(edificioId = "") {
    let cuotas = obtenerCuotasVisiblesAdmin();

    if (edificioId) {
        cuotas = cuotas.filter(cuota =>
            String(cuota.edificioId || "") === String(edificioId)
        );
    }

    const vencidas = cuotas.filter(cuota =>
        normalizarEstadoCuota(cuota.estado) === "vencido"
    );

    const mapa = new Map();

    vencidas.forEach(cuota => {
        const clave = cuota.unidadId;

        if (!mapa.has(clave)) {
            mapa.set(clave, {
                unidadId: cuota.unidadId,
                edificioId: cuota.edificioId,
                cantidad: 0,
                total: 0,
                cuotas: []
            });
        }

        const item = mapa.get(clave);
        item.cantidad += 1;
        item.total += convertirMontoPagoService(cuota.monto);
        item.cuotas.push(cuota);
    });

    return Array.from(mapa.values());
}

/* =========================
   UNIDADES / PERMISOS
========================= */

function obtenerUnidadesActivasParaCuota(db, edificioId) {
    return (db.departamentos || []).filter(unidad => {
        const perteneceEdificio =
            String(unidad.edificioId || "") === String(edificioId || "");

        const tipo = normalizarTipoUnidadPago(unidad.tipo);

        const tipoPermitido =
            tipo === "departamento" || tipo === "oficina";

        const activa =
            unidad.activo !== false &&
            unidad.estado !== "inactiva" &&
            unidad.estado !== "mantenimiento";

        return perteneceEdificio && tipoPermitido && activa;
    });
}

function usuarioPuedeGestionarEdificioPago(edificioId) {
    const sesion = obtenerSesionPagoService();

    if (!sesion) return false;

    if (sesion.rol === "superadmin") return true;

    if (sesion.rol === "admin") {
        const ids = obtenerEdificiosPermitidosPago(sesion);

        return ids.includes(String(edificioId));
    }

    return false;
}

function usuarioPuedeVerCuotaPago(cuota) {
    const sesion = obtenerSesionPagoService();

    if (!sesion) return false;

    if (sesion.rol === "superadmin") return true;

    if (sesion.rol === "admin") {
        return usuarioPuedeGestionarEdificioPago(cuota.edificioId);
    }

    const idsUnidades = obtenerIdsUnidadesPago(sesion);

    return idsUnidades.includes(String(cuota.unidadId));
}

function obtenerEdificiosPermitidosPago(sesion) {
    if (!sesion) return [];

    if (Array.isArray(sesion.edificioIds) && sesion.edificioIds.length > 0) {
        return sesion.edificioIds.filter(Boolean).map(String);
    }

    if (sesion.edificioId) {
        return [String(sesion.edificioId)];
    }

    return [];
}

function obtenerIdsUnidadesPago(sesion) {
    const ids = [];

    if (sesion?.departamentoId) {
        ids.push(String(sesion.departamentoId));
    }

    const unidades = sesion?.unidadesAutorizadas || [];

    unidades.forEach(unidad => {
        if (unidad.unidadId) {
            ids.push(String(unidad.unidadId));
        }
    });

    return [...new Set(ids)];
}

/* =========================
   ANUNCIOS / NOTIFICACIONES
========================= */

function crearAnuncioNuevaCuota(db, cuota, unidad) {
    db.anuncios = db.anuncios || [];

    const destinatarioUsuarioId = obtenerUsuarioIdPorUnidadPago(db, unidad);

    db.anuncios.push({
        id: generarIdPagoService(),
        tipo: "cuota_generada",
        titulo: "Nueva cuota pendiente",
        mensaje:
            `Se generó una cuota de ${formatearTipoCuota(cuota.tipo)} ` +
            `por S/ ${formatearMontoPago(cuota.monto)}. ` +
            `Concepto: ${cuota.concepto}. Vence el ${formatearFechaPago(cuota.fechaVencimiento)}.`,
        edificioId: cuota.edificioId,
        unidadId: cuota.unidadId,
        destinatarioUsuarioId,
        alcance: destinatarioUsuarioId ? "usuario" : "unidad",
        prioridad: "alta",
        fechaPublicacion: fechaHoyPagoService(),
        fechaRegistro: fechaHoraPagoService(),
        creadoPor: obtenerSesionPagoService()?.id || "sistema",
        estado: "publicado"
    });
}

function crearAnuncioPagoAprobado(db, cuota) {
    db.anuncios = db.anuncios || [];

    const unidad = (db.departamentos || []).find(item =>
        String(item.id) === String(cuota.unidadId)
    );

    const destinatarioUsuarioId = obtenerUsuarioIdPorUnidadPago(db, unidad);

    db.anuncios.push({
        id: generarIdPagoService(),
        tipo: "pago_aprobado",
        titulo: "Pago aprobado",
        mensaje:
            `Tu pago correspondiente a "${cuota.concepto}" del periodo ${cuota.periodo} fue aprobado.`,
        edificioId: cuota.edificioId,
        unidadId: cuota.unidadId,
        destinatarioUsuarioId,
        alcance: destinatarioUsuarioId ? "usuario" : "unidad",
        prioridad: "normal",
        fechaPublicacion: fechaHoyPagoService(),
        fechaRegistro: fechaHoraPagoService(),
        creadoPor: obtenerSesionPagoService()?.id || "sistema",
        estado: "publicado"
    });
}

function crearAnuncioPagoRechazado(db, cuota, observacion) {
    db.anuncios = db.anuncios || [];

    const unidad = (db.departamentos || []).find(item =>
        String(item.id) === String(cuota.unidadId)
    );

    const destinatarioUsuarioId = obtenerUsuarioIdPorUnidadPago(db, unidad);

    db.anuncios.push({
        id: generarIdPagoService(),
        tipo: "pago_rechazado",
        titulo: "Pago observado",
        mensaje:
            `Tu comprobante para "${cuota.concepto}" fue rechazado. ` +
            `Observación: ${observacion}`,
        edificioId: cuota.edificioId,
        unidadId: cuota.unidadId,
        destinatarioUsuarioId,
        alcance: destinatarioUsuarioId ? "usuario" : "unidad",
        prioridad: "alta",
        fechaPublicacion: fechaHoyPagoService(),
        fechaRegistro: fechaHoraPagoService(),
        creadoPor: obtenerSesionPagoService()?.id || "sistema",
        estado: "publicado"
    });
}

function crearAnuncioCuotaVencida(db, cuota) {
    db.anuncios = db.anuncios || [];

    const unidad = (db.departamentos || []).find(item =>
        String(item.id) === String(cuota.unidadId)
    );

    const destinatarioUsuarioId = obtenerUsuarioIdPorUnidadPago(db, unidad);

    db.anuncios.push({
        id: generarIdPagoService(),
        tipo: "cuota_vencida",
        titulo: "Cuota vencida",
        mensaje:
            `La cuota "${cuota.concepto}" del periodo ${cuota.periodo} se encuentra vencida. ` +
            `Monto pendiente: S/ ${formatearMontoPago(cuota.monto)}.`,
        edificioId: cuota.edificioId,
        unidadId: cuota.unidadId,
        destinatarioUsuarioId,
        alcance: destinatarioUsuarioId ? "usuario" : "unidad",
        prioridad: "urgente",
        fechaPublicacion: fechaHoyPagoService(),
        fechaRegistro: fechaHoraPagoService(),
        creadoPor: "sistema",
        estado: "publicado"
    });
}

function obtenerUsuarioIdPorUnidadPago(db, unidad) {
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
   NORMALIZADORES
========================= */

function normalizarTipoCuota(tipo) {
    const valor = String(tipo || "").toLowerCase().trim();

    if (valor === "mantenimiento") return "mantenimiento";
    if (valor === "agua") return "agua";
    if (valor === "luz_comun" || valor === "luz común" || valor === "luz comun") return "luz_comun";
    if (valor === "seguridad") return "seguridad";
    if (valor === "limpieza") return "limpieza";
    if (valor === "multa") return "multa";
    if (valor === "extraordinaria") return "extraordinaria";
    if (valor === "reserva") return "reserva";
    if (valor === "otro") return "otro";

    return "mantenimiento";
}

function normalizarEstadoCuota(estado) {
    const valor = String(estado || "").toLowerCase().trim();

    if (valor === "pendiente") return "pendiente";
    if (valor === "pagado" || valor === "pagada") return "pagado";
    if (valor === "vencido" || valor === "vencida") return "vencido";
    if (valor === "observado" || valor === "observada") return "observado";
    if (valor === "anulado" || valor === "anulada") return "anulado";

    return "pendiente";
}

function normalizarEstadoPago(estado) {
    const valor = String(estado || "").toLowerCase().trim();

    if (valor === "pendiente") return "pendiente";
    if (valor === "aprobado" || valor === "aprobada") return "aprobado";
    if (valor === "rechazado" || valor === "rechazada") return "rechazado";

    return "pendiente";
}

function normalizarTipoUnidadPago(tipo) {
    const valor = String(tipo || "").toLowerCase().trim();

    if (valor === "oficina" || valor === "local") return "oficina";
    if (valor === "estacionamiento") return "estacionamiento";
    if (valor === "deposito" || valor === "depósito") return "deposito";

    return "departamento";
}

/* =========================
   FORMATEADORES
========================= */

function formatearTipoCuota(tipo) {
    const tipos = {
        mantenimiento: "Mantenimiento",
        agua: "Agua",
        luz_comun: "Luz común",
        seguridad: "Seguridad",
        limpieza: "Limpieza",
        multa: "Multa",
        extraordinaria: "Extraordinaria",
        reserva: "Reserva",
        otro: "Otro"
    };

    return tipos[normalizarTipoCuota(tipo)] || "Mantenimiento";
}

function formatearEstadoCuota(estado) {
    const estados = {
        pendiente: "Pendiente",
        pagado: "Pagado",
        vencido: "Vencido",
        observado: "Comprobante enviado",
        anulado: "Anulado"
    };

    return estados[normalizarEstadoCuota(estado)] || "Pendiente";
}

function formatearEstadoPago(estado) {
    const estados = {
        pendiente: "Pendiente",
        aprobado: "Aprobado",
        rechazado: "Rechazado"
    };

    return estados[normalizarEstadoPago(estado)] || "Pendiente";
}

function formatearMontoPago(monto) {
    return convertirMontoPagoService(monto).toFixed(2);
}

function formatearFechaPago(fecha) {
    if (!fecha) return "-";

    const base = String(fecha).split("T")[0];
    const partes = base.split("-");

    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }

    return fecha;
}

/* =========================
   CLASES CSS
========================= */

function claseEstadoCuota(estado) {
    const valor = normalizarEstadoCuota(estado);

    if (valor === "pendiente") return "pendiente";
    if (valor === "pagado") return "vacio";
    if (valor === "vencido") return "ocupado";
    if (valor === "observado") return "badge-blue";
    if (valor === "anulado") return "inactivo";

    return "pendiente";
}

function claseEstadoPago(estado) {
    const valor = normalizarEstadoPago(estado);

    if (valor === "pendiente") return "pendiente";
    if (valor === "aprobado") return "vacio";
    if (valor === "rechazado") return "ocupado";

    return "pendiente";
}

function claseTipoCuota(tipo) {
    const valor = normalizarTipoCuota(tipo);

    if (valor === "multa") return "ocupado";
    if (valor === "extraordinaria") return "pendiente";
    if (valor === "reserva") return "badge-blue";

    return "vacio";
}