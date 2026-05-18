document.addEventListener("DOMContentLoaded", () => {
    protegerPaginaPagos();

    inicializarPagosService();

    cargarPaginaPagos();

    configurarFormularioCuotas();
    configurarFiltrosCuotas();

    configurarModalDetalleCuota();
    configurarModalValidacionPago();
    configurarModalComprobantePago();

    configurarEventosCuotas();
});

/* =========================================================
   SEGURIDAD
========================================================= */

function protegerPaginaPagos() {
    const sesion = obtenerSesionPagos();

    if (!sesion) {
        window.location.href = "../../../index.html";
        return;
    }

    if (!["admin", "superadmin"].includes(sesion.rol)) {
        alert("No tienes permisos para acceder.");
        window.location.href = "../residente/inicio.html";
    }
}

/* =========================================================
   CARGA PRINCIPAL
========================================================= */

function cargarPaginaPagos() {
    cargarSelectEdificiosPagos();
    cargarSelectUnidadesPagos();

    const cuotas = obtenerCuotasFiltradasAdmin();
    const pagos = obtenerPagosFiltradosAdmin();

    cargarMetricasPagos(cuotas);

    renderizarTablaCuotas(cuotas);
    renderizarTablaComprobantes(pagos);
}

/* =========================================================
   MÉTRICAS
========================================================= */

function cargarMetricasPagos(cuotas) {
    const metricas = calcularMetricasCuotas(cuotas);

    setTextPago(
        "totalFacturado",
        `S/ ${formatearMontoPago(metricas.totalFacturado)}`
    );

    setTextPago(
        "totalCobrado",
        `S/ ${formatearMontoPago(metricas.totalCobrado)}`
    );

    setTextPago(
        "totalPendiente",
        `S/ ${formatearMontoPago(metricas.totalPendiente)}`
    );

    setTextPago("cuotasPendientes", metricas.pendientes);
    setTextPago("cuotasVencidas", metricas.vencidas);

    setTextPago(
        "porcentajeCobranza",
        `${metricas.porcentajeCobranza}%`
    );
}

/* =========================================================
   FORMULARIO CUOTAS
========================================================= */

function configurarFormularioCuotas() {
    const form = document.getElementById("formGenerarCuota");

    if (!form) return;

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const comprobanteBase = await obtenerArchivoBase64Pago(
            document.getElementById("comprobanteBaseCuota")
        );

        const alcance = document.getElementById("alcanceCuota")?.value || "masiva";

        const datos = {
            edificioId: document.getElementById("edificioCuota")?.value || "",
            unidadId: document.getElementById("unidadCuota")?.value || "",
            concepto: document.getElementById("conceptoCuota")?.value || "",
            tipo: document.getElementById("tipoCuota")?.value || "",
            periodo: document.getElementById("periodoCuota")?.value || "",
            monto: document.getElementById("montoCuota")?.value || "",
            fechaVencimiento: document.getElementById("fechaVencimientoCuota")?.value || "",
            observacion: document.getElementById("observacionCuota")?.value || "",
            comprobanteBase
        };

        let resultado;

        if (alcance === "individual") {
            resultado = generarCuotaIndividual(datos);
        } else {
            resultado = generarCuotasMasivas(datos);
        }

        if (!resultado.ok) {

            if (resultado.requiereConfirmacion) {

                mostrarAlertaDuplicados(
                    resultado.error,
                    async () => {

                        datos.forzarDuplicados = true;

                        let confirmacion;

                        if (alcance === "individual") {
                            confirmacion = generarCuotaIndividual(datos);
                        } else {
                            confirmacion = generarCuotasMasivas(datos);
                        }

                        procesarResultadoGeneracion(confirmacion);
                    }
                );

                return;
            }

            alert(resultado.error);
            return;
        }

        procesarResultadoGeneracion(resultado);
    });
}

function procesarResultadoGeneracion(resultado) {

    if (!resultado.ok) {
        alert(resultado.error);
        return;
    }

    ocultarAlertaDuplicados();

    limpiarFormularioCuotas();

    cargarPaginaPagos();

    alert("Cuotas generadas correctamente.");
}

function limpiarFormularioCuotas() {
    const form = document.getElementById("formGenerarCuota");

    if (form) {
        form.reset();
    }

    actualizarVisibilidadUnidad();
    cargarSelectUnidadesPagos();

    ocultarAlertaDuplicados();
}

/* =========================================================
   EVENTOS
========================================================= */

function configurarEventosCuotas() {

    const edificio = document.getElementById("edificioCuota");

    edificio?.addEventListener("change", () => {
        cargarSelectUnidadesPagos();
    });

    const alcance = document.getElementById("alcanceCuota");

    alcance?.addEventListener("change", () => {
        actualizarVisibilidadUnidad();
    });

    actualizarVisibilidadUnidad();
}

function actualizarVisibilidadUnidad() {

    const alcance = document.getElementById("alcanceCuota")?.value || "masiva";

    const grupo = document.getElementById("grupoUnidadCuota");
    const unidad = document.getElementById("unidadCuota");

    if (!grupo || !unidad) return;

    if (alcance === "individual") {
        grupo.classList.remove("hidden");
        unidad.required = true;
    } else {
        grupo.classList.add("hidden");
        unidad.required = false;
        unidad.value = "";
    }
}

/* =========================================================
   FILTROS
========================================================= */

function configurarFiltrosCuotas() {

    const filtros = [
        "filtroEdificioCuota",
        "filtroPeriodoCuota",
        "filtroTipoCuota",
        "filtroEstadoCuota",
        "busquedaCuota"
    ];

    filtros.forEach(id => {

        const elemento = document.getElementById(id);

        if (!elemento) return;

        elemento.addEventListener("input", cargarPaginaPagos);
        elemento.addEventListener("change", cargarPaginaPagos);
    });

    const limpiar = document.getElementById("btnLimpiarFiltrosCuotas");

    limpiar?.addEventListener("click", () => {

        filtros.forEach(id => {

            const elemento = document.getElementById(id);

            if (elemento) {
                elemento.value = "";
            }
        });

        cargarPaginaPagos();
    });
}

function obtenerCuotasFiltradasAdmin() {

    let cuotas = obtenerCuotasVisiblesAdmin();

    const edificio = document.getElementById("filtroEdificioCuota")?.value || "";
    const periodo = document.getElementById("filtroPeriodoCuota")?.value || "";
    const tipo = document.getElementById("filtroTipoCuota")?.value || "";
    const estado = document.getElementById("filtroEstadoCuota")?.value || "";

    const busqueda = (
        document.getElementById("busquedaCuota")?.value || ""
    ).toLowerCase().trim();

    if (edificio) {
        cuotas = cuotas.filter(item =>
            String(item.edificioId || "") === String(edificio)
        );
    }

    if (periodo) {
        cuotas = cuotas.filter(item =>
            String(item.periodo || "") === String(periodo)
        );
    }

    if (tipo) {
        cuotas = cuotas.filter(item =>
            normalizarTipoCuota(item.tipo) === tipo
        );
    }

    if (estado) {
        cuotas = cuotas.filter(item =>
            normalizarEstadoCuota(item.estado) === estado
        );
    }

    if (busqueda) {
        cuotas = cuotas.filter(item => {

            const texto = `
                ${item.concepto || ""}
                ${item.periodo || ""}
            `.toLowerCase();

            return texto.includes(busqueda);
        });
    }

    return cuotas.sort((a, b) =>
        String(b.fechaRegistro || "").localeCompare(
            String(a.fechaRegistro || "")
        )
    );
}

function obtenerPagosFiltradosAdmin() {
    return obtenerPagosVisiblesAdmin()
        .sort((a, b) =>
            String(b.fechaRegistro || "").localeCompare(
                String(a.fechaRegistro || "")
            )
        );
}

/* =========================================================
   TABLA CUOTAS
========================================================= */

function renderizarTablaCuotas(cuotas) {

    const tabla = document.getElementById("tablaCuotasAdmin");

    if (!tabla) return;

    if (cuotas.length === 0) {

        tabla.innerHTML = `
            <tr>
                <td colspan="9">
                    No se encontraron cuotas.
                </td>
            </tr>
        `;

        return;
    }

    const db = obtenerTodo();

    tabla.innerHTML = cuotas.map(cuota => {

        const edificio = obtenerNombreEdificioPago(
            db,
            cuota.edificioId
        );

        const unidad = obtenerNombreUnidadPago(
            db,
            cuota.unidadId
        );

        return `
            <tr>

                <td>
                    <strong>${escapeHTMLPago(cuota.concepto)}</strong>
                </td>

                <td>${escapeHTMLPago(edificio)}</td>

                <td>${escapeHTMLPago(unidad)}</td>

                <td>
                    <span class="badge ${claseTipoCuota(cuota.tipo)}">
                        ${formatearTipoCuota(cuota.tipo)}
                    </span>
                </td>

                <td>${escapeHTMLPago(cuota.periodo)}</td>

                <td>
                    S/ ${formatearMontoPago(cuota.monto)}
                </td>

                <td>
                    ${formatearFechaPago(cuota.fechaVencimiento)}
                </td>

                <td>
                    <span class="badge ${claseEstadoCuota(cuota.estado)}">
                        ${formatearEstadoCuota(cuota.estado)}
                    </span>
                </td>

                <td class="table-actions">

                    <button
                        class="btn btn-blue"
                        onclick="verDetalleCuota('${cuota.id}')"
                    >
                        Ver
                    </button>

                    ${renderizarBotonAnularCuota(cuota)}

                </td>

            </tr>
        `;
    }).join("");
}

function renderizarBotonAnularCuota(cuota) {

    const estado = normalizarEstadoCuota(cuota.estado);

    if (estado === "pagado" || estado === "anulado") {
        return "";
    }

    return `
        <button
            class="btn btn-red"
            onclick="anularCuotaAdmin('${cuota.id}')"
        >
            Anular
        </button>
    `;
}

/* =========================================================
   TABLA COMPROBANTES
========================================================= */

function renderizarTablaComprobantes(pagos) {

    const tabla = document.getElementById("tablaComprobantesAdmin");

    if (!tabla) return;

    if (pagos.length === 0) {

        tabla.innerHTML = `
            <tr>
                <td colspan="8">
                    No hay comprobantes registrados.
                </td>
            </tr>
        `;

        return;
    }

    const db = obtenerTodo();

    tabla.innerHTML = pagos.map(pago => {

        const cuota = obtenerCuotaPorId(pago.cuotaId);

        if (!cuota) return "";

        const unidad = obtenerNombreUnidadPago(
            db,
            cuota.unidadId
        );

        return `
            <tr>

                <td>${escapeHTMLPago(unidad)}</td>

                <td>
                    ${escapeHTMLPago(cuota.concepto)}
                </td>

                <td>${escapeHTMLPago(pago.banco)}</td>

                <td>${escapeHTMLPago(pago.numeroOperacion)}</td>

                <td>
                    ${formatearFechaPago(pago.fechaPago)}
                </td>

                <td>
                    S/ ${formatearMontoPago(pago.montoDeclarado)}
                </td>

                <td>
                    <span class="badge ${claseEstadoPago(pago.estadoValidacion)}">
                        ${formatearEstadoPago(pago.estadoValidacion)}
                    </span>
                </td>

                <td class="table-actions">

                    <button
                        class="btn btn-blue"
                        onclick="verComprobantePago('${pago.id}')"
                    >
                        Ver
                    </button>

                    ${renderizarBotonValidacionPago(pago)}

                </td>

            </tr>
        `;
    }).join("");
}

function renderizarBotonValidacionPago(pago) {

    if (
        normalizarEstadoPago(pago.estadoValidacion) !== "pendiente"
    ) {
        return "";
    }

    return `
        <button
            class="btn btn-green"
            onclick="abrirModalValidacionPago('${pago.id}')"
        >
            Validar
        </button>
    `;
}

/* =========================================================
   DETALLE CUOTA
========================================================= */

function configurarModalDetalleCuota() {

    const cerrar = document.getElementById("cerrarModalDetalleCuota");

    cerrar?.addEventListener("click", () => {
        cerrarModalPago("modalDetalleCuota");
    });

    window.addEventListener("click", event => {

        const modal = document.getElementById("modalDetalleCuota");

        if (event.target === modal) {
            cerrarModalPago("modalDetalleCuota");
        }
    });
}

function verDetalleCuota(idCuota) {

    const cuota = obtenerCuotaPorId(idCuota);

    if (!cuota) {
        alert("Cuota no encontrada.");
        return;
    }

    const db = obtenerTodo();

    const edificio = obtenerNombreEdificioPago(
        db,
        cuota.edificioId
    );

    const unidad = obtenerNombreUnidadPago(
        db,
        cuota.unidadId
    );

    const detalle = document.getElementById("detalleCuotaAdmin");

    if (!detalle) return;

    detalle.innerHTML = `

        <div class="detail-grid">

            <div class="detail-card">

                <h3>${escapeHTMLPago(cuota.concepto)}</h3>

                <div class="detail-meta">

                    <div>
                        <strong>Edificio:</strong>
                        ${escapeHTMLPago(edificio)}
                    </div>

                    <div>
                        <strong>Unidad:</strong>
                        ${escapeHTMLPago(unidad)}
                    </div>

                    <div>
                        <strong>Tipo:</strong>
                        ${formatearTipoCuota(cuota.tipo)}
                    </div>

                    <div>
                        <strong>Periodo:</strong>
                        ${escapeHTMLPago(cuota.periodo)}
                    </div>

                    <div>
                        <strong>Monto:</strong>
                        S/ ${formatearMontoPago(cuota.monto)}
                    </div>

                    <div>
                        <strong>Estado:</strong>

                        <span class="badge ${claseEstadoCuota(cuota.estado)}">
                            ${formatearEstadoCuota(cuota.estado)}
                        </span>
                    </div>

                    <div>
                        <strong>Vencimiento:</strong>
                        ${formatearFechaPago(cuota.fechaVencimiento)}
                    </div>

                </div>

                ${renderizarObservacionCuota(cuota)}

            </div>

            ${renderizarComprobanteBaseCuota(cuota)}

        </div>

        ${renderizarHistorialCuota(cuota)}

    `;

    abrirModalPago("modalDetalleCuota");
}

function renderizarObservacionCuota(cuota) {

    if (!cuota.observacion) return "";

    return `
        <section class="detail-section">

            <h3>Observación</h3>

            <div class="detail-observation">
                ${escapeHTMLPago(cuota.observacion)}
            </div>

        </section>
    `;
}

function renderizarComprobanteBaseCuota(cuota) {

    if (!cuota.comprobanteBase) return "";

    if (cuota.comprobanteBase.includes("application/pdf")) {

        return `
            <div class="detail-image-container">

                <iframe
                    src="${cuota.comprobanteBase}"
                    class="pdf-viewer"
                ></iframe>

            </div>
        `;
    }

    return `
        <div class="detail-image-container">

            <img
                src="${cuota.comprobanteBase}"
                class="detail-image"
                alt="Comprobante base"
            >

        </div>
    `;
}

function renderizarHistorialCuota(cuota) {

    const historial = cuota.historial || [];

    if (historial.length === 0) return "";

    return `
        <section class="detail-section">

            <h3>Historial</h3>

            <div class="timeline">

                ${historial.map(item => `

                    <div class="timeline-item">

                        <div class="timeline-badge ${claseEstadoCuota(item.estado)}">
                            ${formatearEstadoCuota(item.estado)}
                        </div>

                        <div class="timeline-content">

                            <strong>
                                ${escapeHTMLPago(item.usuarioNombre || "Sistema")}
                            </strong>

                            <p>
                                ${escapeHTMLPago(item.observacion || "-")}
                            </p>

                            <small>
                                ${formatearFechaPago(item.fecha)}
                            </small>

                        </div>

                    </div>

                `).join("")}

            </div>

        </section>
    `;
}

/* =========================================================
   ANULAR CUOTA
========================================================= */

function anularCuotaAdmin(idCuota) {

    const confirmacion = confirm(
        "¿Deseas anular esta cuota?"
    );

    if (!confirmacion) return;

    const observacion = prompt(
        "Ingrese la observación de anulación:",
        "Cuota anulada por administración."
    );

    if (!observacion) return;

    const resultado = anularCuota(
        idCuota,
        observacion
    );

    if (!resultado.ok) {
        alert(resultado.error);
        return;
    }

    cargarPaginaPagos();

    alert("Cuota anulada correctamente.");
}

/* =========================================================
   VALIDACIÓN PAGOS
========================================================= */

function configurarModalValidacionPago() {

    const cerrar = document.getElementById("cerrarModalValidarPago");

    cerrar?.addEventListener("click", () => {
        cerrarModalPago("modalValidarPago");
    });

    document.getElementById("btnCancelarValidacionPago")
        ?.addEventListener("click", () => {
            cerrarModalPago("modalValidarPago");
        });

    document.getElementById("btnConfirmarValidacionPago")
        ?.addEventListener("click", guardarValidacionPago);

    window.addEventListener("click", event => {

        const modal = document.getElementById("modalValidarPago");

        if (event.target === modal) {
            cerrarModalPago("modalValidarPago");
        }
    });
}

function abrirModalValidacionPago(idPago) {

    document.getElementById("pagoValidacionId").value = idPago;

    document.getElementById("accionValidacionPago").value = "";
    document.getElementById("observacionValidacionPago").value = "";

    abrirModalPago("modalValidarPago");
}

function guardarValidacionPago() {

    const idPago = document.getElementById("pagoValidacionId")?.value || "";

    const accion = document.getElementById("accionValidacionPago")?.value || "";

    const observacion = (
        document.getElementById("observacionValidacionPago")?.value || ""
    ).trim();

    if (!accion) {
        alert("Seleccione una acción.");
        return;
    }

    if (!observacion) {
        alert("Ingrese una observación.");
        return;
    }

    let resultado;

    if (accion === "aprobar") {
        resultado = aprobarPago(idPago, observacion);
    } else {
        resultado = rechazarPago(idPago, observacion);
    }

    if (!resultado.ok) {
        alert(resultado.error);
        return;
    }

    cerrarModalPago("modalValidarPago");

    cargarPaginaPagos();

    alert("Pago validado correctamente.");
}

/* =========================================================
   VER COMPROBANTE
========================================================= */

function configurarModalComprobantePago() {

    const cerrar = document.getElementById("cerrarModalComprobantePago");

    cerrar?.addEventListener("click", () => {
        cerrarModalPago("modalComprobantePago");
    });

    window.addEventListener("click", event => {

        const modal = document.getElementById("modalComprobantePago");

        if (event.target === modal) {
            cerrarModalPago("modalComprobantePago");
        }
    });
}

function verComprobantePago(idPago) {

    const pago = obtenerPagoPorId(idPago);

    if (!pago) {
        alert("Pago no encontrado.");
        return;
    }

    const visor = document.getElementById("visorComprobantePago");

    if (!visor) return;

    if (
        String(pago.voucher || "").includes("application/pdf")
    ) {

        visor.innerHTML = `
            <iframe
                src="${pago.voucher}"
                class="pdf-viewer"
            ></iframe>
        `;

    } else {

        visor.innerHTML = `
            <img
                src="${pago.voucher}"
                class="detail-image"
                alt="Comprobante"
            >
        `;
    }

    abrirModalPago("modalComprobantePago");
}

/* =========================================================
   ALERTAS DUPLICADOS
========================================================= */

function mostrarAlertaDuplicados(mensaje, callback) {

    const alerta = document.getElementById("alertaDuplicadosCuota");

    if (!alerta) return;

    alerta.classList.remove("hidden");

    alerta.innerHTML = `
        <div class="alert-warning">

            <strong>Posible duplicado detectado</strong>

            <p>${escapeHTMLPago(mensaje)}</p>

            <div class="form-actions">

                <button
                    type="button"
                    class="btn btn-red"
                    id="btnCancelarDuplicados"
                >
                    Cancelar
                </button>

                <button
                    type="button"
                    class="btn btn-blue"
                    id="btnContinuarDuplicados"
                >
                    Generar igualmente
                </button>

            </div>

        </div>
    `;

    document.getElementById("btnCancelarDuplicados")
        ?.addEventListener("click", ocultarAlertaDuplicados);

    document.getElementById("btnContinuarDuplicados")
        ?.addEventListener("click", callback);
}

function ocultarAlertaDuplicados() {

    const alerta = document.getElementById("alertaDuplicadosCuota");

    if (!alerta) return;

    alerta.classList.add("hidden");
    alerta.innerHTML = "";
}

/* =========================================================
   SELECTS
========================================================= */

function cargarSelectEdificiosPagos() {

    const selects = [
        "edificioCuota",
        "filtroEdificioCuota"
    ];

    const edificios = obtenerEdificiosPermitidosVistaPago();

    selects.forEach(id => {

        const select = document.getElementById(id);

        if (!select) return;

        const valorActual = select.value;

        const esFiltro = id.includes("filtro");

        select.innerHTML = esFiltro
            ? `<option value="">Todos los edificios</option>`
            : `<option value="">Seleccione edificio...</option>`;

        edificios.forEach(edificio => {

            select.innerHTML += `
                <option value="${edificio.id}">
                    ${escapeHTMLPago(edificio.nombre)}
                </option>
            `;
        });

        if (
            edificios.some(item =>
                String(item.id) === String(valorActual)
            )
        ) {
            select.value = valorActual;
        }
    });
}

function cargarSelectUnidadesPagos() {

    const select = document.getElementById("unidadCuota");

    if (!select) return;

    const db = obtenerTodo();

    const edificioId =
        document.getElementById("edificioCuota")?.value || "";

    const unidades = obtenerUnidadesActivasParaCuota(
        db,
        edificioId
    );

    const valorActual = select.value;

    select.innerHTML = `
        <option value="">
            Seleccione unidad...
        </option>
    `;

    unidades.forEach(unidad => {

        select.innerHTML += `
            <option value="${unidad.id}">
                ${escapeHTMLPago(unidad.numero || "-")} -
                ${escapeHTMLPago(formatearTipoUnidadPagoVista(unidad.tipo))}
            </option>
        `;
    });

    if (
        unidades.some(item =>
            String(item.id) === String(valorActual)
        )
    ) {
        select.value = valorActual;
    }
}

/* =========================================================
   ARCHIVOS BASE64
========================================================= */

function obtenerArchivoBase64Pago(input) {

    return new Promise(resolve => {

        if (
            !input ||
            !input.files ||
            input.files.length === 0
        ) {
            resolve("");
            return;
        }

        const archivo = input.files[0];

        const maxMB = 5;
        const maxBytes = maxMB * 1024 * 1024;

        if (archivo.size > maxBytes) {

            alert(`El archivo no debe superar ${maxMB}MB.`);

            input.value = "";

            resolve("");

            return;
        }

        const reader = new FileReader();

        reader.onload = event => {
            resolve(event.target.result);
        };

        reader.onerror = () => {
            alert("No se pudo leer el archivo.");
            resolve("");
        };

        reader.readAsDataURL(archivo);
    });
}

/* =========================================================
   HELPERS
========================================================= */

function obtenerSesionPagos() {

    try {
        return JSON.parse(
            localStorage.getItem("usuarioSesion")
        );
    } catch (error) {
        return null;
    }
}

function obtenerEdificiosPermitidosVistaPago() {

    const db = obtenerTodo();
    const sesion = obtenerSesionPagos();

    if (!sesion) return [];

    if (sesion.rol === "superadmin") {
        return db.edificios || [];
    }

    const ids = obtenerEdificiosPermitidosPago(sesion);

    return (db.edificios || []).filter(item =>
        ids.includes(String(item.id))
    );
}

function obtenerNombreEdificioPago(db, id) {

    const edificio = (db.edificios || []).find(item =>
        String(item.id) === String(id)
    );

    return edificio?.nombre || "-";
}

function obtenerNombreUnidadPago(db, id) {

    const unidad = (db.departamentos || []).find(item =>
        String(item.id) === String(id)
    );

    if (!unidad) return "-";

    return `${unidad.numero || "-"} - ${formatearTipoUnidadPagoVista(unidad.tipo)}`;
}

function formatearTipoUnidadPagoVista(tipo) {

    const valor = String(tipo || "")
        .toLowerCase()
        .trim();

    if (valor === "oficina" || valor === "local") {
        return "Oficina";
    }

    if (valor === "deposito" || valor === "depósito") {
        return "Depósito";
    }

    if (valor === "estacionamiento") {
        return "Estacionamiento";
    }

    return "Departamento";
}

function abrirModalPago(id) {

    const modal = document.getElementById(id);

    if (modal) {
        modal.style.display = "flex";
    }
}

function cerrarModalPago(id) {

    const modal = document.getElementById(id);

    if (modal) {
        modal.style.display = "none";
    }
}

function setTextPago(id, valor) {

    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.textContent = valor;
    }
}

function escapeHTMLPago(texto) {

    return String(texto || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}