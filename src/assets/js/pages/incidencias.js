document.addEventListener("DOMContentLoaded", () => {
    protegerPaginaIncidencias();

    inicializarIncidenciasService();

    cargarPaginaIncidencias();

    configurarFiltrosIncidencias();
    configurarModalEstadoIncidencia();
    configurarModalDetalleIncidencia();
});

/* =========================================================
   SEGURIDAD
========================================================= */

function protegerPaginaIncidencias() {
    const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));

    if (!sesion) {
        window.location.href = "../../../index.html";
        return;
    }

    if (!["admin", "superadmin"].includes(sesion.rol)) {
        alert("No tienes permisos para acceder.");
        window.location.href = "../residente/dashboard.html";
    }
}

/* =========================================================
   CARGA PRINCIPAL
========================================================= */

function cargarPaginaIncidencias() {
    const incidencias = obtenerIncidenciasFiltradasAdmin();

    cargarResumenIncidencias(incidencias);
    cargarEdificiosFiltro();
    renderizarTablaIncidencias(incidencias);
}

/* =========================================================
   RESUMEN
========================================================= */

function cargarResumenIncidencias(incidencias) {
    const metricas = calcularMetricasIncidencias(incidencias);

    setText("totalIncidencias", metricas.total);
    setText("incidenciasAbiertas", metricas.abiertas);
    setText("incidenciasRevision", metricas.enRevision);
    setText("incidenciasProceso", metricas.enProceso);
    setText("incidenciasResueltas", metricas.resueltas);
    setText("incidenciasUrgentes", metricas.urgentes);
}

/* =========================================================
   FILTROS
========================================================= */

function configurarFiltrosIncidencias() {

    const filtros = [
        "filtroEdificioIncidencia",
        "filtroCategoriaIncidencia",
        "filtroPrioridadIncidencia",
        "filtroEstadoIncidencia",
        "busquedaIncidencia"
    ];

    filtros.forEach(id => {
        const elemento = document.getElementById(id);

        if (!elemento) return;

        elemento.addEventListener("input", cargarPaginaIncidencias);
        elemento.addEventListener("change", cargarPaginaIncidencias);
    });

    const limpiar = document.getElementById("btnLimpiarFiltrosIncidencias");

    if (limpiar) {
        limpiar.addEventListener("click", () => {

            filtros.forEach(id => {
                const elemento = document.getElementById(id);

                if (!elemento) return;

                elemento.value = "";
            });

            cargarPaginaIncidencias();
        });
    }
}

function obtenerIncidenciasFiltradasAdmin() {

    let incidencias = obtenerIncidenciasVisiblesAdmin();

    const edificio = document.getElementById("filtroEdificioIncidencia")?.value || "";
    const categoria = document.getElementById("filtroCategoriaIncidencia")?.value || "";
    const prioridad = document.getElementById("filtroPrioridadIncidencia")?.value || "";
    const estado = document.getElementById("filtroEstadoIncidencia")?.value || "";
    const busqueda = (
        document.getElementById("busquedaIncidencia")?.value || ""
    ).toLowerCase().trim();

    if (edificio) {
        incidencias = incidencias.filter(item =>
            String(item.edificioId || "") === String(edificio)
        );
    }

    if (categoria) {
        incidencias = incidencias.filter(item =>
            normalizarCategoriaIncidencia(item.categoria) === categoria
        );
    }

    if (prioridad) {
        incidencias = incidencias.filter(item =>
            normalizarPrioridadIncidencia(item.prioridad) === prioridad
        );
    }

    if (estado) {
        incidencias = incidencias.filter(item =>
            normalizarEstadoIncidencia(item.estado) === estado
        );
    }

    if (busqueda) {
        incidencias = incidencias.filter(item => {

            const texto = `
                ${item.titulo || ""}
                ${item.descripcion || ""}
                ${item.ubicacion || ""}
                ${item.reportadoPorNombre || ""}
            `.toLowerCase();

            return texto.includes(busqueda);
        });
    }

    return incidencias.sort((a, b) =>
        String(b.fechaRegistro || "").localeCompare(String(a.fechaRegistro || ""))
    );
}

/* =========================================================
   TABLA
========================================================= */

function renderizarTablaIncidencias(incidencias) {

    const tabla = document.getElementById("tablaIncidenciasAdmin");

    if (!tabla) return;

    const db = obtenerTodo();

    if (incidencias.length === 0) {

        tabla.innerHTML = `
            <tr>
                <td colspan="8">
                    No se encontraron incidencias.
                </td>
            </tr>
        `;

        return;
    }

    tabla.innerHTML = incidencias.map(item => {

        const edificio = obtenerNombreEdificioIncidencia(db, item.edificioId);
        const unidad = obtenerNombreUnidadIncidencia(db, item.unidadId);

        return `
            <tr>

                <td>
                    <strong>${escapeHTML(item.titulo)}</strong>

                    <br>

                    <small>
                        ${escapeHTML(item.reportadoPorNombre || "Residente")}
                    </small>
                </td>

                <td>${escapeHTML(edificio)}</td>

                <td>${escapeHTML(unidad)}</td>

                <td>
                    ${formatearCategoriaIncidencia(item.categoria)}
                </td>

                <td>
                    <span class="badge ${clasePrioridadIncidencia(item.prioridad)}">
                        ${formatearPrioridadIncidencia(item.prioridad)}
                    </span>
                </td>

                <td>
                    <span class="badge ${claseEstadoIncidencia(item.estado)}">
                        ${formatearEstadoIncidencia(item.estado)}
                    </span>
                </td>

                <td>
                    ${formatearFechaIncidencia(item.fechaRegistro)}
                </td>

                <td class="table-actions">

                    <button
                        class="btn btn-blue"
                        onclick="verDetalleIncidencia('${item.id}')"
                    >
                        Ver
                    </button>

                    ${renderizarBotonEstadoIncidencia(item)}

                </td>

            </tr>
        `;
    }).join("");
}

function renderizarBotonEstadoIncidencia(item) {

    const estado = normalizarEstadoIncidencia(item.estado);

    if (["resuelta", "cancelada"].includes(estado)) {
        return "";
    }

    return `
        <button
            class="btn btn-secondary"
            onclick="abrirModalEstadoIncidencia('${item.id}')"
        >
            Estado
        </button>
    `;
}

/* =========================================================
   MODAL DETALLE
========================================================= */

function configurarModalDetalleIncidencia() {

    const cerrar = document.getElementById("cerrarModalDetalleIncidencia");

    if (cerrar) {
        cerrar.addEventListener("click", cerrarModalDetalleIncidencia);
    }

    window.addEventListener("click", event => {

        const modal = document.getElementById("modalDetalleIncidencia");

        if (event.target === modal) {
            cerrarModalDetalleIncidencia();
        }
    });
}

function verDetalleIncidencia(id) {

    const incidencia = obtenerIncidenciaPorId(id);

    if (!incidencia) {
        alert("Incidencia no encontrada.");
        return;
    }

    const db = obtenerTodo();

    const edificio = obtenerNombreEdificioIncidencia(db, incidencia.edificioId);
    const unidad = obtenerNombreUnidadIncidencia(db, incidencia.unidadId);

    const contenedor = document.getElementById("detalleIncidenciaAdmin");

    contenedor.innerHTML = `

        <div class="detail-grid">

            <div class="detail-card">

                <h3>${escapeHTML(incidencia.titulo)}</h3>

                <p class="detail-description">
                    ${escapeHTML(incidencia.descripcion)}
                </p>

                <div class="detail-meta">

                    <div>
                        <strong>Categoría:</strong>
                        ${formatearCategoriaIncidencia(incidencia.categoria)}
                    </div>

                    <div>
                        <strong>Prioridad:</strong>

                        <span class="badge ${clasePrioridadIncidencia(incidencia.prioridad)}">
                            ${formatearPrioridadIncidencia(incidencia.prioridad)}
                        </span>
                    </div>

                    <div>
                        <strong>Estado:</strong>

                        <span class="badge ${claseEstadoIncidencia(incidencia.estado)}">
                            ${formatearEstadoIncidencia(incidencia.estado)}
                        </span>
                    </div>

                    <div>
                        <strong>Ubicación:</strong>
                        ${escapeHTML(incidencia.ubicacion)}
                    </div>

                    <div>
                        <strong>Edificio:</strong>
                        ${escapeHTML(edificio)}
                    </div>

                    <div>
                        <strong>Unidad:</strong>
                        ${escapeHTML(unidad)}
                    </div>

                    <div>
                        <strong>Reportado por:</strong>
                        ${escapeHTML(incidencia.reportadoPorNombre)}
                    </div>

                    <div>
                        <strong>Fecha registro:</strong>
                        ${formatearFechaIncidencia(incidencia.fechaRegistro)}
                    </div>

                </div>

            </div>

            ${renderizarImagenIncidencia(incidencia)}

        </div>

        ${renderizarObservacionAdmin(incidencia)}

        ${renderizarHistorialIncidencia(incidencia)}

    `;

    abrirModal("modalDetalleIncidencia");
}

function renderizarImagenIncidencia(incidencia) {

    if (!incidencia.foto) return "";

    return `
        <div class="detail-image-container">

            <img
                src="${incidencia.foto}"
                alt="Evidencia incidencia"
                class="detail-image"
            >

        </div>
    `;
}

function renderizarObservacionAdmin(incidencia) {

    if (!incidencia.observacionAdmin) return "";

    return `
        <section class="detail-section">

            <h3>Última observación</h3>

            <div class="detail-observation">
                ${escapeHTML(incidencia.observacionAdmin)}
            </div>

        </section>
    `;
}

function renderizarHistorialIncidencia(incidencia) {

    const historial = incidencia.historial || [];

    if (historial.length === 0) return "";

    return `
        <section class="detail-section">

            <h3>Historial</h3>

            <div class="timeline">

                ${historial.map(item => `

                    <div class="timeline-item">

                        <div class="timeline-badge ${claseEstadoIncidencia(item.estado)}">
                            ${formatearEstadoIncidencia(item.estado)}
                        </div>

                        <div class="timeline-content">

                            <strong>
                                ${escapeHTML(item.usuarioNombre || "Sistema")}
                            </strong>

                            <p>
                                ${escapeHTML(item.observacion || "-")}
                            </p>

                            <small>
                                ${formatearFechaIncidencia(item.fecha)}
                            </small>

                        </div>

                    </div>

                `).join("")}

            </div>

        </section>
    `;
}

function cerrarModalDetalleIncidencia() {
    cerrarModal("modalDetalleIncidencia");
}

/* =========================================================
   MODAL ESTADO
========================================================= */

function configurarModalEstadoIncidencia() {

    const cerrar = document.getElementById("cerrarModalEstadoIncidencia");
    const cancelar = document.getElementById("btnCancelarEstadoIncidencia");
    const confirmar = document.getElementById("btnConfirmarEstadoIncidencia");

    cerrar?.addEventListener("click", cerrarModalEstadoIncidencia);
    cancelar?.addEventListener("click", cerrarModalEstadoIncidencia);

    confirmar?.addEventListener("click", guardarCambioEstadoIncidencia);

    window.addEventListener("click", event => {

        const modal = document.getElementById("modalEstadoIncidencia");

        if (event.target === modal) {
            cerrarModalEstadoIncidencia();
        }
    });
}

function abrirModalEstadoIncidencia(id) {

    const incidencia = obtenerIncidenciaPorId(id);

    if (!incidencia) {
        alert("Incidencia no encontrada.");
        return;
    }

    document.getElementById("estadoIncidenciaId").value = incidencia.id;
    document.getElementById("nuevoEstadoIncidencia").value = "";
    document.getElementById("observacionEstadoIncidencia").value = "";

    abrirModal("modalEstadoIncidencia");
}

function guardarCambioEstadoIncidencia() {

    const id = document.getElementById("estadoIncidenciaId")?.value || "";
    const estado = document.getElementById("nuevoEstadoIncidencia")?.value || "";
    const observacion = (
        document.getElementById("observacionEstadoIncidencia")?.value || ""
    ).trim();

    if (!estado) {
        alert("Seleccione un estado.");
        return;
    }

    if (!observacion) {
        alert("Ingrese una observación.");
        return;
    }

    const resultado = actualizarEstadoIncidencia(
        id,
        estado,
        observacion
    );

    if (!resultado.ok) {
        alert(resultado.error);
        return;
    }

    cerrarModalEstadoIncidencia();

    cargarPaginaIncidencias();

    alert("Estado actualizado correctamente.");
}

function cerrarModalEstadoIncidencia() {
    cerrarModal("modalEstadoIncidencia");
}

/* =========================================================
   SELECTS
========================================================= */

function cargarEdificiosFiltro() {

    const select = document.getElementById("filtroEdificioIncidencia");

    if (!select) return;

    const valorActual = select.value;

    const incidencias = obtenerIncidenciasVisiblesAdmin();

    const ids = [...new Set(
        incidencias
            .map(item => String(item.edificioId || ""))
            .filter(Boolean)
    )];

    const db = obtenerTodo();

    const edificios = (db.edificios || []).filter(item =>
        ids.includes(String(item.id))
    );

    select.innerHTML = `
        <option value="">
            Todos los edificios
        </option>
    `;

    edificios.forEach(item => {

        select.innerHTML += `
            <option value="${item.id}">
                ${escapeHTML(item.nombre)}
            </option>
        `;
    });

    if (ids.includes(String(valorActual))) {
        select.value = valorActual;
    }
}

/* =========================================================
   HELPERS
========================================================= */

function obtenerNombreEdificioIncidencia(db, id) {

    const edificio = (db.edificios || []).find(item =>
        String(item.id) === String(id)
    );

    return edificio?.nombre || "-";
}

function obtenerNombreUnidadIncidencia(db, id) {

    const unidad = (db.departamentos || []).find(item =>
        String(item.id) === String(id)
    );

    if (!unidad) return "-";

    return `${unidad.numero || "-"} - ${unidad.tipo || "Unidad"}`;
}

function abrirModal(id) {

    const modal = document.getElementById(id);

    if (modal) {
        modal.style.display = "flex";
    }
}

function cerrarModal(id) {

    const modal = document.getElementById(id);

    if (modal) {
        modal.style.display = "none";
    }
}

function setText(id, valor) {

    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.textContent = valor;
    }
}

function escapeHTML(texto) {

    return String(texto || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}