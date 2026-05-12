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
        const texto = `${unidad.numero || "Sin número"} - Piso ${unidad.piso || "-"}`;

        selectUnidad.innerHTML += `
            <option value="${unidad.id}">
                ${texto}
            </option>
        `;
    });
}

function configurarFormularioInvitacion() {
    const form = document.getElementById("formInvitacion");

    if (!form) return;

    form.addEventListener("submit", event => {
        event.preventDefault();

        const correo = document.getElementById("correo").value.trim();
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

        if (tipoResidente === "propietario") {
            if (unidad.emailPropietario) {
                alert("Esta unidad ya tiene un propietario vinculado o invitado.");
                return;
            }

            vincularPropietario(unidadId, correo);
        }

        if (tipoResidente === "inquilino") {
            if (unidad.emailInquilino) {
                alert("Esta unidad ya tiene un inquilino vinculado o invitado.");
                return;
            }

            vincularInquilino(unidadId, correo);
        }

        form.reset();
        cargarUnidadesDisponibles();
        renderizarInvitaciones();

        alert("Invitación generada correctamente.");
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
                estado: dep.estadoInvitacion || "pendiente"
            });
        }

        if (dep.emailInquilino) {
            invitaciones.push({
                unidadId: dep.id,
                unidadNumero: dep.numero,
                correo: dep.emailInquilino,
                tipo: "inquilino",
                estado: dep.estadoInquilino || "pendiente"
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
            <td>-</td>
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

    eliminarVinculacion(unidadId, tipo);

    cargarUnidadesDisponibles();
    renderizarInvitaciones();

    alert("Vinculación eliminada correctamente.");
}

function capitalizar(texto) {
    if (!texto) return "";
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}