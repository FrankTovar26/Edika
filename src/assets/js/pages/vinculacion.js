document.addEventListener("DOMContentLoaded", () => {
    protegerPaginaAdmin();
    cargarUnidadesDisponibles();
    renderizarInvitaciones();
    configurarFormularioInvitacion();
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

function cargarUnidadesDisponibles() {
    const db = obtenerTodo();
    const selectUnidad = document.getElementById("unidad");

    if (!selectUnidad) return;

    const unidades = db.departamentos || [];

    selectUnidad.innerHTML = `<option value="">Seleccione una unidad</option>`;

    unidades.forEach(unidad => {
        const propietario = unidad.emailPropietario ? "Propietario asignado" : "Sin propietario";
        const inquilino = unidad.emailInquilino ? "Inquilino asignado" : "Sin inquilino";

        selectUnidad.innerHTML += `
            <option value="${unidad.id}">
                ${unidad.numero || "Sin número"} - Piso ${unidad.piso || "-"} (${propietario}, ${inquilino})
            </option>
        `;
    });
}

function configurarFormularioInvitacion() {
    const form = document.getElementById("formInvitacion");

    if (!form) return;

    form.addEventListener("submit", event => {
        event.preventDefault();

        const correo = document.getElementById("correo").value.trim().toLowerCase();
        const unidadId = document.getElementById("unidad").value;
        const tipoResidente = document.getElementById("tipoResidente").value;

        if (!correo || !unidadId || !tipoResidente) {
            alert("Completa todos los campos.");
            return;
        }

        const db = obtenerTodo();

        const unidad = (db.departamentos || []).find(dep =>
            String(dep.id) === String(unidadId)
        );

        if (!unidad) {
            alert("La unidad seleccionada no existe.");
            return;
        }

        const correoUsado = correoYaExisteEnOtraVinculacion(db, correo, unidadId, tipoResidente);

        if (correoUsado) {
            alert("Este correo ya está vinculado o invitado en otra unidad.");
            return;
        }

        let resultado;

        if (tipoResidente === "propietario") {
            if (unidad.emailPropietario) {
                alert("Esta unidad ya tiene propietario vinculado o invitado. Elimina la vinculación actual para reemplazarlo.");
                return;
            }

            resultado = vincularPropietario(unidadId, correo);
        }

        if (tipoResidente === "inquilino") {
            if (unidad.emailInquilino) {
                alert("Esta unidad ya tiene inquilino vinculado o invitado. Elimina la vinculación actual para reemplazarlo.");
                return;
            }

            resultado = vincularInquilino(unidadId, correo);
        }

        if (resultado && resultado.ok === false) {
            alert(resultado.error);
            return;
        }

        form.reset();
        cargarUnidadesDisponibles();
        renderizarInvitaciones();

        alert("Invitación generada correctamente.");
    });
}

function correoYaExisteEnOtraVinculacion(db, correo, unidadId, tipoResidente) {
    return (db.departamentos || []).some(dep => {
        const mismoRegistro =
            String(dep.id) === String(unidadId) &&
            (
                tipoResidente === "propietario"
                    ? String(dep.emailPropietario || "").toLowerCase() === correo
                    : String(dep.emailInquilino || "").toLowerCase() === correo
            );

        if (mismoRegistro) return false;

        return (
            String(dep.emailPropietario || "").toLowerCase() === correo ||
            String(dep.emailInquilino || "").toLowerCase() === correo
        );
    });
}

function renderizarInvitaciones() {
    const db = obtenerTodo();
    const tabla = document.getElementById("tablaInvitaciones");

    if (!tabla) return;

    const departamentos = db.departamentos || [];
    const invitaciones = [];

    departamentos.forEach(dep => {
        if (dep.emailPropietario) {
            invitaciones.push({
                unidadId: dep.id,
                unidadNumero: dep.numero,
                correo: dep.emailPropietario,
                tipo: "propietario",
                estado: dep.estadoInvitacion || "pendiente",
                codigo: dep.codigoPropietario || "-"
            });
        }

        if (dep.emailInquilino) {
            invitaciones.push({
                unidadId: dep.id,
                unidadNumero: dep.numero,
                correo: dep.emailInquilino,
                tipo: "inquilino",
                estado: dep.estadoInquilino || "pendiente",
                codigo: dep.codigoInquilino || "-"
            });
        }
    });

    if (invitaciones.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="6">No hay invitaciones registradas.</td>
            </tr>
        `;
        return;
    }

    tabla.innerHTML = invitaciones.map(inv => `
        <tr>
            <td>${inv.correo}</td>
            <td>${inv.unidadNumero || inv.unidadId}</td>
            <td>${capitalizar(inv.tipo)}</td>
            <td>
                <span class="badge ${inv.estado === "aceptada" ? "vacio" : "ocupado"}">
                    ${capitalizar(inv.estado)}
                </span>
            </td>
            <td>${inv.codigo}</td>
            <td>
                <button class="btn btn-red" onclick="eliminarInvitacion('${inv.unidadId}', '${inv.tipo}')">
                    Eliminar
                </button>
            </td>
        </tr>
    `).join("");
}

function eliminarInvitacion(unidadId, tipo) {
    const confirmar = confirm("¿Deseas eliminar esta vinculación/invitación?");

    if (!confirmar) return;

    const resultado = eliminarVinculacion(unidadId, tipo);

    if (resultado && resultado.ok === false) {
        alert(resultado.error);
        return;
    }

    cargarUnidadesDisponibles();
    renderizarInvitaciones();

    alert("Vinculación eliminada correctamente.");
}

function capitalizar(texto) {
    if (!texto) return "";
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}