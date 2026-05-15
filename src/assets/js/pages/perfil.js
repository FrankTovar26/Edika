document.addEventListener("DOMContentLoaded", () => {
    protegerPerfil();
    configurarMenusPorRol();

    cargarPerfil();
    renderizarEdificios();
    renderizarUnidades();

    configurarFormularioPerfil();
    configurarFormularioPassword();
});

/* =========================================================
   SEGURIDAD
========================================================= */

function protegerPerfil() {
    const sesion = obtenerSesion();

    if (!sesion) {
        window.location.href = "../../../index.html";
    }
}

function obtenerSesion() {
    return JSON.parse(localStorage.getItem("usuarioSesion"));
}

function actualizarSesion(usuarioActualizado) {
    localStorage.setItem(
        "usuarioSesion",
        JSON.stringify(usuarioActualizado)
    );
}

function cerrarSesion() {
    localStorage.removeItem("usuarioSesion");
    window.location.href = "../../../index.html";
}

/* =========================================================
   MENÚS POR ROL
========================================================= */

function configurarMenusPorRol() {
    const sesion = obtenerSesion();

    const menuAdmin = document.getElementById("menuAdmin");
    const menuResidente = document.getElementById("menuResidente");

    if (!sesion) return;

    if (sesion.rol === "residente") {
        if (menuAdmin) menuAdmin.style.display = "none";
        if (menuResidente) menuResidente.style.display = "block";
    } else {
        if (menuAdmin) menuAdmin.style.display = "block";
        if (menuResidente) menuResidente.style.display = "none";
    }
}

/* =========================================================
   CARGAR PERFIL
========================================================= */

function cargarPerfil() {
    const sesion = obtenerSesion();
    const db = obtenerTodo();

    if (!sesion) return;

    const usuario = (db.usuarios || []).find(u =>
        String(u.id) === String(sesion.id)
    ) || sesion;

    // HEADER
    setText("perfilNombreTitulo", usuario.nombre || "Usuario");
    setText("perfilRolTexto", formatearRol(usuario.rol));

    // AVATAR
    const avatar = document.getElementById("perfilAvatar");

    if (avatar) {
        avatar.textContent = obtenerIniciales(usuario.nombre || "U");
    }

    // FORM
    setValue("perfilId", usuario.id || "");
    setValue("perfilNombre", usuario.nombre || "");
    setValue("perfilCorreo", usuario.correo || "");
    setValue("perfilTelefono", usuario.telefono || "");
    setValue("perfilDocumento", usuario.documento || "");

    // INFO
    setText("infoRol", formatearRol(usuario.rol));
    setText("infoEstado", capitalizar(usuario.estado || "activo"));

    setText(
        "infoFechaRegistro",
        formatearFecha(usuario.fechaRegistro)
    );

    setText(
        "infoUltimoAcceso",
        formatearFechaHora(usuario.ultimoAcceso)
    );
}

/* =========================================================
   GUARDAR DATOS PERSONALES
========================================================= */

function configurarFormularioPerfil() {
    const form = document.getElementById("formPerfil");

    if (!form) return;

    form.addEventListener("submit", event => {
        event.preventDefault();

        const db = obtenerTodo();
        const sesion = obtenerSesion();

        const usuario = (db.usuarios || []).find(u =>
            String(u.id) === String(sesion.id)
        );

        if (!usuario) {
            alert("Usuario no encontrado.");
            return;
        }

        const nombre = document.getElementById("perfilNombre").value.trim();
        const correo = document.getElementById("perfilCorreo").value.trim();
        const telefono = document.getElementById("perfilTelefono").value.trim();
        const documento = document.getElementById("perfilDocumento").value.trim();

        if (!nombre) {
            alert("Ingresa tu nombre.");
            return;
        }

        if (!correo) {
            alert("Ingresa tu correo.");
            return;
        }

        // Validar correo duplicado
        const correoDuplicado = (db.usuarios || []).some(u =>
            String(u.id) !== String(usuario.id) &&
            String(u.correo).toLowerCase() === correo.toLowerCase()
        );

        if (correoDuplicado) {
            alert("Ese correo ya está registrado.");
            return;
        }

        usuario.nombre = nombre;
        usuario.correo = correo;
        usuario.telefono = telefono;
        usuario.documento = documento;

        guardarTodo(db);

        actualizarSesion(usuario);

        cargarPerfil();

        alert("Perfil actualizado correctamente.");
    });
}

/* =========================================================
   CAMBIO DE PASSWORD
========================================================= */

function configurarFormularioPassword() {
    const form = document.getElementById("formPassword");

    if (!form) return;

    form.addEventListener("submit", event => {
        event.preventDefault();

        const nueva = document.getElementById("nuevaPassword").value.trim();
        const confirmar = document.getElementById("confirmarPassword").value.trim();

        if (!nueva || !confirmar) {
            alert("Completa ambos campos.");
            return;
        }

        if (nueva.length < 6) {
            alert("La contraseña debe tener mínimo 6 caracteres.");
            return;
        }

        if (nueva !== confirmar) {
            alert("Las contraseñas no coinciden.");
            return;
        }

        const db = obtenerTodo();
        const sesion = obtenerSesion();

        const usuario = (db.usuarios || []).find(u =>
            String(u.id) === String(sesion.id)
        );

        if (!usuario) {
            alert("Usuario no encontrado.");
            return;
        }

        usuario.password = nueva;

        guardarTodo(db);

        document.getElementById("nuevaPassword").value = "";
        document.getElementById("confirmarPassword").value = "";

        alert("Contraseña actualizada correctamente.");
    });
}

/* =========================================================
   EDIFICIOS
========================================================= */

function renderizarEdificios() {
    const contenedor = document.getElementById("listaEdificios");

    if (!contenedor) return;

    const sesion = obtenerSesion();
    const db = obtenerTodo();

    let edificios = [];

    if (sesion.rol === "superadmin") {
        edificios = db.edificios || [];
    }

    else if (sesion.rol === "admin") {

        const ids = obtenerIdsEdificiosAsignadosSesion(sesion);

        edificios = (db.edificios || []).filter(edificio =>
            ids.includes(String(edificio.id))
        );
    }

    else if (sesion.rol === "residente") {

        const unidades = sesion.unidadesAutorizadas || [];

        const ids = [...new Set(
            unidades.map(u => String(u.edificioId))
        )];

        edificios = (db.edificios || []).filter(edificio =>
            ids.includes(String(edificio.id))
        );
    }

    if (edificios.length === 0) {
        contenedor.innerHTML = `
            <p>No hay edificios vinculados.</p>
        `;
        return;
    }

    contenedor.innerHTML = edificios.map(edificio => `
        <span class="chip">
            ${edificio.nombre}
        </span>
    `).join("");
}

/* =========================================================
   UNIDADES
========================================================= */

function renderizarUnidades() {
    const card = document.getElementById("cardUnidades");
    const contenedor = document.getElementById("listaUnidades");

    if (!card || !contenedor) return;

    const sesion = obtenerSesion();
    const db = obtenerTodo();

    // SOLO RESIDENTE
    if (sesion.rol !== "residente") {
        card.style.display = "none";
        return;
    }

    const vinculaciones = sesion.unidadesAutorizadas || [];

    if (vinculaciones.length === 0) {
        contenedor.innerHTML = `
            <p>No tienes unidades vinculadas.</p>
        `;
        return;
    }

    contenedor.innerHTML = vinculaciones.map(v => {

        const edificio = (db.edificios || []).find(e =>
            String(e.id) === String(v.edificioId)
        );

        return `
            <div class="chip-card">

                <strong>
                    ${v.unidadNumero || "-"}
                </strong>

                <small>
                    ${capitalizar(v.tipoVinculacion || "Vinculado")}
                </small>

                <small>
                    ${edificio ? edificio.nombre : "-"}
                </small>

            </div>
        `;

    }).join("");
}

/* =========================================================
   HELPERS
========================================================= */

function obtenerIdsEdificiosAsignadosSesion(sesion) {
    if (!sesion) return [];

    if (
        Array.isArray(sesion.edificioIds) &&
        sesion.edificioIds.length > 0
    ) {
        return sesion.edificioIds
            .filter(Boolean)
            .map(String);
    }

    if (sesion.edificioId) {
        return [String(sesion.edificioId)];
    }

    return [];
}

function formatearRol(rol) {

    const roles = {
        superadmin: "Superadministrador",
        admin: "Administrador",
        residente: "Residente"
    };

    return roles[rol] || "Usuario";
}

function obtenerIniciales(nombre) {

    if (!nombre) return "U";

    const partes = nombre.trim().split(" ");

    if (partes.length === 1) {
        return partes[0].charAt(0).toUpperCase();
    }

    return (
        partes[0].charAt(0) +
        partes[1].charAt(0)
    ).toUpperCase();
}

function capitalizar(texto) {

    if (!texto) return "";

    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function formatearFecha(fechaISO) {

    if (!fechaISO) return "-";

    const fecha = new Date(fechaISO);

    return fecha.toLocaleDateString("es-PE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    });
}

function formatearFechaHora(fechaISO) {

    if (!fechaISO) return "-";

    const fecha = new Date(fechaISO);

    return fecha.toLocaleString("es-PE");
}

function setText(id, valor) {

    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.textContent = valor;
    }
}

function setValue(id, valor) {

    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.value = valor;
    }
}