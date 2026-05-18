document.addEventListener("DOMContentLoaded", () => {
    protegerPaginaMisIncidencias();

    inicializarIncidenciasService();

    cargarPaginaMisIncidencias();

    configurarFormularioMisIncidencias();
    configurarFiltrosMisIncidencias();
    configurarModalDetalleMisIncidencias();
    configurarCambioEdificioIncidencia();
});

/* =========================================================
   SEGURIDAD
========================================================= */

function protegerPaginaMisIncidencias() {
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

/* =========================================================
   CARGA PRINCIPAL
========================================================= */

function cargarPaginaMisIncidencias() {
    const incidencias = obtenerMisIncidenciasFiltradas();

    cargarResumenMisIncidencias(incidencias);
    cargarSelectEdificiosMisIncidencias();
    cargarSelectUnidadesMisIncidencias();
    renderizarTablaMisIncidencias(incidencias);
}

/* =========================================================
   FORMULARIO
========================================================= */

function configurarFormularioMisIncidencias() {
    const form = document.getElementById("formIncidenciaResidente");

    if (!form) return;

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const fotoInput = document.getElementById("fotoIncidenciaResidente");
        const fotoBase64 = await obtenerFotoBase64Incidencia(fotoInput);

        const datos = {
            edificioId: document.getElementById("edificioIncidenciaResidente")?.value || "",
            unidadId: document.getElementById("unidadIncidenciaResidente")?.value || "",
            categoria: document.getElementById("categoriaIncidenciaResidente")?.value || "",
            prioridad: document.getElementById("prioridadIncidenciaResidente")?.value || "media",
            titulo: document.getElementById("tituloIncidenciaResidente")?.value || "",
            ubicacion: document.getElementById("ubicacionIncidenciaResidente")?.value || "",
            descripcion: document.getElementById("descripcionIncidenciaResidente")?.value || "",
            foto: fotoBase64
        };

        const resultado = crearIncidencia(datos);

        if (!resultado.ok) {
            alert(resultado.error);
            return;
        }

        limpiarFormularioMisIncidencias();
        cargarPaginaMisIncidencias();

        alert("Incidencia registrada correctamente.");
    });
}

function obtenerFotoBase64Incidencia(input) {
    return new Promise(resolve => {
        if (!input || !input.files || input.files.length === 0) {
            resolve("");
            return;
        }

        const archivo = input.files[0];

        if (!archivo.type.startsWith("image/")) {
            alert("Solo se permiten imágenes.");
            resolve("");
            return;
        }

        const maxSizeMB = 2;
        const maxSizeBytes = maxSizeMB * 1024 * 1024;

        if (archivo.size > maxSizeBytes) {
            alert(`La imagen no debe superar ${maxSizeMB} MB.`);
            input.value = "";
            resolve("");
            return;
        }

        const reader = new FileReader();

        reader.onload = event => {
            resolve(event.target.result);
        };

        reader.onerror = () => {
            alert("No se pudo leer la imagen.");
            resolve("");
        };

        reader.readAsDataURL(archivo);
    });
}

function limpiarFormularioMisIncidencias() {
    const form = document.getElementById("formIncidenciaResidente");

    if (form) {
        form.reset();
    }

    const id = document.getElementById("incidenciaIdResidente");

    if (id) {
        id.value = "";
    }

    cargarSelectEdificiosMisIncidencias();
    cargarSelectUnidadesMisIncidencias();
}

/* =========================================================
   SELECTS FORMULARIO
========================================================= */

function cargarSelectEdificiosMisIncidencias() {
    const select = document.getElementById("edificioIncidenciaResidente");

    if (!select) return;

    const sesion = obtenerSesionMisIncidencias();
    const db = obtenerTodo();

    const edificiosIds = obtenerEdificiosVinculadosMisIncidencias(sesion);

    const edificios = (db.edificios || []).filter(edificio =>
        edificiosIds.includes(String(edificio.id)) &&
        edificio.activo !== false
    );

    const valorActual = select.value;

    select.innerHTML = `<option value="">Seleccione edificio...</option>`;

    edificios.forEach(edificio => {
        select.innerHTML += `
            <option value="${edificio.id}">
                ${escapeHTMLIncidencias(edificio.nombre)}
            </option>
        `;
    });

    if (edificios.some(e => String(e.id) === String(valorActual))) {
        select.value = valorActual;
    } else if (edificios.length === 1) {
        select.value = edificios[0].id;
    }
}

function cargarSelectUnidadesMisIncidencias() {
    const select = document.getElementById("unidadIncidenciaResidente");

    if (!select) return;

    const sesion = obtenerSesionMisIncidencias();
    const db = obtenerTodo();

    const edificioSeleccionado = document.getElementById("edificioIncidenciaResidente")?.value || "";
    const unidades = obtenerUnidadesVinculadasMisIncidencias(db, sesion)
        .filter(unidad =>
            !edificioSeleccionado ||
            String(unidad.edificioId || "") === String(edificioSeleccionado)
        );

    const valorActual = select.value;

    select.innerHTML = `<option value="">Seleccione unidad...</option>`;

    unidades.forEach(unidad => {
        select.innerHTML += `
            <option value="${unidad.id}">
                ${escapeHTMLIncidencias(unidad.numero || "-")} - ${formatearTipoUnidadMisIncidencias(unidad.tipo)}
            </option>
        `;
    });

    if (unidades.some(u => String(u.id) === String(valorActual))) {
        select.value = valorActual;
    } else if (unidades.length === 1) {
        select.value = unidades[0].id;
    }
}

function configurarCambioEdificioIncidencia() {
    const select = document.getElementById("edificioIncidenciaResidente");

    if (!select) return;

    select.addEventListener("change", () => {
        cargarSelectUnidadesMisIncidencias();
    });
}

/* =========================================================
   FILTROS
========================================================= */

function configurarFiltrosMisIncidencias() {
    const filtros = [
        "filtroEstadoMisIncidencias",
        "filtroCategoriaMisIncidencias",
        "filtroPrioridadMisIncidencias",
        "buscarMisIncidencias"
    ];

    filtros.forEach(id => {
        const elemento = document.getElementById(id);

        if (!elemento) return;

        elemento.addEventListener("input", cargarPaginaMisIncidencias);
        elemento.addEventListener("change", cargarPaginaMisIncidencias);
    });

    const limpiar = document.getElementById("btnLimpiarFiltrosMisIncidencias");

    if (limpiar) {
        limpiar.addEventListener("click", () => {
            filtros.forEach(id => {
                const elemento = document.getElementById(id);

                if (elemento) {
                    elemento.value = "";
                }
            });

            cargarPaginaMisIncidencias();
        });
    }
}

function obtenerMisIncidenciasFiltradas() {
    let incidencias = obtenerIncidenciasVisiblesResidente();

    const estado = document.getElementById("filtroEstadoMisIncidencias")?.value || "";
    const categoria = document.getElementById("filtroCategoriaMisIncidencias")?.value || "";
    const prioridad = document.getElementById("filtroPrioridadMisIncidencias")?.value || "";
    const busqueda = (
        document.getElementById("buscarMisIncidencias")?.value || ""
    ).trim().toLowerCase();

    if (estado) {
        incidencias = incidencias.filter(item =>
            normalizarEstadoIncidencia(item.estado) === estado
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

    if (busqueda) {
        incidencias = incidencias.filter(item => {
            const texto = `
                ${item.titulo || ""}
                ${item.descripcion || ""}
                ${item.ubicacion || ""}
            `.toLowerCase();

            return texto.includes(busqueda);
        });
    }

    return incidencias.sort((a, b) =>
        String(b.fechaRegistro || "").localeCompare(String(a.fechaRegistro || ""))
    );
}

/* =========================================================
   RESUMEN
========================================================= */

function cargarResumenMisIncidencias(incidencias) {
    const metricas = calcularMetricasIncidencias(incidencias);

    setTextIncidencias("totalIncidenciasResidente", metricas.total);
    setTextIncidencias("incidenciasAbiertasResidente", metricas.abiertas);
    setTextIncidencias("incidenciasRevisionResidente", metricas.enRevision);
    setTextIncidencias("incidenciasProcesoResidente", metricas.enProceso);
    setTextIncidencias("incidenciasResueltasResidente", metricas.resueltas);
    setTextIncidencias("incidenciasUrgentesResidente", metricas.urgentes);
}

/* =========================================================
   TABLA
========================================================= */

function renderizarTablaMisIncidencias(incidencias) {
    const tabla = document.getElementById("tablaMisIncidencias");

    if (!tabla) return;

    if (incidencias.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="7">
                    No tienes incidencias registradas.
                </td>
            </tr>
        `;
        return;
    }

    tabla.innerHTML = incidencias.map(item => `
        <tr>
            <td>
                <strong>${escapeHTMLIncidencias(item.titulo)}</strong>
                <br>
                <small>${escapeHTMLIncidencias(item.ubicacion || "-")}</small>
            </td>

            <td>${formatearCategoriaIncidencia(item.categoria)}</td>

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

            <td>${formatearFechaIncidencia(item.fechaRegistro)}</td>

            <td>${formatearFechaIncidencia(item.fechaActualizacion)}</td>

            <td class="table-actions">
                <button
                    type="button"
                    class="btn btn-blue"
                    onclick="verDetalleMisIncidencias('${item.id}')"
                >
                    Ver
                </button>

                ${renderizarAccionCancelarIncidencia(item)}
            </td>
        </tr>
    `).join("");
}

function renderizarAccionCancelarIncidencia(item) {
    const estado = normalizarEstadoIncidencia(item.estado);

    if (["resuelta", "cancelada", "rechazada"].includes(estado)) {
        return "";
    }

    return `
        <button
            type="button"
            class="btn btn-red"
            onclick="cancelarMiIncidencia('${item.id}')"
        >
            Cancelar
        </button>
    `;
}

/* =========================================================
   DETALLE
========================================================= */

function configurarModalDetalleMisIncidencias() {
    const cerrar = document.getElementById("cerrarModalDetalleMisIncidencias");

    if (cerrar) {
        cerrar.addEventListener("click", cerrarModalDetalleMisIncidencias);
    }

    window.addEventListener("click", event => {
        const modal = document.getElementById("modalDetalleMisIncidencias");

        if (event.target === modal) {
            cerrarModalDetalleMisIncidencias();
        }
    });
}

function verDetalleMisIncidencias(id) {
    const incidencia = obtenerIncidenciaPorId(id);

    if (!incidencia) {
        alert("Incidencia no encontrada.");
        return;
    }

    const db = obtenerTodo();

    const edificio = obtenerNombreEdificioMisIncidencias(db, incidencia.edificioId);
    const unidad = obtenerNombreUnidadMisIncidencias(db, incidencia.unidadId);

    const detalle = document.getElementById("detalleMisIncidencias");

    if (!detalle) return;

    detalle.innerHTML = `
        <div class="detail-grid">
            <div class="detail-card">
                <h3>${escapeHTMLIncidencias(incidencia.titulo)}</h3>

                <p class="detail-description">
                    ${escapeHTMLIncidencias(incidencia.descripcion)}
                </p>

                <div class="detail-meta">
                    <div>
                        <strong>Edificio:</strong>
                        ${escapeHTMLIncidencias(edificio)}
                    </div>

                    <div>
                        <strong>Unidad:</strong>
                        ${escapeHTMLIncidencias(unidad)}
                    </div>

                    <div>
                        <strong>Ubicación:</strong>
                        ${escapeHTMLIncidencias(incidencia.ubicacion)}
                    </div>

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
                        <strong>Fecha registro:</strong>
                        ${formatearFechaIncidencia(incidencia.fechaRegistro)}
                    </div>

                    <div>
                        <strong>Última actualización:</strong>
                        ${formatearFechaIncidencia(incidencia.fechaActualizacion)}
                    </div>
                </div>
            </div>

            ${renderizarImagenMisIncidencias(incidencia)}
        </div>

        ${renderizarObservacionMisIncidencias(incidencia)}

        ${renderizarHistorialMisIncidencias(incidencia)}
    `;

    abrirModalMisIncidencias("modalDetalleMisIncidencias");
}

function renderizarImagenMisIncidencias(incidencia) {
    if (!incidencia.foto) return "";

    return `
        <div class="detail-image-container">
            <img
                src="${incidencia.foto}"
                alt="Evidencia de incidencia"
                class="detail-image"
            >
        </div>
    `;
}

function renderizarObservacionMisIncidencias(incidencia) {
    if (!incidencia.observacionAdmin) return "";

    return `
        <section class="detail-section">
            <h3>Última observación de administración</h3>

            <div class="detail-observation">
                ${escapeHTMLIncidencias(incidencia.observacionAdmin)}
            </div>
        </section>
    `;
}

function renderizarHistorialMisIncidencias(incidencia) {
    const historial = incidencia.historial || [];

    if (historial.length === 0) return "";

    return `
        <section class="detail-section">
            <h3>Historial de seguimiento</h3>

            <div class="timeline">
                ${historial.map(item => `
                    <div class="timeline-item">
                        <div class="timeline-badge ${claseEstadoIncidencia(item.estado)}">
                            ${formatearEstadoIncidencia(item.estado)}
                        </div>

                        <div class="timeline-content">
                            <strong>${escapeHTMLIncidencias(item.usuarioNombre || "Sistema")}</strong>

                            <p>${escapeHTMLIncidencias(item.observacion || "-")}</p>

                            <small>${formatearFechaIncidencia(item.fecha)}</small>
                        </div>
                    </div>
                `).join("")}
            </div>
        </section>
    `;
}

function cerrarModalDetalleMisIncidencias() {
    cerrarModalMisIncidencias("modalDetalleMisIncidencias");
}

/* =========================================================
   CANCELAR
========================================================= */

function cancelarMiIncidencia(id) {
    const confirmar = confirm("¿Deseas cancelar esta incidencia?");

    if (!confirmar) return;

    const resultado = cancelarIncidencia(
        id,
        "Incidencia cancelada por el residente."
    );

    if (!resultado.ok) {
        alert(resultado.error);
        return;
    }

    cargarPaginaMisIncidencias();

    alert("Incidencia cancelada correctamente.");
}

/* =========================================================
   DATOS SESIÓN
========================================================= */

function obtenerSesionMisIncidencias() {
    try {
        return JSON.parse(localStorage.getItem("usuarioSesion"));
    } catch (error) {
        return null;
    }
}

function obtenerEdificiosVinculadosMisIncidencias(sesion) {
    const ids = [];

    if (sesion?.edificioId) {
        ids.push(String(sesion.edificioId));
    }

    if (Array.isArray(sesion?.edificioIds)) {
        sesion.edificioIds.forEach(id => {
            if (id) ids.push(String(id));
        });
    }

    const unidades = sesion?.unidadesAutorizadas || [];

    unidades.forEach(unidad => {
        if (unidad.edificioId) {
            ids.push(String(unidad.edificioId));
        }
    });

    return [...new Set(ids)];
}

function obtenerIdsUnidadesMisIncidencias(sesion) {
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

function obtenerUnidadesVinculadasMisIncidencias(db, sesion) {
    const ids = obtenerIdsUnidadesMisIncidencias(sesion);

    return (db.departamentos || []).filter(unidad =>
        ids.includes(String(unidad.id))
    );
}

/* =========================================================
   HELPERS VISUALES
========================================================= */

function obtenerNombreEdificioMisIncidencias(db, edificioId) {
    const edificio = (db.edificios || []).find(item =>
        String(item.id) === String(edificioId)
    );

    return edificio?.nombre || "-";
}

function obtenerNombreUnidadMisIncidencias(db, unidadId) {
    const unidad = (db.departamentos || []).find(item =>
        String(item.id) === String(unidadId)
    );

    if (!unidad) return "-";

    return `${unidad.numero || "-"} - ${formatearTipoUnidadMisIncidencias(unidad.tipo)}`;
}

function formatearTipoUnidadMisIncidencias(tipo) {
    const valor = String(tipo || "").toLowerCase().trim();

    if (valor === "oficina" || valor === "local") return "Oficina / Local";
    if (valor === "estacionamiento") return "Estacionamiento";
    if (valor === "deposito" || valor === "depósito") return "Depósito";

    return "Departamento";
}

function abrirModalMisIncidencias(id) {
    const modal = document.getElementById(id);

    if (modal) {
        modal.style.display = "flex";
    }
}

function cerrarModalMisIncidencias(id) {
    const modal = document.getElementById(id);

    if (modal) {
        modal.style.display = "none";
    }
}

function setTextIncidencias(id, valor) {
    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.textContent = valor;
    }
}

function escapeHTMLIncidencias(texto) {
    return String(texto || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}