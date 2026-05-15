let anunciosMostrados = 10;
let filtroActual = "todos";

document.addEventListener("DOMContentLoaded", () => {
    protegerPaginaResidente();
    inicializarLecturasAnuncios();
    configurarFiltrosAnuncios();
    configurarBotonCargarMas();
    configurarModalDetalle();
    actualizarResumenYContador();
    renderizarAnunciosResidente();
});

function protegerPaginaResidente() {
    const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));

    if (!sesion) {
        window.location.href = "../../../index.html";
        return;
    }

    if (sesion.rol !== "residente") {
        alert("No tienes permisos para acceder a esta página.");
        window.location.href = "../admin/dashboard.html";
    }
}

function inicializarLecturasAnuncios() {
    const db = obtenerTodo();

    db.lecturasAnuncios = db.lecturasAnuncios || [];

    guardarTodo(db);
}

function configurarFiltrosAnuncios() {
    const botones = document.querySelectorAll(".filtro-anuncio");

    botones.forEach(boton => {
        boton.addEventListener("click", () => {
            botones.forEach(b => b.classList.remove("active", "btn-blue"));
            boton.classList.add("active", "btn-blue");

            filtroActual = boton.dataset.filtro;
            anunciosMostrados = 10;

            renderizarAnunciosResidente();
        });
    });
}

function configurarBotonCargarMas() {
    const boton = document.getElementById("btnCargarMasAnuncios");

    if (!boton) return;

    boton.addEventListener("click", () => {
        anunciosMostrados += 10;
        renderizarAnunciosResidente();
    });
}

function configurarModalDetalle() {
    const modal = document.getElementById("modalDetalleAnuncioResidente");
    const cerrar = document.getElementById("cerrarDetalleAnuncioResidente");

    if (!modal || !cerrar) return;

    cerrar.addEventListener("click", cerrarModalDetalle);

    window.addEventListener("click", event => {
        if (event.target === modal) {
            cerrarModalDetalle();
        }
    });
}

function renderizarAnunciosResidente() {
    const contenedor = document.getElementById("contenedorAnunciosResidente");
    const botonCargarMas = document.getElementById("btnCargarMasAnuncios");

    if (!contenedor) return;

    const anuncios = obtenerAnunciosFiltrados();
    const anunciosPaginados = anuncios.slice(0, anunciosMostrados);

    actualizarResumenYContador();

    if (anunciosPaginados.length === 0) {
        contenedor.innerHTML = `
            <section class="card">
                <p>No hay anuncios disponibles para mostrar.</p>
            </section>
        `;

        if (botonCargarMas) botonCargarMas.style.display = "none";
        return;
    }

    contenedor.innerHTML = anunciosPaginados.map(anuncio => {
        const lectura = obtenerLecturaAnuncio(anuncio.id);
        const leido = !!lectura;

        return `
            <section class="card" style="${!leido ? 'border-left: 5px solid #2563eb;' : ''}">
                <div style="display: flex; justify-content: space-between; gap: 15px; align-items: flex-start;">
                    <div>
                        <h2 style="margin-bottom: 5px; ${!leido ? 'font-weight: 800;' : ''}">
                            ${!leido ? '<span style="color:#2563eb;">●</span>' : ''}
                            ${escaparHTML(anuncio.titulo)}
                        </h2>

                        <p style="font-size: 0.85rem; color: #666;">
                            ${formatearFecha(anuncio.fecha)}
                            ${anuncio.destacado === "si" ? " · ⭐ Destacado" : ""}
                            ${!leido ? " · Nuevo" : ` · Leído el ${formatearFechaHora(lectura.fechaLectura)}`}
                        </p>
                    </div>

                    <button class="btn btn-blue" onclick="abrirDetalleAnuncio('${anuncio.id}')">
                        Ver
                    </button>
                </div>

                <p style="margin-top: 12px;">
                    ${escaparHTML(resumirTexto(anuncio.descripcion, 180))}
                </p>

                ${
                    anuncio.archivo
                        ? `<p style="font-size: 0.85rem; color: #666; margin-top: 8px;">
                            📎 Archivo adjunto: ${escaparHTML(anuncio.archivo.nombre)}
                           </p>`
                        : ""
                }

                ${
                    anuncio.actualizaciones && anuncio.actualizaciones.length > 0
                        ? `<p style="font-size: 0.85rem; color: #666; margin-top: 8px;">
                            Este anuncio tiene ${anuncio.actualizaciones.length} actualización(es).
                           </p>`
                        : ""
                }
            </section>
        `;
    }).join("");

    if (botonCargarMas) {
        botonCargarMas.style.display = anunciosMostrados < anuncios.length ? "inline-block" : "none";
    }
}

function obtenerAnunciosFiltrados() {
    const db = obtenerTodo();
    const anuncios = db.anuncios || [];

    let publicados = anuncios.filter(anuncio => anuncio.estado === "publicado");

    if (filtroActual === "noLeidos") {
        publicados = publicados.filter(anuncio => !anuncioEstaLeido(anuncio.id));
    }

    if (filtroActual === "destacados") {
        publicados = publicados.filter(anuncio => anuncio.destacado === "si");
    }

    publicados.sort((a, b) => {
        if (a.destacado === "si" && b.destacado !== "si") return -1;
        if (a.destacado !== "si" && b.destacado === "si") return 1;

        return new Date(b.fechaPublicacion || b.fechaCreacion || b.fecha || 0) -
               new Date(a.fechaPublicacion || a.fechaCreacion || a.fecha || 0);
    });

    return publicados;
}

function abrirDetalleAnuncio(id) {
    const db = obtenerTodo();
    const anuncio = (db.anuncios || []).find(a => String(a.id) === String(id));

    if (!anuncio || anuncio.estado !== "publicado") {
        alert("El anuncio no está disponible.");
        return;
    }

    marcarAnuncioComoLeido(anuncio.id);

    const lectura = obtenerLecturaAnuncio(anuncio.id);

    document.getElementById("detalleTituloAnuncio").textContent = anuncio.titulo;

    document.getElementById("detalleMetaAnuncio").innerHTML = `
        Publicado el ${formatearFecha(anuncio.fecha)}
        ${anuncio.destacado === "si" ? " · ⭐ Destacado" : ""}
        ${lectura ? ` · Leído el ${formatearFechaHora(lectura.fechaLectura)}` : ""}
    `;

    document.getElementById("detalleContenidoAnuncio").innerHTML = `
        <p>${escaparHTML(anuncio.descripcion).replace(/\n/g, "<br>")}</p>

        ${renderizarArchivoAdjunto(anuncio)}

        ${renderizarActualizaciones(anuncio)}
    `;

    document.getElementById("modalDetalleAnuncioResidente").style.display = "flex";

    actualizarResumenYContador();
    renderizarAnunciosResidente();
}

function renderizarArchivoAdjunto(anuncio) {
    if (!anuncio.archivo) {
        return `
            <p style="margin-top: 15px;">
                <strong>Archivo adjunto:</strong> Sin archivo
            </p>
        `;
    }

    const archivo = anuncio.archivo;
    const esImagen = archivo.tipo && archivo.tipo.startsWith("image/");
    const esPDF = archivo.tipo === "application/pdf";

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
                <button type="button" class="btn btn-blue" onclick="verArchivoAdjunto('${anuncio.id}')">
                    Ver archivo
                </button>

                <button type="button" class="btn btn-green" onclick="descargarArchivoAdjunto('${anuncio.id}')">
                    Descargar archivo
                </button>
            </div>
        </div>
    `;
}

function verArchivoAdjunto(anuncioId) {
    const archivo = obtenerArchivoPorAnuncio(anuncioId);

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

function descargarArchivoAdjunto(anuncioId) {
    const archivo = obtenerArchivoPorAnuncio(anuncioId);

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

function obtenerArchivoPorAnuncio(anuncioId) {
    const db = obtenerTodo();
    const anuncio = (db.anuncios || []).find(a => String(a.id) === String(anuncioId));

    return anuncio?.archivo || null;
}

function obtenerIconoArchivo(archivo) {
    if (!archivo || !archivo.tipo) return "📎";
    if (archivo.tipo === "application/pdf") return "📄";
    if (archivo.tipo.startsWith("image/")) return "🖼️";
    return "📎";
}

function renderizarActualizaciones(anuncio) {
    const actualizaciones = anuncio.actualizaciones || [];

    if (actualizaciones.length === 0) return "";

    return `
        <hr style="margin: 20px 0;">
        <h3>Actualizaciones / Fe de erratas</h3>

        ${actualizaciones.map(actualizacion => `
            <div style="margin-top: 12px; padding: 12px; background: #f8f8f8; border-radius: 8px;">
                <p style="font-size: 0.85rem; color: #666;">
                    ${formatearFechaHora(actualizacion.fechaHora)} · ${escaparHTML(actualizacion.autor || "Administración")}
                </p>

                <p style="margin-top: 6px;">
                    ${escaparHTML(actualizacion.texto).replace(/\n/g, "<br>")}
                </p>
            </div>
        `).join("")}
    `;
}

function cerrarModalDetalle() {
    document.getElementById("modalDetalleAnuncioResidente").style.display = "none";
}

function marcarAnuncioComoLeido(id) {
    const db = obtenerTodo();
    const sesion = obtenerSesionActual();

    if (!sesion) return;

    db.lecturasAnuncios = db.lecturasAnuncios || [];

    const usuarioId = obtenerUsuarioIdSesion(sesion);

    const yaExiste = db.lecturasAnuncios.some(lectura =>
        String(lectura.anuncioId) === String(id) &&
        String(lectura.usuarioId) === String(usuarioId)
    );

    if (yaExiste) return;

    db.lecturasAnuncios.push({
        id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
        anuncioId: String(id),
        usuarioId: String(usuarioId),
        usuarioCorreo: sesion.correo || "",
        usuarioNombre: sesion.nombre || sesion.nombres || "Residente",
        fechaLectura: new Date().toISOString()
    });

    marcarNotificacionComoLeida(db, id, sesion);

    guardarTodo(db);
}

function marcarNotificacionComoLeida(db, anuncioId, sesion) {
    db.notificaciones = db.notificaciones || [];

    const usuarioId = obtenerUsuarioIdSesion(sesion);

    db.notificaciones.forEach(notificacion => {
        const mismaNotificacion =
            String(notificacion.anuncioId) === String(anuncioId) &&
            (
                String(notificacion.usuarioId) === String(usuarioId) ||
                String(notificacion.correo || "") === String(sesion.correo || "")
            );

        if (mismaNotificacion) {
            notificacion.leido = true;
            notificacion.fechaLectura = new Date().toISOString();
        }
    });
}

function anuncioEstaLeido(id) {
    return !!obtenerLecturaAnuncio(id);
}

function obtenerLecturaAnuncio(id) {
    const db = obtenerTodo();
    const sesion = obtenerSesionActual();

    if (!sesion) return null;

    const usuarioId = obtenerUsuarioIdSesion(sesion);

    return (db.lecturasAnuncios || []).find(lectura =>
        String(lectura.anuncioId) === String(id) &&
        String(lectura.usuarioId) === String(usuarioId)
    ) || null;
}

function actualizarResumenYContador() {
    const db = obtenerTodo();
    const anunciosPublicados = (db.anuncios || []).filter(anuncio => anuncio.estado === "publicado");
    const pendientes = anunciosPublicados.filter(anuncio => !anuncioEstaLeido(anuncio.id)).length;

    const contadorSidebar = document.getElementById("contadorAnunciosPendientes");
    const totalPublicados = document.getElementById("totalAnunciosPublicados");
    const totalNoLeidos = document.getElementById("totalAnunciosNoLeidos");

    if (contadorSidebar) {
        contadorSidebar.textContent = pendientes;

        if (pendientes > 0) {
            contadorSidebar.style.display = "inline-block";
        } else {
            contadorSidebar.style.display = "none";
        }
    }

    if (totalPublicados) {
        totalPublicados.textContent = anunciosPublicados.length;
    }

    if (totalNoLeidos) {
        totalNoLeidos.textContent = pendientes;
    }
}

function obtenerSesionActual() {
    return JSON.parse(localStorage.getItem("usuarioSesion"));
}

function obtenerUsuarioIdSesion(sesion) {
    return sesion?.id || sesion?.id_usuario || sesion?.correo || "residente";
}

function resumirTexto(texto, limite) {
    if (!texto) return "";

    if (texto.length <= limite) return texto;

    return texto.substring(0, limite).trim() + "...";
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

function escaparHTML(texto) {
    return String(texto || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}