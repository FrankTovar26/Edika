document.addEventListener("DOMContentLoaded", () => {
    protegerPaginaAdmin();
    configurarEventos();
    cargarUnidadesDisponibles();
    renderizarInvitaciones();
});

function protegerPaginaAdmin() {
    if (typeof protegerPaginaAdminData === "function") {
        protegerPaginaAdminData();
        return;
    }

    const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));

    if (!sesion) {
        window.location.href = "../../../index.html";
        return;
    }

    if (sesion.rol !== "admin" && sesion.rol !== "superadmin") {
        alert("No tienes permisos para acceder a esta página.");
        window.location.href = "../residente/inicio.html";
    }
}

function obtenerEdificiosPermitidos() {
    if (typeof obtenerEdificiosPermitidosSesion === "function") {
        return obtenerEdificiosPermitidosSesion();
    }

    const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));
    const db = obtenerTodo();

    if (!sesion) return [];

    if (sesion.rol === "superadmin") {
        return (db.edificios || []).map(e => String(e.id));
    }

    if (sesion.rol === "admin") {
        return (sesion.edificioIds || [sesion.edificioId])
            .filter(Boolean)
            .map(String);
    }

    return [];
}

function obtenerDepartamentosPermitidos(db) {
    const permitidos = obtenerEdificiosPermitidos();

    if (permitidos.length === 0) {
        return db.departamentos || [];
    }

    return (db.departamentos || []).filter(dep =>
        permitidos.includes(String(dep.edificioId || ""))
    );
}

function configurarEventos() {
    const form = document.getElementById("formInvitacion");
    const filtroTipo = document.getElementById("tipoUnidadFiltro");
    const unidad = document.getElementById("unidad");

    if (form) {
        form.addEventListener("submit", generarInvitacion);
    }

    if (filtroTipo) {
        filtroTipo.addEventListener("change", cargarUnidadesDisponibles);
    }

    if (unidad) {
        unidad.addEventListener("change", ajustarTiposDeVinculacion);
    }
}

function cargarUnidadesDisponibles() {
    const db = obtenerTodo();

    const selectUnidad = document.getElementById("unidad");
    const filtroTipo = document.getElementById("tipoUnidadFiltro")?.value || "";

    if (!selectUnidad) return;

    let unidades = obtenerDepartamentosPermitidos(db);

    if (filtroTipo) {
        unidades = unidades.filter(unidad =>
            normalizarTipoUnidad(unidad.tipo) === filtroTipo
        );
    }

    unidades = unidades.filter(unidad => {
        const estado = normalizarEstadoUnidad(unidad.estado);
        return estado !== "mantenimiento" && estado !== "inactiva";
    });

    unidades.sort((a, b) =>
        String(a.numero).localeCompare(String(b.numero))
    );

    selectUnidad.innerHTML = `
        <option value="">Seleccione una unidad</option>
    `;

    unidades.forEach(unidad => {
        selectUnidad.innerHTML += `
            <option value="${unidad.id}">
                ${unidad.numero} - ${formatearPiso(unidad.piso)} - ${formatearTipoUnidad(unidad.tipo)}
            </option>
        `;
    });

    ajustarTiposDeVinculacion();
}

function ajustarTiposDeVinculacion() {
    const db = obtenerTodo();

    const unidadId = document.getElementById("unidad")?.value;
    const selectTipo = document.getElementById("tipoResidente");

    if (!selectTipo) return;

    const unidad = obtenerDepartamentosPermitidos(db).find(u =>
        String(u.id) === String(unidadId)
    );

    selectTipo.innerHTML = "";

    if (!unidad) {
        selectTipo.innerHTML = `
            <option value="propietario">Propietario</option>
            <option value="inquilino">Inquilino</option>
            <option value="autorizado">Usuario autorizado</option>
        `;
        return;
    }

    const tipoUnidad = normalizarTipoUnidad(unidad.tipo);

    if (tipoUnidad === "departamento") {
        selectTipo.innerHTML = `
            <option value="propietario">Propietario</option>
            <option value="inquilino">Inquilino</option>
            <option value="autorizado">Usuario autorizado</option>
        `;
        return;
    }

    selectTipo.innerHTML = `
        <option value="autorizado">Usuario autorizado</option>
    `;
}

function generarInvitacion(event) {
    event.preventDefault();

    const correo = document.getElementById("correo").value.trim().toLowerCase();
    const unidadId = document.getElementById("unidad").value;
    const tipoVinculacion = document.getElementById("tipoResidente").value;

    if (!correo || !unidadId || !tipoVinculacion) {
        alert("Completa todos los campos.");
        return;
    }

    const db = obtenerTodo();

    const unidad = obtenerDepartamentosPermitidos(db).find(u =>
        String(u.id) === String(unidadId)
    );

    if (!unidad) {
        alert("La unidad seleccionada no existe o no pertenece a tu edificio asignado.");
        return;
    }

    const tipoUnidad = normalizarTipoUnidad(unidad.tipo);

    if (tipoUnidad !== "departamento" && tipoVinculacion !== "autorizado") {
        alert("Las oficinas, estacionamientos y depósitos solo permiten usuarios autorizados.");
        return;
    }

    if (correoYaExisteEnUnidad(db, correo, unidadId, tipoVinculacion)) {
        alert("Este correo ya está vinculado o invitado en esta misma unidad.");
        return;
    }

    let resultado;

    if (tipoVinculacion === "propietario") {
        resultado = vincularPropietarioSeguro(unidadId, correo);
    }

    if (tipoVinculacion === "inquilino") {
        resultado = vincularInquilinoSeguro(unidadId, correo);
    }

    if (tipoVinculacion === "autorizado") {
        resultado = vincularAutorizadoSeguro(unidadId, correo);
    }

    if (!resultado || !resultado.ok) {
        alert(resultado?.error || "No se pudo generar la invitación.");
        return;
    }

    document.getElementById("formInvitacion").reset();

    cargarUnidadesDisponibles();
    renderizarInvitaciones();

    alert(resultado.mensaje || "Invitación generada correctamente.");
}

function vincularPropietarioSeguro(unidadId, correo) {
    const db = obtenerTodo();

    const unidad = obtenerDepartamentosPermitidos(db).find(u =>
        String(u.id) === String(unidadId)
    );

    if (!unidad) {
        return {
            ok: false,
            error: "Unidad no encontrada o no pertenece a tu edificio asignado."
        };
    }

    if (normalizarTipoUnidad(unidad.tipo) !== "departamento") {
        return {
            ok: false,
            error: "Solo se puede asignar propietario a unidades de tipo departamento."
        };
    }

    if (unidad.emailPropietario) {
        return {
            ok: false,
            error: "Esta unidad ya tiene propietario vinculado o invitado."
        };
    }

    const usuarioExistente = buscarUsuarioPorCorreo(db, correo);

    unidad.emailPropietario = correo;

    if (usuarioExistente) {
        unidad.estadoInvitacion = "aceptada";
        unidad.codigoPropietario = "-";
        unidad.nombreReal = usuarioExistente.nombre || "";
        unidad.dniPropietario = usuarioExistente.dni || "";
        unidad.password = usuarioExistente.clave || "";
        unidad.residente = usuarioExistente.nombre || correo;

        agregarUnidadAUsuario(usuarioExistente, unidad, "propietario");
        actualizarUnidadPrincipalSiCorresponde(usuarioExistente, unidad, "propietario");

        guardarTodo(db);

        return {
            ok: true,
            mensaje: "El correo ya tenía cuenta activa. Propietario vinculado automáticamente."
        };
    }

    unidad.estadoInvitacion = "pendiente";
    unidad.codigoPropietario = generarCodigoInvitacion();

    guardarTodo(db);

    return {
        ok: true,
        mensaje: "Invitación de propietario generada correctamente."
    };
}

function vincularInquilinoSeguro(unidadId, correo) {
    const db = obtenerTodo();

    const unidad = obtenerDepartamentosPermitidos(db).find(u =>
        String(u.id) === String(unidadId)
    );

    if (!unidad) {
        return {
            ok: false,
            error: "Unidad no encontrada o no pertenece a tu edificio asignado."
        };
    }

    if (normalizarTipoUnidad(unidad.tipo) !== "departamento") {
        return {
            ok: false,
            error: "Solo se puede asignar inquilino a unidades de tipo departamento."
        };
    }

    if (unidad.emailInquilino) {
        return {
            ok: false,
            error: "Esta unidad ya tiene inquilino vinculado o invitado."
        };
    }

    const usuarioExistente = buscarUsuarioPorCorreo(db, correo);

    unidad.emailInquilino = correo;

    if (usuarioExistente) {
        unidad.estadoInquilino = "aceptada";
        unidad.codigoInquilino = "-";
        unidad.nombreInquilino = usuarioExistente.nombre || "";
        unidad.dniInquilino = usuarioExistente.dni || "";
        unidad.passwordInquilino = usuarioExistente.clave || "";
        unidad.residente = usuarioExistente.nombre || correo;

        agregarUnidadAUsuario(usuarioExistente, unidad, "inquilino");
        actualizarUnidadPrincipalSiCorresponde(usuarioExistente, unidad, "inquilino");

        guardarTodo(db);

        return {
            ok: true,
            mensaje: "El correo ya tenía cuenta activa. Inquilino vinculado automáticamente."
        };
    }

    unidad.estadoInquilino = "pendiente";
    unidad.codigoInquilino = generarCodigoInvitacion();

    guardarTodo(db);

    return {
        ok: true,
        mensaje: "Invitación de inquilino generada correctamente."
    };
}

function vincularAutorizadoSeguro(unidadId, correo) {
    const db = obtenerTodo();

    const unidad = obtenerDepartamentosPermitidos(db).find(u =>
        String(u.id) === String(unidadId)
    );

    if (!unidad) {
        return {
            ok: false,
            error: "Unidad no encontrada o no pertenece a tu edificio asignado."
        };
    }

    unidad.autorizados = unidad.autorizados || [];

    const yaExiste = unidad.autorizados.some(a =>
        String(a.correo || "").toLowerCase() === correo
    );

    if (yaExiste) {
        return {
            ok: false,
            error: "Este correo ya está autorizado en esta unidad."
        };
    }

    const usuarioExistente = buscarUsuarioPorCorreo(db, correo);

    const nuevoAutorizado = {
        id: Date.now().toString(),
        correo,
        estado: usuarioExistente ? "aceptada" : "pendiente",
        codigo: usuarioExistente ? "-" : generarCodigoInvitacion(),
        nombre: usuarioExistente ? usuarioExistente.nombre || "" : "",
        dni: usuarioExistente ? usuarioExistente.dni || "" : "",
        password: usuarioExistente ? usuarioExistente.clave || "" : "",
        fechaRegistro: new Date().toISOString()
    };

    unidad.autorizados.push(nuevoAutorizado);

    if (usuarioExistente) {
        agregarUnidadAUsuario(usuarioExistente, unidad, "autorizado");
        actualizarUnidadPrincipalSiCorresponde(usuarioExistente, unidad, "autorizado");

        guardarTodo(db);

        return {
            ok: true,
            mensaje: "El correo ya tenía cuenta activa. Usuario autorizado vinculado automáticamente."
        };
    }

    guardarTodo(db);

    return {
        ok: true,
        mensaje: "Invitación de usuario autorizado generada correctamente."
    };
}

function renderizarInvitaciones() {
    const db = obtenerTodo();
    const tabla = document.getElementById("tablaInvitaciones");

    if (!tabla) return;

    const invitaciones = [];
    const departamentos = obtenerDepartamentosPermitidos(db);

    departamentos.forEach(unidad => {
        if (unidad.emailPropietario) {
            invitaciones.push({
                unidadId: unidad.id,
                edificioId: unidad.edificioId,
                unidadNumero: unidad.numero,
                tipoUnidad: unidad.tipo,
                correo: unidad.emailPropietario,
                tipoVinculacion: "propietario",
                estado: unidad.estadoInvitacion || "pendiente",
                codigo: unidad.codigoPropietario || "-"
            });
        }

        if (unidad.emailInquilino) {
            invitaciones.push({
                unidadId: unidad.id,
                edificioId: unidad.edificioId,
                unidadNumero: unidad.numero,
                tipoUnidad: unidad.tipo,
                correo: unidad.emailInquilino,
                tipoVinculacion: "inquilino",
                estado: unidad.estadoInquilino || "pendiente",
                codigo: unidad.codigoInquilino || "-"
            });
        }

        (unidad.autorizados || []).forEach(autorizado => {
            invitaciones.push({
                unidadId: unidad.id,
                edificioId: unidad.edificioId,
                autorizadoId: autorizado.id,
                unidadNumero: unidad.numero,
                tipoUnidad: unidad.tipo,
                correo: autorizado.correo,
                tipoVinculacion: "autorizado",
                estado: autorizado.estado || "pendiente",
                codigo: autorizado.codigo || "-"
            });
        });
    });

    if (invitaciones.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="7">No hay invitaciones registradas.</td>
            </tr>
        `;
        return;
    }

    tabla.innerHTML = invitaciones.map(inv => `
        <tr>
            <td>${inv.correo}</td>
            <td>${inv.unidadNumero}</td>
            <td>${formatearTipoUnidad(inv.tipoUnidad)}</td>
            <td>${formatearTipoVinculacion(inv.tipoVinculacion)}</td>
            <td>
                <span class="badge ${inv.estado === "aceptada" ? "vacio" : "ocupado"}">
                    ${capitalizar(inv.estado)}
                </span>
            </td>
            <td>${inv.codigo}</td>
            <td>
                <button 
                    class="btn btn-red" 
                    onclick="eliminarInvitacion('${inv.unidadId}', '${inv.tipoVinculacion}', '${inv.autorizadoId || ""}', '${inv.correo}')"
                >
                    Eliminar
                </button>
            </td>
        </tr>
    `).join("");
}

function eliminarInvitacion(unidadId, tipoVinculacion, autorizadoId = "", correo = "") {
    const confirmar = confirm("¿Deseas eliminar esta vinculación/invitación?");

    if (!confirmar) return;

    const db = obtenerTodo();

    const unidad = obtenerDepartamentosPermitidos(db).find(u =>
        String(u.id) === String(unidadId)
    );

    if (!unidad) {
        alert("Unidad no encontrada o no pertenece a tu edificio asignado.");
        return;
    }

    if (tipoVinculacion === "propietario") {
        unidad.emailPropietario = null;
        unidad.estadoInvitacion = null;
        unidad.codigoPropietario = null;
        unidad.nombreReal = null;
        unidad.dniPropietario = null;
        unidad.password = null;
    }

    if (tipoVinculacion === "inquilino") {
        unidad.emailInquilino = null;
        unidad.estadoInquilino = null;
        unidad.codigoInquilino = null;
        unidad.nombreInquilino = null;
        unidad.dniInquilino = null;
        unidad.passwordInquilino = null;
    }

    if (tipoVinculacion === "autorizado") {
        unidad.autorizados = (unidad.autorizados || []).filter(a =>
            String(a.id) !== String(autorizadoId)
        );
    }

    const usuario = buscarUsuarioPorCorreo(db, correo);

    if (usuario) {
        usuario.unidadesAutorizadas = (usuario.unidadesAutorizadas || []).filter(u =>
            String(u.unidadId) !== String(unidadId) ||
            String(u.tipoVinculacion) !== String(tipoVinculacion)
        );

        recalcularUnidadPrincipalUsuario(usuario, db);
    }

    guardarTodo(db);

    cargarUnidadesDisponibles();
    renderizarInvitaciones();

    alert("Vinculación eliminada correctamente.");
}

function correoYaExisteEnUnidad(db, correo, unidadId, tipoVinculacion) {
    const unidad = obtenerDepartamentosPermitidos(db).find(u =>
        String(u.id) === String(unidadId)
    );

    if (!unidad) return false;

    const correoNormalizado = String(correo).toLowerCase();

    if (
        tipoVinculacion === "propietario" &&
        String(unidad.emailPropietario || "").toLowerCase() === correoNormalizado
    ) {
        return true;
    }

    if (
        tipoVinculacion === "inquilino" &&
        String(unidad.emailInquilino || "").toLowerCase() === correoNormalizado
    ) {
        return true;
    }

    if (
        tipoVinculacion === "autorizado" &&
        (unidad.autorizados || []).some(a =>
            String(a.correo || "").toLowerCase() === correoNormalizado
        )
    ) {
        return true;
    }

    return false;
}

function buscarUsuarioPorCorreo(db, correo) {
    return (db.usuarios || []).find(u =>
        String(u.correo || "").toLowerCase() === String(correo).toLowerCase()
    );
}

function agregarUnidadAUsuario(usuario, unidad, tipoVinculacion) {
    usuario.unidadesAutorizadas = usuario.unidadesAutorizadas || [];

    const yaExiste = usuario.unidadesAutorizadas.some(item =>
        String(item.unidadId) === String(unidad.id) &&
        String(item.tipoVinculacion) === String(tipoVinculacion)
    );

    if (yaExiste) return;

    usuario.unidadesAutorizadas.push({
        unidadId: unidad.id,
        edificioId: unidad.edificioId,
        unidadNumero: unidad.numero,
        tipoUnidad: normalizarTipoUnidad(unidad.tipo),
        tipoVinculacion
    });

    usuario.edificioIds = usuario.edificioIds || [];

    if (unidad.edificioId && !usuario.edificioIds.map(String).includes(String(unidad.edificioId))) {
        usuario.edificioIds.push(String(unidad.edificioId));
    }

    if (!usuario.edificioId && unidad.edificioId) {
        usuario.edificioId = unidad.edificioId;
    }
}

function actualizarUnidadPrincipalSiCorresponde(usuario, unidad, tipoVinculacion) {
    const tipoUnidad = normalizarTipoUnidad(unidad.tipo);

    if (!usuario.unidadPrincipalId) {
        usuario.unidadPrincipalId = unidad.id;
        usuario.unidadPrincipalNumero = unidad.numero;
        usuario.departamentoId = unidad.id;
        usuario.departamentoNumero = unidad.numero;
        usuario.tipoUnidad = tipoUnidad;
        usuario.tipoResidente = tipoVinculacion;
        usuario.edificioId = unidad.edificioId || usuario.edificioId;
        return;
    }

    const principalActual = (usuario.unidadesAutorizadas || []).find(item =>
        String(item.unidadId) === String(usuario.unidadPrincipalId)
    );

    const debePriorizarDepartamento =
        tipoUnidad === "departamento" &&
        (
            !principalActual ||
            principalActual.tipoUnidad !== "departamento" ||
            tipoVinculacion === "propietario"
        );

    if (debePriorizarDepartamento) {
        usuario.unidadPrincipalId = unidad.id;
        usuario.unidadPrincipalNumero = unidad.numero;
        usuario.departamentoId = unidad.id;
        usuario.departamentoNumero = unidad.numero;
        usuario.tipoUnidad = tipoUnidad;
        usuario.tipoResidente = tipoVinculacion;
        usuario.edificioId = unidad.edificioId || usuario.edificioId;
    }
}

function recalcularUnidadPrincipalUsuario(usuario, db) {
    const unidades = usuario.unidadesAutorizadas || [];

    if (unidades.length === 0) {
        usuario.unidadPrincipalId = null;
        usuario.unidadPrincipalNumero = null;
        usuario.departamentoId = null;
        usuario.departamentoNumero = null;
        usuario.tipoUnidad = null;
        usuario.tipoResidente = null;
        usuario.edificioId = null;
        usuario.edificioIds = [];
        return;
    }

    const propietarioDepartamento = unidades.find(item =>
        item.tipoUnidad === "departamento" &&
        item.tipoVinculacion === "propietario"
    );

    const inquilinoDepartamento = unidades.find(item =>
        item.tipoUnidad === "departamento" &&
        item.tipoVinculacion === "inquilino"
    );

    const departamento = unidades.find(item =>
        item.tipoUnidad === "departamento"
    );

    const principal =
        propietarioDepartamento ||
        inquilinoDepartamento ||
        departamento ||
        unidades[0];

    usuario.unidadPrincipalId = principal.unidadId;
    usuario.unidadPrincipalNumero = principal.unidadNumero;
    usuario.departamentoId = principal.unidadId;
    usuario.departamentoNumero = principal.unidadNumero;
    usuario.tipoUnidad = principal.tipoUnidad;
    usuario.tipoResidente = principal.tipoVinculacion;
    usuario.edificioId = principal.edificioId || null;

    usuario.edificioIds = [...new Set(
        unidades
            .map(item => item.edificioId)
            .filter(Boolean)
            .map(String)
    )];
}

function generarCodigoInvitacion() {
    return "ED-" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

function normalizarTipoUnidad(tipo) {
    const valor = String(tipo || "").toLowerCase().trim();

    if (valor === "estacionamiento") return "estacionamiento";
    if (valor === "deposito" || valor === "depósito") return "deposito";
    if (valor === "oficina" || valor === "local") return "oficina";

    return "departamento";
}

function normalizarEstadoUnidad(estado) {
    const valor = String(estado || "").toLowerCase().trim();

    if (valor === "mantenimiento" || valor === "en mantenimiento") return "mantenimiento";
    if (valor === "inactiva" || valor === "inactivo") return "inactiva";

    return "disponible";
}

function formatearTipoUnidad(tipo) {
    const tipos = {
        departamento: "Departamento",
        estacionamiento: "Estacionamiento",
        deposito: "Depósito",
        oficina: "Oficina / Local"
    };

    return tipos[normalizarTipoUnidad(tipo)] || "Departamento";
}

function formatearTipoVinculacion(tipo) {
    const tipos = {
        propietario: "Propietario",
        inquilino: "Inquilino",
        autorizado: "Usuario autorizado"
    };

    return tipos[tipo] || "Usuario autorizado";
}

function formatearPiso(piso) {
    const valor = String(piso || "");

    if (valor.startsWith("S")) {
        return `Sótano ${valor.replace("S", "")}`;
    }

    return `Piso ${valor}`;
}

function capitalizar(texto) {
    if (!texto) return "";
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}