document.addEventListener("DOMContentLoaded", () => {
    protegerPaginaMisPagos();

    inicializarPagosService();

    if (typeof inicializarRecordatoriosService === "function") {
        inicializarRecordatoriosService();
    }

    if (typeof inicializarMorosidadService === "function") {
        inicializarMorosidadService();
    }

    if (typeof inicializarDashboardFinancieroService === "function") {
        inicializarDashboardFinancieroService();
    }

    if (typeof ejecutarRecordatoriosAutomaticos === "function") {
        ejecutarRecordatoriosAutomaticos();
    }

    cargarPaginaMisPagos();

    configurarFiltrosMisPagos();

    configurarModalDetallePago();
    configurarModalRegistrarPago();
    configurarModalVerVoucher();
});

/* =========================================================
   SEGURIDAD
========================================================= */

function protegerPaginaMisPagos() {
    const sesion = obtenerSesionMisPagos();

    if (!sesion) {
        window.location.href = "../../../index.html";
        return;
    }

    if (sesion.rol !== "residente") {
        alert("Esta sección corresponde al residente.");
        window.location.href = "../admin/dashboard.html";
    }
}

/* =========================================================
   CARGA PRINCIPAL
========================================================= */

function cargarPaginaMisPagos() {
    const cuotas = obtenerCuotasFiltradasResidente();
    const pagos = obtenerPagosFiltradosResidente();

    cargarMetricasResidente(cuotas);
    renderizarEstadoFinanciero(cuotas);
    renderizarAlertasPagosResidente(cuotas, pagos);

    renderizarTablaMisPagos(cuotas);
    renderizarHistorialPagos(pagos);
}

/* =========================================================
   MÉTRICAS
========================================================= */

function cargarMetricasResidente(cuotas) {
    let metricas;

    if (typeof obtenerResumenFinancieroResidente === "function") {
        metricas = obtenerResumenFinancieroResidente().metricas;
    } else {
        metricas = calcularMetricasCuotas(cuotas);
    }

    setTextMisPagos("totalCuotasResidente", metricas.totalCuotas || 0);

    setTextMisPagos(
        "cuotasPendientesResidente",
        metricas.cuotasPendientes ?? metricas.pendientes ?? 0
    );

    setTextMisPagos(
        "cuotasVencidasResidente",
        metricas.cuotasVencidas ?? metricas.vencidas ?? 0
    );

    setTextMisPagos(
        "cuotasPagadasResidente",
        metricas.cuotasPagadas ?? metricas.pagadas ?? 0
    );

    setTextMisPagos(
        "totalPendienteResidente",
        `S/ ${formatearMontoMisPagosSeguro(metricas.totalPendiente)}`
    );

    setTextMisPagos(
        "porcentajePagadoResidente",
        `${metricas.porcentajeCobranza || 0}%`
    );
}

function renderizarEstadoFinanciero(cuotas) {
    const contenedor = document.getElementById("mensajeEstadoFinanciero");

    if (!contenedor) return;

    if (typeof obtenerEstadoFinancieroResidente === "function") {
        const estado = obtenerEstadoFinancieroResidente();

        if (estado.estado === "moroso") {
            contenedor.innerHTML = `
                <strong style="color:#e74c3c;">
                    ${escapeHTMLMisPagos(estado.mensaje)}
                </strong>
                Total vencido: S/ ${formatearMontoMisPagosSeguro(estado.totalVencido)}.
            `;
            return;
        }

        if (estado.estado === "pendiente") {
            contenedor.innerHTML = `
                <strong style="color:#b7791f;">
                    ${escapeHTMLMisPagos(estado.mensaje)}
                </strong>
                Total pendiente: S/ ${formatearMontoMisPagosSeguro(estado.totalPendiente)}.
            `;
            return;
        }

        contenedor.innerHTML = `
            <strong style="color:#27ae60;">
                ${escapeHTMLMisPagos(estado.mensaje)}
            </strong>
            Gracias por mantener tus pagos al día.
        `;
        return;
    }

    const pendientes = cuotas.filter(item =>
        normalizarEstadoCuota(item.estado) === "pendiente"
    ).length;

    const vencidas = cuotas.filter(item =>
        normalizarEstadoCuota(item.estado) === "vencido"
    ).length;

    const observadas = cuotas.filter(item =>
        normalizarEstadoCuota(item.estado) === "observado"
    ).length;

    if (vencidas > 0) {
        contenedor.innerHTML = `
            <strong style="color:#e74c3c;">
                Tienes ${vencidas} cuota(s) vencida(s).
            </strong>
            Regulariza tus pagos para evitar restricciones.
        `;
        return;
    }

    if (pendientes > 0) {
        contenedor.innerHTML = `
            Tienes ${pendientes} cuota(s) pendiente(s) de pago.
        `;
        return;
    }

    if (observadas > 0) {
        contenedor.innerHTML = `
            Tienes comprobantes pendientes de validación.
        `;
        return;
    }

    contenedor.innerHTML = `
        <strong style="color:#27ae60;">
            No tienes deudas pendientes.
        </strong>
        Gracias por mantener tus pagos al día.
    `;
}

/* =========================================================
   ALERTAS RESIDENTE
========================================================= */

function renderizarAlertasPagosResidente(cuotas, pagos) {
    const contenedor = document.getElementById("alertasPagosResidente");

    if (!contenedor) return;

    const alertas = [];

    const vencidas = cuotas.filter(cuota =>
        normalizarEstadoCuota(cuota.estado) === "vencido"
    );

    const pendientes = cuotas.filter(cuota =>
        normalizarEstadoCuota(cuota.estado) === "pendiente"
    );

    const observadas = cuotas.filter(cuota =>
        normalizarEstadoCuota(cuota.estado) === "observado"
    );

    const pagosRechazados = pagos.filter(pago =>
        normalizarEstadoPago(pago.estadoValidacion) === "rechazado"
    );

    if (vencidas.length > 0) {
        const total = vencidas.reduce((sum, cuota) => {
            return sum + Number(cuota.monto || 0);
        }, 0);

        alertas.push({
            prioridad: "alta",
            titulo: "Cuotas vencidas",
            mensaje: `Tienes ${vencidas.length} cuota(s) vencida(s) por S/ ${formatearMontoMisPagosSeguro(total)}.`
        });
    }

    if (pendientes.length > 0) {
        alertas.push({
            prioridad: "media",
            titulo: "Pagos pendientes",
            mensaje: `Tienes ${pendientes.length} cuota(s) pendiente(s) de pago.`
        });
    }

    if (observadas.length > 0) {
        alertas.push({
            prioridad: "normal",
            titulo: "Comprobantes en revisión",
            mensaje: `Tienes ${observadas.length} comprobante(s) pendiente(s) de validación.`
        });
    }

    if (pagosRechazados.length > 0) {
        alertas.push({
            prioridad: "alta",
            titulo: "Comprobantes observados",
            mensaje: `Tienes ${pagosRechazados.length} comprobante(s) rechazado(s). Revisa la observación y vuelve a registrar el pago.`
        });
    }

    if (alertas.length === 0) {
        contenedor.innerHTML = `
            <p class="empty-text">No tienes alertas pendientes.</p>
        `;
        return;
    }

    contenedor.innerHTML = alertas.map(alerta => `
        <div class="alert-card ${claseAlertaMisPagos(alerta.prioridad)}">
            <strong>${escapeHTMLMisPagos(alerta.titulo)}</strong>
            <p>${escapeHTMLMisPagos(alerta.mensaje)}</p>
        </div>
    `).join("");
}

function claseAlertaMisPagos(prioridad) {
    if (prioridad === "alta") return "alert-danger";
    if (prioridad === "media") return "alert-warning";

    return "alert-info";
}

/* =========================================================
   FILTROS
========================================================= */

function configurarFiltrosMisPagos() {
    const filtros = [
        "filtroEstadoPagoResidente",
        "filtroPeriodoPagoResidente",
        "filtroTipoPagoResidente",
        "buscarPagoResidente"
    ];

    filtros.forEach(id => {
        const elemento = document.getElementById(id);

        if (!elemento) return;

        elemento.addEventListener("input", cargarPaginaMisPagos);
        elemento.addEventListener("change", cargarPaginaMisPagos);
    });

    document.getElementById("btnLimpiarFiltrosPagos")
        ?.addEventListener("click", () => {
            filtros.forEach(id => {
                const elemento = document.getElementById(id);

                if (elemento) {
                    elemento.value = "";
                }
            });

            cargarPaginaMisPagos();
        });
}

function obtenerCuotasFiltradasResidente() {
    let cuotas = obtenerCuotasVisiblesResidente();

    const estado = document.getElementById("filtroEstadoPagoResidente")?.value || "";
    const periodo = document.getElementById("filtroPeriodoPagoResidente")?.value || "";
    const tipo = document.getElementById("filtroTipoPagoResidente")?.value || "";

    const busqueda = (
        document.getElementById("buscarPagoResidente")?.value || ""
    ).toLowerCase().trim();

    if (estado) {
        cuotas = cuotas.filter(item =>
            normalizarEstadoCuota(item.estado) === estado
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

function obtenerPagosFiltradosResidente() {
    return obtenerPagosVisiblesResidente()
        .sort((a, b) =>
            String(b.fechaRegistro || "").localeCompare(
                String(a.fechaRegistro || "")
            )
        );
}

/* =========================================================
   TABLA CUOTAS
========================================================= */

function renderizarTablaMisPagos(cuotas) {
    const tabla = document.getElementById("tablaMisPagos");

    if (!tabla) return;

    if (cuotas.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="7">
                    No tienes cuotas registradas.
                </td>
            </tr>
        `;
        return;
    }

    tabla.innerHTML = cuotas.map(cuota => `
        <tr>
            <td>
                <strong>${escapeHTMLMisPagos(cuota.concepto)}</strong>
            </td>

            <td>
                <span class="badge ${claseTipoCuota(cuota.tipo)}">
                    ${formatearTipoCuota(cuota.tipo)}
                </span>
            </td>

            <td>${escapeHTMLMisPagos(cuota.periodo)}</td>

            <td>S/ ${formatearMontoPago(cuota.monto)}</td>

            <td>${formatearFechaPago(cuota.fechaVencimiento)}</td>

            <td>
                <span class="badge ${claseEstadoCuota(cuota.estado)}">
                    ${formatearEstadoCuota(cuota.estado)}
                </span>
            </td>

            <td class="table-actions">
                <button
                    class="btn btn-blue"
                    onclick="verDetallePagoResidente('${cuota.id}')"
                >
                    Ver
                </button>

                ${renderizarBotonPagar(cuota)}
            </td>
        </tr>
    `).join("");
}

function renderizarBotonPagar(cuota) {
    const estado = normalizarEstadoCuota(cuota.estado);

    if (
        estado === "pagado" ||
        estado === "anulado" ||
        estado === "observado"
    ) {
        return "";
    }

    return `
        <button
            class="btn btn-green"
            onclick="abrirModalRegistrarPago('${cuota.id}')"
        >
            Pagar
        </button>
    `;
}

/* =========================================================
   TABLA HISTORIAL
========================================================= */

function renderizarHistorialPagos(pagos) {
    const tabla = document.getElementById("tablaHistorialPagos");

    if (!tabla) return;

    if (pagos.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="7">
                    No tienes comprobantes registrados.
                </td>
            </tr>
        `;
        return;
    }

    tabla.innerHTML = pagos.map(pago => {
        const cuota = obtenerCuotaPorId(pago.cuotaId);

        if (!cuota) return "";

        return `
            <tr>
                <td>${escapeHTMLMisPagos(cuota.concepto)}</td>
                <td>${escapeHTMLMisPagos(pago.banco)}</td>
                <td>${escapeHTMLMisPagos(pago.numeroOperacion)}</td>
                <td>${formatearFechaPago(pago.fechaPago)}</td>
                <td>S/ ${formatearMontoPago(pago.montoDeclarado)}</td>

                <td>
                    <span class="badge ${claseEstadoPago(pago.estadoValidacion)}">
                        ${formatearEstadoPago(pago.estadoValidacion)}
                    </span>
                </td>

                <td class="table-actions">
                    <button
                        class="btn btn-blue"
                        onclick="verVoucherResidente('${pago.id}')"
                    >
                        Ver
                    </button>

                    ${renderizarBotonReenviarPago(pago)}
                </td>
            </tr>
        `;
    }).join("");
}

function renderizarBotonReenviarPago(pago) {
    const estado = normalizarEstadoPago(pago.estadoValidacion);

    if (estado !== "rechazado") return "";

    return `
        <button
            class="btn btn-green"
            onclick="abrirModalRegistrarPago('${pago.cuotaId}')"
        >
            Reenviar
        </button>
    `;
}

/* =========================================================
   DETALLE CUOTA
========================================================= */

function configurarModalDetallePago() {
    document.getElementById("cerrarModalDetallePagoResidente")
        ?.addEventListener("click", () => {
            cerrarModalMisPagos("modalDetallePagoResidente");
        });

    window.addEventListener("click", event => {
        const modal = document.getElementById("modalDetallePagoResidente");

        if (event.target === modal) {
            cerrarModalMisPagos("modalDetallePagoResidente");
        }
    });
}

function verDetallePagoResidente(idCuota) {
    const cuota = obtenerCuotaPorId(idCuota);

    if (!cuota) {
        alert("Cuota no encontrada.");
        return;
    }

    const detalle = document.getElementById("detallePagoResidente");

    if (!detalle) return;

    detalle.innerHTML = `
        <div class="detail-grid">
            <div class="detail-card">
                <h3>${escapeHTMLMisPagos(cuota.concepto)}</h3>

                <div class="detail-meta">
                    <div><strong>Tipo:</strong> ${formatearTipoCuota(cuota.tipo)}</div>
                    <div><strong>Periodo:</strong> ${escapeHTMLMisPagos(cuota.periodo)}</div>
                    <div><strong>Monto:</strong> S/ ${formatearMontoPago(cuota.monto)}</div>
                    <div><strong>Vencimiento:</strong> ${formatearFechaPago(cuota.fechaVencimiento)}</div>
                    <div>
                        <strong>Estado:</strong>
                        <span class="badge ${claseEstadoCuota(cuota.estado)}">
                            ${formatearEstadoCuota(cuota.estado)}
                        </span>
                    </div>
                </div>

                ${renderizarObservacionCuotaResidente(cuota)}
            </div>

            ${renderizarComprobanteBaseResidente(cuota)}
        </div>

        ${renderizarHistorialCuotaResidente(cuota)}
    `;

    abrirModalMisPagos("modalDetallePagoResidente");
}

function renderizarObservacionCuotaResidente(cuota) {
    if (!cuota.observacion) return "";

    return `
        <section class="detail-section">
            <h3>Observación</h3>
            <div class="detail-observation">
                ${escapeHTMLMisPagos(cuota.observacion)}
            </div>
        </section>
    `;
}

function renderizarComprobanteBaseResidente(cuota) {
    if (!cuota.comprobanteBase) return "";

    if (String(cuota.comprobanteBase).includes("application/pdf")) {
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

function renderizarHistorialCuotaResidente(cuota) {
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
                            <strong>${escapeHTMLMisPagos(item.usuarioNombre || "Sistema")}</strong>
                            <p>${escapeHTMLMisPagos(item.observacion || "-")}</p>
                            <small>${formatearFechaPago(item.fecha)}</small>
                        </div>
                    </div>
                `).join("")}
            </div>
        </section>
    `;
}

/* =========================================================
   REGISTRAR PAGO
========================================================= */

function configurarModalRegistrarPago() {
    document.getElementById("cerrarModalRegistrarPago")
        ?.addEventListener("click", () => {
            cerrarModalMisPagos("modalRegistrarPago");
        });

    document.getElementById("btnCancelarPagoResidente")
        ?.addEventListener("click", () => {
            cerrarModalMisPagos("modalRegistrarPago");
        });

    document.getElementById("formRegistrarPago")
        ?.addEventListener("submit", registrarPagoResidente);

    window.addEventListener("click", event => {
        const modal = document.getElementById("modalRegistrarPago");

        if (event.target === modal) {
            cerrarModalMisPagos("modalRegistrarPago");
        }
    });
}

function abrirModalRegistrarPago(idCuota) {
    const cuota = obtenerCuotaPorId(idCuota);

    if (!cuota) {
        alert("Cuota no encontrada.");
        return;
    }

    const form = document.getElementById("formRegistrarPago");

    if (form) {
        form.reset();
    }

    document.getElementById("cuotaPagoId").value = cuota.id;
    document.getElementById("montoPagoResidente").value = cuota.monto;
    document.getElementById("fechaPagoResidente").value = obtenerFechaHoyMisPagos();

    abrirModalMisPagos("modalRegistrarPago");
}

async function registrarPagoResidente(event) {
    event.preventDefault();

    const cuotaId = document.getElementById("cuotaPagoId")?.value || "";

    const voucher = await obtenerArchivoBase64MisPagos(
        document.getElementById("voucherPagoResidente")
    );

    const datos = {
        cuotaId,
        banco: document.getElementById("bancoPagoResidente")?.value || "",
        numeroOperacion: document.getElementById("numeroOperacionPago")?.value || "",
        fechaPago: document.getElementById("fechaPagoResidente")?.value || "",
        montoDeclarado: document.getElementById("montoPagoResidente")?.value || "",
        voucher
    };

    const resultado = registrarComprobantePago(datos);

    if (!resultado.ok) {
        alert(resultado.error);
        return;
    }

    cerrarModalMisPagos("modalRegistrarPago");

    if (typeof ejecutarRecordatoriosAutomaticos === "function") {
        ejecutarRecordatoriosAutomaticos();
    }

    cargarPaginaMisPagos();

    alert("Comprobante enviado correctamente.");
}

/* =========================================================
   VER VOUCHER
========================================================= */

function configurarModalVerVoucher() {
    document.getElementById("cerrarModalVerVoucherResidente")
        ?.addEventListener("click", () => {
            cerrarModalMisPagos("modalVerVoucherResidente");
        });

    window.addEventListener("click", event => {
        const modal = document.getElementById("modalVerVoucherResidente");

        if (event.target === modal) {
            cerrarModalMisPagos("modalVerVoucherResidente");
        }
    });
}

function verVoucherResidente(idPago) {
    const pago = obtenerPagoPorId(idPago);

    if (!pago) {
        alert("Pago no encontrado.");
        return;
    }

    const visor = document.getElementById("visorVoucherResidente");

    if (!visor) return;

    if (String(pago.voucher).includes("application/pdf")) {
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
                alt="Voucher"
            >
        `;
    }

    abrirModalMisPagos("modalVerVoucherResidente");
}

/* =========================================================
   ARCHIVOS
========================================================= */

function obtenerArchivoBase64MisPagos(input) {
    return new Promise(resolve => {
        if (!input || !input.files || input.files.length === 0) {
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

function obtenerSesionMisPagos() {
    try {
        return JSON.parse(localStorage.getItem("usuarioSesion"));
    } catch (error) {
        return null;
    }
}

function abrirModalMisPagos(id) {
    const modal = document.getElementById(id);

    if (modal) {
        modal.style.display = "flex";
    }
}

function cerrarModalMisPagos(id) {
    const modal = document.getElementById(id);

    if (modal) {
        modal.style.display = "none";
    }
}

function obtenerFechaHoyMisPagos() {
    const hoy = new Date();

    const year = hoy.getFullYear();
    const month = String(hoy.getMonth() + 1).padStart(2, "0");
    const day = String(hoy.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatearMontoMisPagosSeguro(monto) {
    if (typeof formatearMontoPago === "function") {
        return formatearMontoPago(monto);
    }

    const numero = Number(monto);

    return Number.isFinite(numero)
        ? numero.toFixed(2)
        : "0.00";
}

function setTextMisPagos(id, valor) {
    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.textContent = valor;
    }
}

function escapeHTMLMisPagos(texto) {
    return String(texto || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}