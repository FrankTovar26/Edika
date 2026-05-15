let anuncioPendientePublicacion = null;
let anuncioPendienteRestauracion = null;
let archivoPreviewTemporal = null;

document.addEventListener("DOMContentLoaded", () => {
    protegerPaginaAdmin();
    inicializarAnuncios();
    archivarAnunciosVencidos();
    configurarFechaActual();
    configurarFormularioAnuncio();
    configurarModalPreview();
    configurarActualizaciones();
    configurarModalRestaurar();
    configurarModalMetricasLectura();
    configurarFiltrosHistorial();
    renderizarAnuncios();
    renderizarHistorialAnuncios();
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

function inicializarAnuncios() {
    const db = obtenerTodo();

    db.anuncios = db.anuncios || [];
    db.correosEnviados = db.correosEnviados || [];
    db.notificaciones = db.notificaciones || [];
    db.lecturasAnuncios = db.lecturasAnuncios || [];

    db.anuncios.forEach(anuncio => {
        if (!anuncio.actualizaciones) anuncio.actualizaciones = [];
        if (!anuncio.estado) anuncio.estado = "borrador";
        if (!anuncio.destacado) anuncio.destacado = "no";
        if (!anuncio.fechaExpiracion && anuncio.fecha) {
            anuncio.fechaExpiracion = calcularFechaExpiracionPorDefecto(anuncio.fecha);
        }
        if (!anuncio.tipoArchivado) anuncio.tipoArchivado = null;
        if (!anuncio.archivadoPor) anuncio.archivadoPor = null;
        if (!anuncio.fechaRestauracion) anuncio.fechaRestauracion = null;
    });

    guardarTodo(db);
}

function configurarFechaActual() {
    const fecha = document.getElementById("fechaAnuncio");

    if (!fecha) return;

    fecha.value = obtenerFechaHoy();
    fecha.readOnly = true;
}

function configurarFormularioAnuncio() {
    document.getElementById("btnGuardarBorrador").addEventListener("click", () => {
        guardarAnuncio("borrador");
    });

    document.getElementById("btnPublicar").addEventListener("click", async () => {
        const datos = await obtenerDatosFormulario();

        if (!datos.ok) {
            alert(datos.error);
            return;
        }

        anuncioPendientePublicacion = datos.anuncio;
        archivoPreviewTemporal = datos.anuncio.archivo || null;
        mostrarPreview(datos.anuncio, true);
    });

    document.getElementById("btnCancelarEdicion").addEventListener("click", limpiarFormularioAnuncio);
}

function configurarModalPreview() {
    const modal = document.getElementById("modalPreviewAnuncio");

    document.getElementById("cerrarPreview").addEventListener("click", cerrarPreview);
    document.getElementById("btnCancelarPublicacion").addEventListener("click", cerrarPreview);

    document.getElementById("btnConfirmarPublicacion").addEventListener("click", () => {
        if (!anuncioPendientePublicacion) return;

        guardarAnuncio("publicado", anuncioPendientePublicacion);
        cerrarPreview();
    });

    window.addEventListener("click", event => {
        if (event.target === modal) {
            cerrarPreview();
        }
    });
}

function configurarActualizaciones() {
    document.getElementById("btnGuardarActualizacion").addEventListener("click", guardarActualizacion);
    document.getElementById("btnCancelarActualizacion").addEventListener("click", limpiarActualizacion);
}

function configurarModalRestaurar() {
    const modal = document.getElementById("modalRestaurarAnuncio");
    const cerrar = document.getElementById("cerrarRestaurar");
    const cancelar = document.getElementById("btnCancelarRestaurar");
    const confirmar = document.getElementById("btnConfirmarRestaurar");

    if (!modal || !cerrar || !cancelar || !confirmar) return;

    cerrar.addEventListener("click", cerrarModalRestaurar);
    cancelar.addEventListener("click", cerrarModalRestaurar);

    confirmar.addEventListener("click", () => {
        if (!anuncioPendienteRestauracion) return;
        restaurarAnuncioConfirmado(anuncioPendienteRestauracion);
    });

    window.addEventListener("click", event => {
        if (event.target === modal) {
            cerrarModalRestaurar();
        }
    });
}

function configurarModalMetricasLectura() {
    const modal = document.getElementById("modalMetricasLectura");
    const cerrar = document.getElementById("cerrarMetricasLectura");
    const botonCerrar = document.getElementById("btnCerrarMetricasLectura");

    if (!modal) return;

    if (cerrar) cerrar.addEventListener("click", cerrarModalMetricasLectura);
    if (botonCerrar) botonCerrar.addEventListener("click", cerrarModalMetricasLectura);

    window.addEventListener("click", event => {
        if (event.target === modal) {
            cerrarModalMetricasLectura();
        }
    });
}

function configurarFiltrosHistorial() {
    const buscar = document.getElementById("buscarHistorialAnuncio");
    const fecha = document.getElementById("filtroHistorialFecha");
    const tipoArchivo = document.getElementById("filtroHistorialTipoArchivo");
    const limpiar = document.getElementById("btnLimpiarFiltrosHistorial");

    if (buscar) buscar.addEventListener("input", renderizarHistorialAnuncios);
    if (fecha) fecha.addEventListener("change", renderizarHistorialAnuncios);
    if (tipoArchivo) tipoArchivo.addEventListener("change", renderizarHistorialAnuncios);

    if (limpiar) {
        limpiar.addEventListener("click", () => {
            if (buscar) buscar.value = "";
            if (fecha) fecha.value = "";
            if (tipoArchivo) tipoArchivo.value = "";
            renderizarHistorialAnuncios();
        });
    }
}

async function guardarAnuncio(estado, anuncioDesdePreview = null) {
    const datos = anuncioDesdePreview
        ? { ok: true, anuncio: anuncioDesdePreview }
        : await obtenerDatosFormulario();

    if (!datos.ok) {
        alert(datos.error);
        return;
    }

    const db = obtenerTodo();
    db.anuncios = db.anuncios || [];
    db.correosEnviados = db.correosEnviados || [];
    db.notificaciones = db.notificaciones || [];
    db.lecturasAnuncios = db.lecturasAnuncios || [];

    const id = document.getElementById("anuncioId").value;
    const anuncio = datos.anuncio;

    if (id) {
        const existente = db.anuncios.find(a => String(a.id) === String(id));

        if (!existente) {
            alert("Anuncio no encontrado.");
            return;
        }

        if (existente.estado === "publicado") {
            alert("No se puede modificar un anuncio publicado. Usa una actualización o fe de erratas.");
            return;
        }

        existente.titulo = anuncio.titulo;
        existente.descripcion = anuncio.descripcion;
        existente.fecha = existente.fecha || obtenerFechaHoy();
        existente.fechaExpiracion = anuncio.fechaExpiracion || calcularFechaExpiracionPorDefecto(existente.fecha);
        existente.destacado = anuncio.destacado || "no";
        existente.archivo = anuncio.archivo;
        existente.estado = estado;
        existente.fechaActualizacion = new Date().toISOString();
        existente.actualizaciones = existente.actualizaciones || [];

        if (estado === "publicado") {
            existente.fechaPublicacion = new Date().toISOString();
            notificarPublicacion(db, existente);
        }
    } else {
        const fechaCreacion = obtenerFechaHoy();

        const nuevoAnuncio = {
            id: Date.now().toString(),
            titulo: anuncio.titulo,
            descripcion: anuncio.descripcion,
            fecha: fechaCreacion,
            fechaExpiracion: anuncio.fechaExpiracion || calcularFechaExpiracionPorDefecto(fechaCreacion),
            destacado: anuncio.destacado || "no",
            archivo: anuncio.archivo,
            estado,
            actualizaciones: [],
            fechaCreacion: new Date().toISOString(),
            fechaPublicacion: estado === "publicado" ? new Date().toISOString() : null,
            fechaArchivado: null,
            tipoArchivado: null,
            archivadoPor: null,
            fechaRestauracion: null
        };

        db.anuncios.push(nuevoAnuncio);

        if (estado === "publicado") {
            notificarPublicacion(db, nuevoAnuncio);
        }
    }

    guardarTodo(db);

    limpiarFormularioAnuncio();
    renderizarAnuncios();
    renderizarHistorialAnuncios();

    alert(
        estado === "publicado"
            ? "Anuncio publicado correctamente. Se notificó a los residentes."
            : "Anuncio guardado como borrador."
    );
}

async function obtenerDatosFormulario() {
    const titulo = document.getElementById("tituloAnuncio").value.trim();
    const descripcion = document.getElementById("descripcionAnuncio").value.trim();
    const fecha = document.getElementById("fechaAnuncio").value || obtenerFechaHoy();
    const fechaExpiracion = document.getElementById("fechaExpiracionAnuncio")?.value || "";
    const destacado = document.getElementById("destacadoAnuncio")?.value || "no";
    const archivoInput = document.getElementById("archivoAnuncio");

    if (!titulo || !descripcion) {
        return {
            ok: false,
            error: "Completa el título y la descripción."
        };
    }

    if (fechaExpiracion && fechaExpiracion < fecha) {
        return {
            ok: false,
            error: "La fecha de expiración no puede ser anterior a la fecha de creación."
        };
    }

    let archivo = null;

    if (archivoInput.files.length > 0) {
        const file = archivoInput.files[0];
        const validacion = validarArchivo(file);

        if (!validacion.ok) return validacion;

        archivo = await convertirArchivoABase64(file);
    } else {
        const id = document.getElementById("anuncioId").value;

        if (id) {
            const db = obtenerTodo();
            const existente = (db.anuncios || []).find(a => String(a.id) === String(id));
            archivo = existente?.archivo || null;
        }
    }

    return {
        ok: true,
        anuncio: {
            titulo,
            descripcion,
            fecha,
            fechaExpiracion: fechaExpiracion || calcularFechaExpiracionPorDefecto(fecha),
            destacado,
            archivo
        }
    };
}

function validarArchivo(file) {
    const maxSize = 5 * 1024 * 1024;
    const tiposPermitidos = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

    if (file.size > maxSize) {
        return {
            ok: false,
            error: "El archivo no debe superar los 5 MB."
        };
    }

    if (!tiposPermitidos.includes(file.type)) {
        return {
            ok: false,
            error: "Solo se permiten archivos PDF o imágenes JPG, PNG o WEBP."
        };
    }

    return { ok: true };
}

function convertirArchivoABase64(file) {
    return new Promise(resolve => {
        const reader = new FileReader();

        reader.onload = () => {
            resolve({
                nombre: file.name,
                tipo: file.type,
                size: file.size,
                data: reader.result
            });
        };

        reader.readAsDataURL(file);
    });
}

function renderizarAnuncios() {
    const db = obtenerTodo();
    const tabla = document.getElementById("tablaAnuncios");

    db.anuncios = db.anuncios || [];

    const anunciosVisibles = db.anuncios.filter(anuncio => anuncio.estado !== "archivado");

    if (anunciosVisibles.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="9">No hay anuncios activos o borradores registrados.</td>
            </tr>
        `;
        return;
    }

    const anunciosOrdenados = [...anunciosVisibles].sort((a, b) => {
        if (a.destacado === "si" && b.destacado !== "si") return -1;
        if (a.destacado !== "si" && b.destacado === "si") return 1;

        return new Date(b.fechaCreacion || b.fecha || 0) - new Date(a.fechaCreacion || a.fecha || 0);
    });

    tabla.innerHTML = anunciosOrdenados.map(anuncio => `
        <tr>
            <td>${escaparHTML(anuncio.titulo)}</td>
            <td>${formatearFecha(anuncio.fecha)}</td>
            <td>${formatearFecha(anuncio.fechaExpiracion)}</td>
            <td>
                <span class="badge ${claseEstado(anuncio.estado)}">
                    ${formatearEstado(anuncio.estado)}
                </span>
            </td>
            <td>${anuncio.destacado === "si" ? "Sí" : "No"}</td>
            <td>${anuncio.archivo ? escaparHTML(anuncio.archivo.nombre) : "-"}</td>
            <td>${(anuncio.actualizaciones || []).length}</td>
            <td>${renderizarResumenLecturas(anuncio)}</td>
            <td>
                ${renderizarAcciones(anuncio)}
            </td>
        </tr>
    `).join("");
}

function renderizarHistorialAnuncios() {
    const db = obtenerTodo();
    const tabla = document.getElementById("tablaHistorialAnuncios");

    if (!tabla) return;

    db.anuncios = db.anuncios || [];

    const textoBusqueda = (document.getElementById("buscarHistorialAnuncio")?.value || "").toLowerCase().trim();
    const fechaFiltro = document.getElementById("filtroHistorialFecha")?.value || "";
    const tipoArchivoFiltro = document.getElementById("filtroHistorialTipoArchivo")?.value || "";

    let archivados = db.anuncios.filter(anuncio => anuncio.estado === "archivado");

    if (textoBusqueda) {
        archivados = archivados.filter(anuncio =>
            String(anuncio.titulo || "").toLowerCase().includes(textoBusqueda) ||
            String(anuncio.descripcion || "").toLowerCase().includes(textoBusqueda)
        );
    }

    if (fechaFiltro) {
        archivados = archivados.filter(anuncio => anuncio.fecha === fechaFiltro);
    }

    if (tipoArchivoFiltro === "conArchivo") {
        archivados = archivados.filter(anuncio => anuncio.archivo);
    }

    if (tipoArchivoFiltro === "sinArchivo") {
        archivados = archivados.filter(anuncio => !anuncio.archivo);
    }

    if (archivados.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="8">No hay anuncios archivados en el historial.</td>
            </tr>
        `;
        return;
    }

    const archivadosOrdenados = [...archivados].sort((a, b) =>
        new Date(b.fechaArchivado || 0) - new Date(a.fechaArchivado || 0)
    );

    tabla.innerHTML = archivadosOrdenados.map(anuncio => `
        <tr>
            <td>${escaparHTML(anuncio.titulo)}</td>
            <td>${formatearFecha(anuncio.fecha)}</td>
            <td>${formatearFechaHora(anuncio.fechaArchivado)}</td>
            <td>${formatearTipoArchivado(anuncio.tipoArchivado)}</td>
            <td>${anuncio.archivo ? escaparHTML(anuncio.archivo.nombre) : "-"}</td>
            <td>${(anuncio.actualizaciones || []).length}</td>
            <td>${renderizarResumenLecturas(anuncio)}</td>
            <td>
                <button class="btn btn-blue" onclick="verAnuncioPublicado('${anuncio.id}')">
                    Ver
                </button>

                <button class="btn btn-green" onclick="abrirModalRestaurar('${anuncio.id}')">
                    Restaurar
                </button>
            </td>
        </tr>
    `).join("");
}

function renderizarResumenLecturas(anuncio) {
    const metricas = obtenerMetricasLectura(anuncio.id);

    return `
        <button class="btn btn-blue" onclick="abrirMetricasLectura('${anuncio.id}')">
            ${metricas.leidos}/${metricas.totalResidentes}
            (${metricas.porcentaje}%)
        </button>
    `;
}

function obtenerMetricasLectura(anuncioId) {
    const db = obtenerTodo();

    db.lecturasAnuncios = db.lecturasAnuncios || [];

    const residentes = obtenerResidentes(db);
    const totalResidentes = residentes.length;

    const idsResidentes = residentes.map(residente => String(obtenerIdUsuario(residente)));

    const lecturasValidas = db.lecturasAnuncios.filter(lectura =>
        String(lectura.anuncioId) === String(anuncioId) &&
        idsResidentes.includes(String(lectura.usuarioId))
    );

    const usuariosUnicos = [...new Set(lecturasValidas.map(lectura => String(lectura.usuarioId)))];

    const leidos = usuariosUnicos.length;
    const pendientes = Math.max(totalResidentes - leidos, 0);
    const porcentaje = totalResidentes > 0 ? Math.round((leidos / totalResidentes) * 100) : 0;

    return {
        leidos,
        pendientes,
        totalResidentes,
        porcentaje,
        lecturas: lecturasValidas
    };
}

function abrirMetricasLectura(anuncioId) {
    const db = obtenerTodo();
    const anuncio = (db.anuncios || []).find(a => String(a.id) === String(anuncioId));
    const contenido = document.getElementById("contenidoMetricasLectura");
    const modal = document.getElementById("modalMetricasLectura");

    if (!anuncio || !contenido || !modal) return;

    const metricas = obtenerMetricasLectura(anuncioId);
    const residentes = obtenerResidentes(db);

    const idsLeidos = new Set(
        metricas.lecturas.map(lectura => String(lectura.usuarioId))
    );

    const listaResidentes = residentes.map(residente => {
        const usuarioId = String(obtenerIdUsuario(residente));
        const lectura = metricas.lecturas.find(l => String(l.usuarioId) === usuarioId);
        const leido = idsLeidos.has(usuarioId);

        return `
            <tr>
                <td>${escaparHTML(residente.nombre || residente.nombres || "Residente")}</td>
                <td>${escaparHTML(residente.correo || "-")}</td>
                <td>${leido ? "Leído" : "Pendiente"}</td>
                <td>${lectura ? formatearFechaHora(lectura.fechaLectura) : "-"}</td>
            </tr>
        `;
    }).join("");

    contenido.innerHTML = `
        <p><strong>Anuncio:</strong> ${escaparHTML(anuncio.titulo)}</p>

        <div style="display: flex; gap: 15px; flex-wrap: wrap; margin: 15px 0;">
            <div><strong>${metricas.leidos}</strong> <span style="color: #666;">leídos</span></div>
            <div><strong>${metricas.pendientes}</strong> <span style="color: #666;">pendientes</span></div>
            <div><strong>${metricas.totalResidentes}</strong> <span style="color: #666;">residentes</span></div>
            <div><strong>${metricas.porcentaje}%</strong> <span style="color: #666;">avance</span></div>
        </div>

        <div style="width: 100%; background: #e5e7eb; border-radius: 999px; overflow: hidden; height: 14px; margin-bottom: 20px;">
            <div style="width: ${metricas.porcentaje}%; background: #2563eb; height: 14px;"></div>
        </div>

        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Residente</th>
                        <th>Correo</th>
                        <th>Estado</th>
                        <th>Fecha lectura</th>
                    </tr>
                </thead>
                <tbody>
                    ${
                        residentes.length > 0
                            ? listaResidentes
                            : `<tr><td colspan="4">No hay residentes registrados.</td></tr>`
                    }
                </tbody>
            </table>
        </div>
    `;

    modal.style.display = "flex";
}

function cerrarModalMetricasLectura() {
    const modal = document.getElementById("modalMetricasLectura");
    const contenido = document.getElementById("contenidoMetricasLectura");

    if (contenido) contenido.innerHTML = "";
    if (modal) modal.style.display = "none";
}

function renderizarAcciones(anuncio) {
    if (anuncio.estado === "borrador") {
        return `
            <button class="btn btn-blue" onclick="cargarAnuncioParaEditar('${anuncio.id}')">Editar</button>
            <button class="btn btn-green" onclick="prepararPublicacionDesdeTabla('${anuncio.id}')">Publicar</button>
            <button class="btn btn-red" onclick="eliminarAnuncio('${anuncio.id}')">Eliminar</button>
        `;
    }

    if (anuncio.estado === "publicado") {
        return `
            <button class="btn btn-blue" onclick="verAnuncioPublicado('${anuncio.id}')">Ver</button>
            <button class="btn btn-green" onclick="abrirActualizacion('${anuncio.id}')">Actualización</button>
            <button class="btn btn-red" onclick="archivarAnuncio('${anuncio.id}')">Archivar</button>
        `;
    }

    return `
        <button class="btn btn-blue" onclick="verAnuncioPublicado('${anuncio.id}')">Ver</button>
    `;
}

function cargarAnuncioParaEditar(id) {
    const db = obtenerTodo();
    const anuncio = (db.anuncios || []).find(a => String(a.id) === String(id));

    if (!anuncio) return;

    if (anuncio.estado !== "borrador") {
        alert("Solo se pueden editar anuncios en borrador.");
        return;
    }

    document.getElementById("anuncioId").value = anuncio.id;
    document.getElementById("tituloAnuncio").value = anuncio.titulo;
    document.getElementById("descripcionAnuncio").value = anuncio.descripcion;
    document.getElementById("fechaAnuncio").value = anuncio.fecha || obtenerFechaHoy();

    const fechaExpiracion = document.getElementById("fechaExpiracionAnuncio");
    if (fechaExpiracion) {
        fechaExpiracion.value = anuncio.fechaExpiracion || calcularFechaExpiracionPorDefecto(anuncio.fecha || obtenerFechaHoy());
    }

    const destacado = document.getElementById("destacadoAnuncio");
    if (destacado) {
        destacado.value = anuncio.destacado || "no";
    }

    document.getElementById("archivoActual").textContent = anuncio.archivo
        ? `Archivo actual: ${anuncio.archivo.nombre}`
        : "";

    habilitarFormularioPrincipal(true);

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function prepararPublicacionDesdeTabla(id) {
    const db = obtenerTodo();
    const anuncio = (db.anuncios || []).find(a => String(a.id) === String(id));

    if (!anuncio) return;

    if (anuncio.estado !== "borrador") {
        alert("Este anuncio ya fue publicado o archivado.");
        return;
    }

    anuncioPendientePublicacion = {
        idExistente: anuncio.id,
        titulo: anuncio.titulo,
        descripcion: anuncio.descripcion,
        fecha: anuncio.fecha,
        fechaExpiracion: anuncio.fechaExpiracion || calcularFechaExpiracionPorDefecto(anuncio.fecha),
        destacado: anuncio.destacado || "no",
        archivo: anuncio.archivo
    };

    archivoPreviewTemporal = anuncio.archivo || null;

    document.getElementById("anuncioId").value = anuncio.id;
    mostrarPreview(anuncioPendientePublicacion, true);
}

function verAnuncioPublicado(id) {
    const db = obtenerTodo();
    const anuncio = (db.anuncios || []).find(a => String(a.id) === String(id));

    if (!anuncio) return;

    archivoPreviewTemporal = anuncio.archivo || null;
    mostrarPreview(anuncio, false);
}

function mostrarPreview(anuncio, mostrarConfirmacion) {
    const modal = document.getElementById("modalPreviewAnuncio");
    const preview = document.getElementById("previewContenido");
    const acciones = document.getElementById("accionesPreview");

    const metricas = anuncio.id ? obtenerMetricasLectura(anuncio.id) : null;

    preview.innerHTML = `
        <p><strong>Título:</strong> ${escaparHTML(anuncio.titulo)}</p>
        <p><strong>Fecha de creación:</strong> ${formatearFecha(anuncio.fecha)}</p>
        <p><strong>Fecha de expiración:</strong> ${formatearFecha(anuncio.fechaExpiracion)}</p>
        <p><strong>Destacado:</strong> ${anuncio.destacado === "si" ? "Sí" : "No"}</p>
        <p><strong>Estado:</strong> ${formatearEstado(anuncio.estado || "borrador")}</p>

        ${
            metricas
                ? `<p><strong>Lecturas:</strong> ${metricas.leidos}/${metricas.totalResidentes} residentes (${metricas.porcentaje}%)</p>`
                : ""
        }

        ${
            anuncio.estado === "archivado"
                ? `
                    <p><strong>Fecha de archivado:</strong> ${formatearFechaHora(anuncio.fechaArchivado)}</p>
                    <p><strong>Tipo de archivado:</strong> ${formatearTipoArchivado(anuncio.tipoArchivado)}</p>
                `
                : ""
        }

        <p><strong>Descripción original:</strong></p>
        <p>${escaparHTML(anuncio.descripcion).replace(/\n/g, "<br>")}</p>

        ${renderizarArchivoAdjuntoAdmin(anuncio)}

        ${renderizarActualizacionesPreview(anuncio)}
    `;

    acciones.style.display = mostrarConfirmacion ? "block" : "none";
    modal.style.display = "flex";
}

function renderizarArchivoAdjuntoAdmin(anuncio) {
    const archivo = anuncio.archivo || archivoPreviewTemporal;

    if (!archivo) {
        return `
            <p><strong>Archivo adjunto:</strong> Sin archivo</p>
        `;
    }

    const esImagen = archivo.tipo && archivo.tipo.startsWith("image/");
    const esPDF = archivo.tipo === "application/pdf";
    const idAnuncio = anuncio.id || anuncio.idExistente || "";

    return `
        <div style="margin-top: 20px;">
            <h3>Archivo adjunto</h3>

            <p style="font-size: 0.9rem; color: #555; margin-bottom: 10px;">
                ${obtenerIconoArchivo(archivo)} ${escaparHTML(archivo.nombre)}
            </p>

            ${
                esImagen
                    ? `
                        <div style="margin: 10px 0;">
                            <img
                                src="${archivo.data}"
                                alt="Vista previa del archivo adjunto"
                                style="max-width: 100%; max-height: 350px; border-radius: 8px; border: 1px solid #ddd;"
                            >
                        </div>
                    `
                    : ""
            }

            ${
                esPDF
                    ? `
                        <p style="font-size: 0.85rem; color: #666; margin-bottom: 10px;">
                            Este archivo PDF puede abrirse en una nueva pestaña o descargarse.
                        </p>
                    `
                    : ""
            }

            <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px;">
                <button type="button" class="btn btn-blue" onclick="${idAnuncio ? `verArchivoAdjuntoAdmin('${idAnuncio}')` : "verArchivoTemporalAdmin()"}">
                    Ver archivo
                </button>

                <button type="button" class="btn btn-green" onclick="${idAnuncio ? `descargarArchivoAdjuntoAdmin('${idAnuncio}')` : "descargarArchivoTemporalAdmin()"}">
                    Descargar archivo
                </button>
            </div>
        </div>
    `;
}

function verArchivoAdjuntoAdmin(anuncioId) {
    const archivo = obtenerArchivoPorAnuncioAdmin(anuncioId) || archivoPreviewTemporal;
    abrirArchivoEnNuevaVentana(archivo);
}

function descargarArchivoAdjuntoAdmin(anuncioId) {
    const archivo = obtenerArchivoPorAnuncioAdmin(anuncioId) || archivoPreviewTemporal;
    descargarArchivo(archivo);
}

function verArchivoTemporalAdmin() {
    abrirArchivoEnNuevaVentana(archivoPreviewTemporal);
}

function descargarArchivoTemporalAdmin() {
    descargarArchivo(archivoPreviewTemporal);
}

function obtenerArchivoPorAnuncioAdmin(anuncioId) {
    const db = obtenerTodo();
    const anuncio = (db.anuncios || []).find(a => String(a.id) === String(anuncioId));

    return anuncio?.archivo || null;
}

function abrirArchivoEnNuevaVentana(archivo) {
    if (!archivo || !archivo.data) {
        alert("No se encontró el archivo adjunto.");
        return;
    }

    const nuevaVentana = window.open();

    if (!nuevaVentana) {
        alert("El navegador bloqueó la ventana emergente. Permite pop-ups para visualizar el archivo.");
        return;
    }

    if (archivo.tipo && archivo.tipo.startsWith("image/")) {
        nuevaVentana.document.write(`
            <html>
                <head>
                    <title>${escaparHTML(archivo.nombre)}</title>
                </head>
                <body style="margin:0; display:flex; align-items:center; justify-content:center; min-height:100vh; background:#111;">
                    <img src="${archivo.data}" style="max-width:100%; max-height:100vh;">
                </body>
            </html>
        `);
        nuevaVentana.document.close();
        return;
    }

    if (archivo.tipo === "application/pdf") {
        nuevaVentana.document.write(`
            <html>
                <head>
                    <title>${escaparHTML(archivo.nombre)}</title>
                </head>
                <body style="margin:0;">
                    <iframe src="${archivo.data}" style="width:100%; height:100vh; border:none;"></iframe>
                </body>
            </html>
        `);
        nuevaVentana.document.close();
        return;
    }

    nuevaVentana.location.href = archivo.data;
}

function descargarArchivo(archivo) {
    if (!archivo || !archivo.data) {
        alert("No se encontró el archivo adjunto.");
        return;
    }

    const enlace = document.createElement("a");
    enlace.href = archivo.data;
    enlace.download = archivo.nombre || "archivo-adjunto";
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
}

function obtenerIconoArchivo(archivo) {
    if (!archivo || !archivo.tipo) return "📎";
    if (archivo.tipo === "application/pdf") return "📄";
    if (archivo.tipo.startsWith("image/")) return "🖼️";
    return "📎";
}

function renderizarActualizacionesPreview(anuncio) {
    const actualizaciones = anuncio.actualizaciones || [];

    if (actualizaciones.length === 0) return "";

    return `
        <hr>
        <h3>Actualizaciones / Fe de erratas</h3>
        ${actualizaciones.map(act => `
            <div style="margin-bottom: 12px;">
                <p><strong>${formatearFechaHora(act.fechaHora)}</strong> - ${escaparHTML(act.autor || "Administrador")}</p>
                <p>${escaparHTML(act.texto).replace(/\n/g, "<br>")}</p>
            </div>
        `).join("")}
    `;
}

function cerrarPreview() {
    document.getElementById("modalPreviewAnuncio").style.display = "none";
    anuncioPendientePublicacion = null;
    archivoPreviewTemporal = null;
}

function abrirActualizacion(id) {
    const db = obtenerTodo();
    const anuncio = (db.anuncios || []).find(a => String(a.id) === String(id));

    if (!anuncio) return;

    if (anuncio.estado !== "publicado") {
        alert("Solo se pueden agregar actualizaciones a anuncios publicados.");
        return;
    }

    document.getElementById("anuncioActualizacionId").value = anuncio.id;
    document.getElementById("textoActualizacion").value = "";
    document.getElementById("seccionActualizacion").style.display = "block";

    window.scrollTo({
        top: document.getElementById("seccionActualizacion").offsetTop - 20,
        behavior: "smooth"
    });
}

function guardarActualizacion() {
    const id = document.getElementById("anuncioActualizacionId").value;
    const texto = document.getElementById("textoActualizacion").value.trim();

    if (!id || !texto) {
        alert("Ingresa el contenido de la actualización.");
        return;
    }

    const db = obtenerTodo();
    const anuncio = (db.anuncios || []).find(a => String(a.id) === String(id));

    if (!anuncio) {
        alert("Anuncio no encontrado.");
        return;
    }

    if (anuncio.estado !== "publicado") {
        alert("Solo se pueden actualizar anuncios publicados.");
        return;
    }

    const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));

    const actualizacion = {
        id: Date.now().toString(),
        texto,
        fechaHora: new Date().toISOString(),
        autor: sesion?.nombre || "Administrador"
    };

    anuncio.actualizaciones = anuncio.actualizaciones || [];
    anuncio.actualizaciones.push(actualizacion);
    anuncio.fechaActualizacion = new Date().toISOString();

    notificarActualizacion(db, anuncio, actualizacion);

    guardarTodo(db);

    limpiarActualizacion();
    renderizarAnuncios();
    renderizarHistorialAnuncios();

    alert("Actualización agregada correctamente. Se notificó a los residentes.");
}

function limpiarActualizacion() {
    document.getElementById("anuncioActualizacionId").value = "";
    document.getElementById("textoActualizacion").value = "";
    document.getElementById("seccionActualizacion").style.display = "none";
}

function archivarAnuncio(id) {
    const confirmar = confirm("¿Deseas archivar este anuncio? Ya no aparecerá en el muro principal, pero quedará disponible en el Historial.");

    if (!confirmar) return;

    const db = obtenerTodo();
    const anuncio = (db.anuncios || []).find(a => String(a.id) === String(id));

    if (!anuncio) return;

    if (anuncio.estado !== "publicado") {
        alert("Solo se pueden archivar anuncios publicados.");
        return;
    }

    const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));

    anuncio.estado = "archivado";
    anuncio.fechaArchivado = new Date().toISOString();
    anuncio.tipoArchivado = "manual";
    anuncio.archivadoPor = sesion?.nombre || "Administrador";

    guardarTodo(db);
    renderizarAnuncios();
    renderizarHistorialAnuncios();

    alert("Anuncio archivado correctamente. Puedes verlo en el Historial.");
}

function archivarAnunciosVencidos() {
    const db = obtenerTodo();

    db.anuncios = db.anuncios || [];
    db.notificaciones = db.notificaciones || [];

    let huboCambios = false;
    const hoy = obtenerFechaHoy();

    db.anuncios.forEach(anuncio => {
        if (anuncio.estado !== "publicado") return;
        if (anuncio.destacado === "si") return;

        const fechaLimite = anuncio.fechaExpiracion || calcularFechaExpiracionPorDefecto(anuncio.fecha);

        if (fechaLimite <= hoy) {
            anuncio.estado = "archivado";
            anuncio.fechaArchivado = new Date().toISOString();
            anuncio.tipoArchivado = "automatico";
            anuncio.archivadoPor = "Sistema";
            huboCambios = true;
        } else {
            registrarAvisoExpiracionAdmin(db, anuncio, fechaLimite);
        }
    });

    if (huboCambios) {
        guardarTodo(db);
    }
}

function registrarAvisoExpiracionAdmin(db, anuncio, fechaLimite) {
    const diasRestantes = calcularDiasEntre(obtenerFechaHoy(), fechaLimite);

    if (diasRestantes !== 3) return;

    const yaExiste = (db.notificaciones || []).some(notificacion =>
        notificacion.tipo === "anuncio_por_archivar" &&
        String(notificacion.anuncioId) === String(anuncio.id)
    );

    if (yaExiste) return;

    db.notificaciones.push({
        id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
        usuarioId: "admin",
        correo: "admin@edifika.com",
        tipo: "anuncio_por_archivar",
        mensaje: `El anuncio "${anuncio.titulo}" será archivado automáticamente en 3 días.`,
        anuncioId: anuncio.id,
        leido: false,
        fecha: new Date().toISOString()
    });

    guardarTodo(db);
}

function abrirModalRestaurar(id) {
    const db = obtenerTodo();
    const anuncio = (db.anuncios || []).find(a => String(a.id) === String(id));

    if (!anuncio) return;

    if (anuncio.estado !== "archivado") {
        alert("Solo se pueden restaurar anuncios archivados.");
        return;
    }

    anuncioPendienteRestauracion = anuncio.id;

    document.getElementById("anuncioRestaurarId").value = anuncio.id;
    document.getElementById("textoConfirmarRestaurar").textContent =
        `¿Está seguro de restaurar el anuncio "${anuncio.titulo}" al muro principal?`;

    document.getElementById("modalRestaurarAnuncio").style.display = "flex";
}

function cerrarModalRestaurar() {
    anuncioPendienteRestauracion = null;

    const modal = document.getElementById("modalRestaurarAnuncio");
    const input = document.getElementById("anuncioRestaurarId");

    if (input) input.value = "";
    if (modal) modal.style.display = "none";
}

function restaurarAnuncioConfirmado(id) {
    const db = obtenerTodo();
    const anuncio = (db.anuncios || []).find(a => String(a.id) === String(id));

    if (!anuncio) {
        alert("Anuncio no encontrado.");
        return;
    }

    if (anuncio.estado !== "archivado") {
        alert("Solo se pueden restaurar anuncios archivados.");
        return;
    }

    anuncio.estado = "publicado";
    anuncio.fechaRestauracion = new Date().toISOString();
    anuncio.fechaArchivado = null;
    anuncio.tipoArchivado = null;
    anuncio.archivadoPor = null;

    if (!anuncio.fechaExpiracion || anuncio.fechaExpiracion <= obtenerFechaHoy()) {
        anuncio.fechaExpiracion = calcularFechaExpiracionPorDefecto(obtenerFechaHoy());
    }

    guardarTodo(db);

    cerrarModalRestaurar();
    renderizarAnuncios();
    renderizarHistorialAnuncios();

    alert("Anuncio restaurado correctamente. Ahora vuelve a aparecer en el muro principal.");
}

function eliminarAnuncio(id) {
    const db = obtenerTodo();
    const anuncio = (db.anuncios || []).find(a => String(a.id) === String(id));

    if (!anuncio) return;

    if (anuncio.estado !== "borrador") {
        alert("Solo se pueden eliminar anuncios en borrador. Los publicados deben archivarse.");
        return;
    }

    const confirmar = confirm("¿Deseas eliminar este borrador?");

    if (!confirmar) return;

    db.anuncios = db.anuncios.filter(a => String(a.id) !== String(id));

    guardarTodo(db);
    renderizarAnuncios();
    renderizarHistorialAnuncios();

    alert("Borrador eliminado correctamente.");
}

function notificarPublicacion(db, anuncio) {
    const residentes = obtenerResidentes(db);

    db.correosEnviados = db.correosEnviados || [];
    db.notificaciones = db.notificaciones || [];

    residentes.forEach(residente => {
        db.correosEnviados.push({
            id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
            tipo: "publicacion_anuncio",
            para: residente.correo,
            asunto: `Nuevo anuncio: ${anuncio.titulo}`,
            cuerpo: anuncio.descripcion,
            anuncioId: anuncio.id,
            fechaEnvio: new Date().toISOString()
        });

        db.notificaciones.push({
            id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
            usuarioId: obtenerIdUsuario(residente),
            correo: residente.correo,
            tipo: "anuncio_publicado",
            mensaje: `Nuevo anuncio publicado: ${anuncio.titulo}`,
            anuncioId: anuncio.id,
            leido: false,
            fecha: new Date().toISOString()
        });
    });
}

function notificarActualizacion(db, anuncio, actualizacion) {
    const residentes = obtenerResidentes(db);

    db.correosEnviados = db.correosEnviados || [];
    db.notificaciones = db.notificaciones || [];

    residentes.forEach(residente => {
        db.correosEnviados.push({
            id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
            tipo: "actualizacion_anuncio",
            para: residente.correo,
            asunto: `Actualización de anuncio: ${anuncio.titulo}`,
            cuerpo: actualizacion.texto,
            anuncioId: anuncio.id,
            fechaEnvio: new Date().toISOString()
        });

        db.notificaciones.push({
            id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
            usuarioId: obtenerIdUsuario(residente),
            correo: residente.correo,
            tipo: "anuncio_actualizado",
            mensaje: `El anuncio "${anuncio.titulo}" tiene una actualización.`,
            anuncioId: anuncio.id,
            leido: false,
            fecha: new Date().toISOString()
        });
    });
}

function obtenerResidentes(db) {
    return (db.usuarios || []).filter(usuario =>
        usuario.rol === "residente" && usuario.correo
    );
}

function obtenerIdUsuario(usuario) {
    return usuario?.id || usuario?.id_usuario || usuario?.correo || "";
}

function limpiarFormularioAnuncio() {
    document.getElementById("formAnuncio").reset();
    document.getElementById("anuncioId").value = "";
    document.getElementById("archivoActual").textContent = "";
    archivoPreviewTemporal = null;

    const destacado = document.getElementById("destacadoAnuncio");
    if (destacado) destacado.value = "no";

    const fechaExpiracion = document.getElementById("fechaExpiracionAnuncio");
    if (fechaExpiracion) fechaExpiracion.value = "";

    habilitarFormularioPrincipal(true);
    configurarFechaActual();
}

function habilitarFormularioPrincipal(habilitado) {
    document.getElementById("tituloAnuncio").disabled = !habilitado;
    document.getElementById("descripcionAnuncio").disabled = !habilitado;
    document.getElementById("archivoAnuncio").disabled = !habilitado;
    document.getElementById("btnGuardarBorrador").disabled = !habilitado;
    document.getElementById("btnPublicar").disabled = !habilitado;

    const fechaExpiracion = document.getElementById("fechaExpiracionAnuncio");
    const destacado = document.getElementById("destacadoAnuncio");

    if (fechaExpiracion) fechaExpiracion.disabled = !habilitado;
    if (destacado) destacado.disabled = !habilitado;
}

function obtenerFechaHoy() {
    const hoy = new Date();

    const year = hoy.getFullYear();
    const month = String(hoy.getMonth() + 1).padStart(2, "0");
    const day = String(hoy.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function calcularFechaExpiracionPorDefecto(fechaBase) {
    const fecha = fechaBase ? new Date(fechaBase + "T00:00:00") : new Date();

    fecha.setDate(fecha.getDate() + 30);

    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, "0");
    const day = String(fecha.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function calcularDiasEntre(fechaInicio, fechaFin) {
    const inicio = new Date(fechaInicio + "T00:00:00");
    const fin = new Date(fechaFin + "T00:00:00");
    const diferencia = fin - inicio;

    return Math.ceil(diferencia / (1000 * 60 * 60 * 24));
}

function formatearFecha(fecha) {
    if (!fecha) return "-";

    const date = new Date(fecha + "T00:00:00");

    return date.toLocaleDateString("es-PE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    });
}

function formatearFechaHora(fechaISO) {
    if (!fechaISO) return "-";

    const fecha = new Date(fechaISO);

    return fecha.toLocaleString("es-PE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function claseEstado(estado) {
    if (estado === "publicado") return "vacio";
    if (estado === "archivado") return "ocupado";
    return "ocupado";
}

function formatearEstado(estado) {
    const estados = {
        borrador: "Borrador",
        publicado: "Publicado",
        archivado: "Archivado"
    };

    return estados[estado] || "Borrador";
}

function formatearTipoArchivado(tipo) {
    const tipos = {
        manual: "Manual",
        automatico: "Automático"
    };

    return tipos[tipo] || "-";
}

function capitalizar(texto) {
    if (!texto) return "";

    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function escaparHTML(texto) {
    return String(texto || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}