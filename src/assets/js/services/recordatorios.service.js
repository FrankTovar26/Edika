/* =========================================================
   RECORDATORIOS SERVICE - EDIFIKA
   Maneja recordatorios automáticos de cuotas y pagos
========================================================= */

/* =========================
   HELPERS BASE
========================= */

function generarIdRecordatorioService() {
    return Date.now().toString() + Math.random().toString(36).substring(2, 8);
}

function fechaHoyRecordatorioService() {
    const hoy = new Date();

    const year = hoy.getFullYear();
    const month = String(hoy.getMonth() + 1).padStart(2, "0");
    const day = String(hoy.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function fechaHoraRecordatorioService() {
    return new Date().toISOString();
}

function obtenerSesionRecordatorioService() {
    try {
        return JSON.parse(localStorage.getItem("usuarioSesion"));
    } catch (error) {
        return null;
    }
}

function sumarDiasRecordatorioService(fechaISO, dias) {
    const fecha = new Date(`${fechaISO}T00:00:00`);
    fecha.setDate(fecha.getDate() + dias);

    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, "0");
    const day = String(fecha.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function diferenciaDiasRecordatorioService(fechaInicio, fechaFin) {
    const inicio = new Date(`${fechaInicio}T00:00:00`);
    const fin = new Date(`${fechaFin}T00:00:00`);

    const diferencia = fin.getTime() - inicio.getTime();

    return Math.round(diferencia / (1000 * 60 * 60 * 24));
}

/* =========================
   INICIALIZACIÓN
========================= */

function inicializarRecordatoriosService() {
    const db = obtenerTodo();

    db.recordatorios = db.recordatorios || [];
    db.anuncios = db.anuncios || [];

    db.recordatorios.forEach(recordatorio => {
        recordatorio.estado = normalizarEstadoRecordatorio(recordatorio.estado);
        recordatorio.tipo = normalizarTipoRecordatorio(recordatorio.tipo);
    });

    guardarTodo(db);

    return db.recordatorios;
}

/* =========================
   EJECUCIÓN GENERAL
========================= */

function ejecutarRecordatoriosAutomaticos() {
    const db = obtenerTodo();

    db.recordatorios = db.recordatorios || [];
    db.anuncios = db.anuncios || [];
    db.cuotas = db.cuotas || [];
    db.pagos = db.pagos || [];

    if (typeof actualizarCuotasVencidas === "function") {
        actualizarCuotasVencidas(db);
    }

    const resultados = {
        proximosVencimientos: generarRecordatoriosProximosVencimientos(db),
        vencidos: generarRecordatoriosCuotasVencidas(db),
        comprobantesPendientes: generarRecordatoriosComprobantesPendientes(db),
        pagosRechazados: generarRecordatoriosPagosRechazados(db)
    };

    guardarTodo(db);

    return {
        ok: true,
        resultados
    };
}

/* =========================
   RECORDATORIOS: PRÓXIMO VENCIMIENTO
========================= */

function generarRecordatoriosProximosVencimientos(db = obtenerTodo()) {
    const hoy = fechaHoyRecordatorioService();

    const diasAviso = [3, 1];

    const creados = [];

    (db.cuotas || []).forEach(cuota => {
        const estado = normalizarEstadoCuotaRecordatorio(cuota.estado);

        if (estado !== "pendiente") return;

        const diasRestantes = diferenciaDiasRecordatorioService(
            hoy,
            cuota.fechaVencimiento
        );

        if (!diasAviso.includes(diasRestantes)) return;

        const tipo = diasRestantes === 3
            ? "cuota_por_vencer_3_dias"
            : "cuota_por_vencer_1_dia";

        if (
            existeRecordatorioGenerado(db, {
                cuotaId: cuota.id,
                tipo,
                fechaReferencia: cuota.fechaVencimiento
            })
        ) {
            return;
        }

        const recordatorio = crearRecordatorioBase({
            tipo,
            cuotaId: cuota.id,
            edificioId: cuota.edificioId,
            unidadId: cuota.unidadId,
            fechaReferencia: cuota.fechaVencimiento,
            mensaje: construirMensajeProximoVencimiento(cuota, diasRestantes),
            prioridad: diasRestantes === 1 ? "alta" : "normal"
        });

        db.recordatorios.push(recordatorio);

        crearAnuncioRecordatorioCuota(db, cuota, recordatorio);

        creados.push(recordatorio);
    });

    return creados;
}

function construirMensajeProximoVencimiento(cuota, diasRestantes) {
    return (
        `Tu cuota "${cuota.concepto}" del periodo ${cuota.periodo} ` +
        `vence en ${diasRestantes} día(s). ` +
        `Monto pendiente: S/ ${formatearMontoRecordatorio(cuota.monto)}.`
    );
}

/* =========================
   RECORDATORIOS: CUOTAS VENCIDAS
========================= */

function generarRecordatoriosCuotasVencidas(db = obtenerTodo()) {
    const hoy = fechaHoyRecordatorioService();

    const creados = [];

    (db.cuotas || []).forEach(cuota => {
        const estado = normalizarEstadoCuotaRecordatorio(cuota.estado);

        const estaVencida =
            estado === "vencido" ||
            (
                estado === "pendiente" &&
                String(cuota.fechaVencimiento) < String(hoy)
            );

        if (!estaVencida) return;

        const diasVencida = Math.abs(
            diferenciaDiasRecordatorioService(
                hoy,
                cuota.fechaVencimiento
            )
        );

        const tipo = obtenerTipoRecordatorioVencido(diasVencida);

        if (!tipo) return;

        if (
            existeRecordatorioGenerado(db, {
                cuotaId: cuota.id,
                tipo,
                fechaReferencia: hoy
            })
        ) {
            return;
        }

        const recordatorio = crearRecordatorioBase({
            tipo,
            cuotaId: cuota.id,
            edificioId: cuota.edificioId,
            unidadId: cuota.unidadId,
            fechaReferencia: hoy,
            mensaje: construirMensajeCuotaVencida(cuota, diasVencida),
            prioridad: diasVencida >= 7 ? "urgente" : "alta"
        });

        db.recordatorios.push(recordatorio);

        crearAnuncioRecordatorioCuota(db, cuota, recordatorio);

        creados.push(recordatorio);
    });

    return creados;
}

function obtenerTipoRecordatorioVencido(diasVencida) {
    if (diasVencida === 0) return "cuota_vencida_hoy";
    if (diasVencida === 3) return "cuota_vencida_3_dias";
    if (diasVencida === 7) return "cuota_vencida_7_dias";
    if (diasVencida === 15) return "cuota_vencida_15_dias";

    return "";
}

function construirMensajeCuotaVencida(cuota, diasVencida) {
    if (diasVencida === 0) {
        return (
            `Tu cuota "${cuota.concepto}" vence hoy. ` +
            `Monto pendiente: S/ ${formatearMontoRecordatorio(cuota.monto)}.`
        );
    }

    return (
        `Tu cuota "${cuota.concepto}" del periodo ${cuota.periodo} ` +
        `se encuentra vencida hace ${diasVencida} día(s). ` +
        `Monto pendiente: S/ ${formatearMontoRecordatorio(cuota.monto)}.`
    );
}

/* =========================
   RECORDATORIOS: COMPROBANTES PENDIENTES
========================= */

function generarRecordatoriosComprobantesPendientes(db = obtenerTodo()) {
    const hoy = fechaHoyRecordatorioService();

    const creados = [];

    (db.pagos || []).forEach(pago => {
        const estado = normalizarEstadoPagoRecordatorio(pago.estadoValidacion);

        if (estado !== "pendiente") return;

        const fechaRegistro = String(pago.fechaRegistro || "").split("T")[0];

        if (!fechaRegistro) return;

        const diasPendiente = diferenciaDiasRecordatorioService(
            fechaRegistro,
            hoy
        );

        if (![2, 5].includes(diasPendiente)) return;

        const tipo = diasPendiente === 2
            ? "comprobante_pendiente_2_dias"
            : "comprobante_pendiente_5_dias";

        if (
            existeRecordatorioGenerado(db, {
                pagoId: pago.id,
                tipo,
                fechaReferencia: hoy
            })
        ) {
            return;
        }

        const cuota = (db.cuotas || []).find(c =>
            String(c.id) === String(pago.cuotaId)
        );

        if (!cuota) return;

        const recordatorio = crearRecordatorioBase({
            tipo,
            pagoId: pago.id,
            cuotaId: pago.cuotaId,
            edificioId: pago.edificioId || cuota.edificioId,
            unidadId: pago.unidadId || cuota.unidadId,
            fechaReferencia: hoy,
            mensaje:
                `El comprobante enviado para "${cuota.concepto}" ` +
                `sigue pendiente de validación administrativa.`,
            prioridad: diasPendiente >= 5 ? "alta" : "normal",
            alcance: "admin"
        });

        db.recordatorios.push(recordatorio);

        creados.push(recordatorio);
    });

    return creados;
}

/* =========================
   RECORDATORIOS: PAGOS RECHAZADOS
========================= */

function generarRecordatoriosPagosRechazados(db = obtenerTodo()) {
    const hoy = fechaHoyRecordatorioService();

    const creados = [];

    (db.pagos || []).forEach(pago => {
        const estado = normalizarEstadoPagoRecordatorio(pago.estadoValidacion);

        if (estado !== "rechazado") return;

        const fechaActualizacion = String(
            pago.fechaActualizacion || pago.fechaRegistro || ""
        ).split("T")[0];

        if (!fechaActualizacion) return;

        const diasDesdeRechazo = diferenciaDiasRecordatorioService(
            fechaActualizacion,
            hoy
        );

        if (![1, 3].includes(diasDesdeRechazo)) return;

        const tipo = diasDesdeRechazo === 1
            ? "pago_rechazado_1_dia"
            : "pago_rechazado_3_dias";

        if (
            existeRecordatorioGenerado(db, {
                pagoId: pago.id,
                tipo,
                fechaReferencia: hoy
            })
        ) {
            return;
        }

        const cuota = (db.cuotas || []).find(c =>
            String(c.id) === String(pago.cuotaId)
        );

        if (!cuota) return;

        const recordatorio = crearRecordatorioBase({
            tipo,
            pagoId: pago.id,
            cuotaId: pago.cuotaId,
            edificioId: cuota.edificioId,
            unidadId: cuota.unidadId,
            fechaReferencia: hoy,
            mensaje:
                `Tu comprobante para "${cuota.concepto}" fue observado. ` +
                `Revisa la observación y vuelve a registrar el pago.`,
            prioridad: "alta"
        });

        db.recordatorios.push(recordatorio);

        crearAnuncioRecordatorioCuota(db, cuota, recordatorio);

        creados.push(recordatorio);
    });

    return creados;
}

/* =========================
   CREAR RECORDATORIO
========================= */

function crearRecordatorioBase(datos) {
    return {
        id: generarIdRecordatorioService(),

        tipo: normalizarTipoRecordatorio(datos.tipo),

        cuotaId: datos.cuotaId || "",
        pagoId: datos.pagoId || "",

        edificioId: datos.edificioId || "",
        unidadId: datos.unidadId || "",

        alcance: datos.alcance || "usuario",

        mensaje: datos.mensaje || "",

        prioridad: datos.prioridad || "normal",

        fechaReferencia: datos.fechaReferencia || fechaHoyRecordatorioService(),

        estado: "generado",

        fechaRegistro: fechaHoraRecordatorioService(),

        creadoPor: obtenerSesionRecordatorioService()?.id || "sistema"
    };
}

function existeRecordatorioGenerado(db, datos) {
    return (db.recordatorios || []).some(recordatorio => {
        const mismoTipo =
            normalizarTipoRecordatorio(recordatorio.tipo) ===
            normalizarTipoRecordatorio(datos.tipo);

        const mismaFecha =
            String(recordatorio.fechaReferencia || "") ===
            String(datos.fechaReferencia || "");

        const mismaCuota =
            !datos.cuotaId ||
            String(recordatorio.cuotaId || "") === String(datos.cuotaId);

        const mismoPago =
            !datos.pagoId ||
            String(recordatorio.pagoId || "") === String(datos.pagoId);

        return mismoTipo && mismaFecha && mismaCuota && mismoPago;
    });
}

/* =========================
   ANUNCIOS
========================= */

function crearAnuncioRecordatorioCuota(db, cuota, recordatorio) {
    db.anuncios = db.anuncios || [];

    const unidad = (db.departamentos || []).find(item =>
        String(item.id) === String(cuota.unidadId)
    );

    const destinatarioUsuarioId =
        obtenerUsuarioIdPorUnidadRecordatorio(db, unidad);

    db.anuncios.push({
        id: generarIdRecordatorioService(),

        tipo: recordatorio.tipo,

        titulo: obtenerTituloRecordatorio(recordatorio.tipo),

        mensaje: recordatorio.mensaje,

        edificioId: cuota.edificioId,
        unidadId: cuota.unidadId,

        destinatarioUsuarioId,

        alcance: destinatarioUsuarioId ? "usuario" : "unidad",

        prioridad: recordatorio.prioridad || "normal",

        fechaPublicacion: fechaHoyRecordatorioService(),
        fechaRegistro: fechaHoraRecordatorioService(),

        creadoPor: "sistema",

        estado: "publicado"
    });
}

function obtenerUsuarioIdPorUnidadRecordatorio(db, unidad) {
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

function obtenerTituloRecordatorio(tipo) {
    const titulos = {
        cuota_por_vencer_3_dias: "Recordatorio de pago",
        cuota_por_vencer_1_dia: "Tu cuota vence pronto",
        cuota_vencida_hoy: "Cuota vencida",
        cuota_vencida_3_dias: "Cuota vencida",
        cuota_vencida_7_dias: "Pago pendiente urgente",
        cuota_vencida_15_dias: "Morosidad pendiente",
        pago_rechazado_1_dia: "Pago observado",
        pago_rechazado_3_dias: "Regulariza tu comprobante"
    };

    return titulos[normalizarTipoRecordatorio(tipo)] || "Recordatorio";
}

/* =========================
   CONSULTAS
========================= */

function obtenerRecordatorios() {
    const db = obtenerTodo();

    db.recordatorios = db.recordatorios || [];

    return db.recordatorios;
}

function obtenerRecordatoriosPorCuota(cuotaId) {
    return obtenerRecordatorios().filter(recordatorio =>
        String(recordatorio.cuotaId || "") === String(cuotaId || "")
    );
}

function obtenerRecordatoriosPorUnidad(unidadId) {
    return obtenerRecordatorios().filter(recordatorio =>
        String(recordatorio.unidadId || "") === String(unidadId || "")
    );
}

function obtenerRecordatoriosPorEdificio(edificioId) {
    return obtenerRecordatorios().filter(recordatorio =>
        String(recordatorio.edificioId || "") === String(edificioId || "")
    );
}

/* =========================
   LIMPIEZA / REPROCESO
========================= */

function limpiarRecordatoriosDuplicados() {
    const db = obtenerTodo();

    db.recordatorios = db.recordatorios || [];

    const mapa = new Map();

    db.recordatorios.forEach(recordatorio => {
        const clave = [
            recordatorio.tipo,
            recordatorio.cuotaId || "",
            recordatorio.pagoId || "",
            recordatorio.fechaReferencia || ""
        ].join("_");

        if (!mapa.has(clave)) {
            mapa.set(clave, recordatorio);
        }
    });

    db.recordatorios = Array.from(mapa.values());

    guardarTodo(db);

    return {
        ok: true,
        total: db.recordatorios.length
    };
}

/* =========================
   NORMALIZADORES
========================= */

function normalizarTipoRecordatorio(tipo) {
    const valor = String(tipo || "").toLowerCase().trim();

    if (valor === "cuota_por_vencer_3_dias") return "cuota_por_vencer_3_dias";
    if (valor === "cuota_por_vencer_1_dia") return "cuota_por_vencer_1_dia";
    if (valor === "cuota_vencida_hoy") return "cuota_vencida_hoy";
    if (valor === "cuota_vencida_3_dias") return "cuota_vencida_3_dias";
    if (valor === "cuota_vencida_7_dias") return "cuota_vencida_7_dias";
    if (valor === "cuota_vencida_15_dias") return "cuota_vencida_15_dias";
    if (valor === "comprobante_pendiente_2_dias") return "comprobante_pendiente_2_dias";
    if (valor === "comprobante_pendiente_5_dias") return "comprobante_pendiente_5_dias";
    if (valor === "pago_rechazado_1_dia") return "pago_rechazado_1_dia";
    if (valor === "pago_rechazado_3_dias") return "pago_rechazado_3_dias";

    return valor || "recordatorio";
}

function normalizarEstadoRecordatorio(estado) {
    const valor = String(estado || "").toLowerCase().trim();

    if (valor === "generado") return "generado";
    if (valor === "leido" || valor === "leído") return "leido";
    if (valor === "archivado") return "archivado";

    return "generado";
}

function normalizarEstadoCuotaRecordatorio(estado) {
    if (typeof normalizarEstadoCuota === "function") {
        return normalizarEstadoCuota(estado);
    }

    const valor = String(estado || "").toLowerCase().trim();

    if (valor === "pendiente") return "pendiente";
    if (valor === "pagado" || valor === "pagada") return "pagado";
    if (valor === "vencido" || valor === "vencida") return "vencido";
    if (valor === "observado" || valor === "observada") return "observado";
    if (valor === "anulado" || valor === "anulada") return "anulado";

    return "pendiente";
}

function normalizarEstadoPagoRecordatorio(estado) {
    if (typeof normalizarEstadoPago === "function") {
        return normalizarEstadoPago(estado);
    }

    const valor = String(estado || "").toLowerCase().trim();

    if (valor === "pendiente") return "pendiente";
    if (valor === "aprobado" || valor === "aprobada") return "aprobado";
    if (valor === "rechazado" || valor === "rechazada") return "rechazado";

    return "pendiente";
}

/* =========================
   FORMATEADORES
========================= */

function formatearMontoRecordatorio(monto) {
    const numero = Number(monto);

    return Number.isFinite(numero)
        ? numero.toFixed(2)
        : "0.00";
}

function formatearFechaRecordatorio(fecha) {
    if (!fecha) return "-";

    const base = String(fecha).split("T")[0];
    const partes = base.split("-");

    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }

    return fecha;
}