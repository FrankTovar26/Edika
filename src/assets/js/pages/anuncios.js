let anuncioPendientePublicacion = null;

document.addEventListener("DOMContentLoaded", () => {
    protegerPaginaAdmin();
    configurarFormularioAnuncio();
    configurarModalPreview();
    renderizarAnuncios();
    configurarFechaActual();
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

function configurarFechaActual() {
    const fecha = document.getElementById("fechaAnuncio");

    if (!fecha) return;

    if (!fecha.value) {
        fecha.value = obtenerFechaHoy();
    }
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
        mostrarPreview(datos.anuncio);
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

    const id = document.getElementById("anuncioId").value;
    const anuncio = datos.anuncio;

    if (id) {
        const existente = db.anuncios.find(a => String(a.id) === String(id));

        if (!existente) {
            alert("Anuncio no encontrado.");
            return;
        }

        if (existente.estado === "publicado") {
            alert("No se puede editar el contenido principal de un anuncio publicado.");
            return;
        }

        existente.titulo = anuncio.titulo;
        existente.descripcion = anuncio.descripcion;
        existente.fecha = anuncio.fecha;
        existente.archivo = anuncio.archivo;
        existente.estado = estado;
        existente.fechaActualizacion = new Date().toISOString();

        if (estado === "publicado") {
            existente.fechaPublicacion = new Date().toISOString();
            simularEnvioCorreo(existente);
        }
    } else {
        const nuevoAnuncio = {
            id: Date.now().toString(),
            titulo: anuncio.titulo,
            descripcion: anuncio.descripcion,
            fecha: anuncio.fecha,
            archivo: anuncio.archivo,
            estado,
            fechaCreacion: new Date().toISOString(),
            fechaPublicacion: estado === "publicado" ? new Date().toISOString() : null
        };

        db.anuncios.push(nuevoAnuncio);

        if (estado === "publicado") {
            simularEnvioCorreo(nuevoAnuncio);
        }
    }

    guardarTodo(db);

    limpiarFormularioAnuncio();
    renderizarAnuncios();

    alert(estado === "publicado"
        ? "Anuncio publicado correctamente. Se notificó a los residentes."
        : "Anuncio guardado como borrador.");
}

async function obtenerDatosFormulario() {
    const titulo = document.getElementById("tituloAnuncio").value.trim();
    const descripcion = document.getElementById("descripcionAnuncio").value.trim();
    const fecha = document.getElementById("fechaAnuncio").value;
    const archivoInput = document.getElementById("archivoAnuncio");

    if (!titulo || !descripcion || !fecha) {
        return {
            ok: false,
            error: "Completa título, descripción y fecha."
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
            error: "Solo se permiten archivos PDF o imágenes."
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

function mostrarPreview(anuncio) {
    const modal = document.getElementById("modalPreviewAnuncio");
    const preview = document.getElementById("previewContenido");

    preview.innerHTML = `
        <p><strong>Título:</strong> ${anuncio.titulo}</p>
        <p><strong>Fecha:</strong> ${formatearFecha(anuncio.fecha)}</p>
        <p><strong>Descripción:</strong></p>
        <p>${anuncio.descripcion}</p>
        <p><strong>Archivo adjunto:</strong> ${anuncio.archivo ? anuncio.archivo.nombre : "Sin archivo"}</p>
    `;

    modal.style.display = "flex";
}

function cerrarPreview() {
    document.getElementById("modalPreviewAnuncio").style.display = "none";
    anuncioPendientePublicacion = null;
}

function renderizarAnuncios() {
    const db = obtenerTodo();
    const tabla = document.getElementById("tablaAnuncios");

    db.anuncios = db.anuncios || [];

    if (db.anuncios.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="5">No hay anuncios registrados.</td>
            </tr>
        `;
        return;
    }

    tabla.innerHTML = db.anuncios.map(anuncio => `
        <tr>
            <td>${anuncio.titulo}</td>
            <td>${formatearFecha(anuncio.fecha)}</td>
            <td>
                <span class="badge ${anuncio.estado === "publicado" ? "vacio" : "ocupado"}">
                    ${capitalizar(anuncio.estado)}
                </span>
            </td>
            <td>${anuncio.archivo ? anuncio.archivo.nombre : "-"}</td>
            <td>
                ${anuncio.estado === "borrador" ? `
                    <button class="btn btn-blue" onclick="cargarAnuncioParaEditar('${anuncio.id}')">
                        Editar
                    </button>

                    <button class="btn btn-green" onclick="prepararPublicacionDesdeTabla('${anuncio.id}')">
                        Publicar
                    </button>
                ` : `
                    <button class="btn btn-blue" onclick="verAnuncioPublicado('${anuncio.id}')">
                        Ver
                    </button>
                `}

                <button class="btn btn-red" onclick="eliminarAnuncio('${anuncio.id}')">
                    Eliminar
                </button>
            </td>
        </tr>
    `).join("");
}

function cargarAnuncioParaEditar(id) {
    const db = obtenerTodo();
    const anuncio = (db.anuncios || []).find(a => String(a.id) === String(id));

    if (!anuncio) return;

    if (anuncio.estado === "publicado") {
        alert("No se puede editar un anuncio publicado.");
        return;
    }

    document.getElementById("anuncioId").value = anuncio.id;
    document.getElementById("tituloAnuncio").value = anuncio.titulo;
    document.getElementById("descripcionAnuncio").value = anuncio.descripcion;
    document.getElementById("fechaAnuncio").value = anuncio.fecha;
    document.getElementById("archivoActual").textContent = anuncio.archivo
        ? `Archivo actual: ${anuncio.archivo.nombre}`
        : "";

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function prepararPublicacionDesdeTabla(id) {
    const db = obtenerTodo();
    const anuncio = (db.anuncios || []).find(a => String(a.id) === String(id));

    if (!anuncio) return;

    anuncioPendientePublicacion = {
        titulo: anuncio.titulo,
        descripcion: anuncio.descripcion,
        fecha: anuncio.fecha,
        archivo: anuncio.archivo,
        idExistente: anuncio.id
    };

    document.getElementById("anuncioId").value = anuncio.id;
    mostrarPreview(anuncioPendientePublicacion);
}

function verAnuncioPublicado(id) {
    const db = obtenerTodo();
    const anuncio = (db.anuncios || []).find(a => String(a.id) === String(id));

    if (!anuncio) return;

    mostrarPreview(anuncio);
}

function eliminarAnuncio(id) {
    const confirmar = confirm("¿Deseas eliminar este anuncio?");

    if (!confirmar) return;

    const db = obtenerTodo();

    db.anuncios = (db.anuncios || []).filter(a => String(a.id) !== String(id));

    guardarTodo(db);
    renderizarAnuncios();

    alert("Anuncio eliminado correctamente.");
}

function simularEnvioCorreo(anuncio) {
    const db = obtenerTodo();
    const residentes = (db.usuarios || []).filter(u => u.rol === "residente");

    db.correosEnviados = db.correosEnviados || [];

    residentes.forEach(residente => {
        db.correosEnviados.push({
            id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
            para: residente.correo,
            asunto: `Nuevo anuncio: ${anuncio.titulo}`,
            cuerpo: anuncio.descripcion,
            anuncioId: anuncio.id,
            fechaEnvio: new Date().toISOString()
        });
    });
}

function limpiarFormularioAnuncio() {
    document.getElementById("formAnuncio").reset();
    document.getElementById("anuncioId").value = "";
    document.getElementById("archivoActual").textContent = "";
    configurarFechaActual();
}

function obtenerFechaHoy() {
    const hoy = new Date();

    const year = hoy.getFullYear();
    const month = String(hoy.getMonth() + 1).padStart(2, "0");
    const day = String(hoy.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
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

function capitalizar(texto) {
    if (!texto) return "";

    return texto.charAt(0).toUpperCase() + texto.slice(1);
}