document.addEventListener("DOMContentLoaded", () => {
    protegerPaginaAdmin();
    cargarDashboard();
    configurarFiltros();
    configurarModal();
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

function cargarDashboard() {
    const db = obtenerTodo();

    cargarTituloEdificio(db);
    cargarFiltroPisos(db);
    actualizarEstadisticas(db);
    renderizarUnidades(db);
}

function cargarTituloEdificio(db) {
    const titulo = document.getElementById("tituloEdificio");

    if (!titulo) return;

    titulo.textContent = db.configEdificio?.nombre || "Dashboard Administrador";
}

function configurarFiltros() {
    const filtros = ["filtroBusqueda", "filtroPiso", "filtroTipo", "filtroEstado"];

    filtros.forEach(id => {
        const elemento = document.getElementById(id);

        if (elemento) {
            elemento.addEventListener("input", () => renderizarUnidades(obtenerTodo()));
            elemento.addEventListener("change", () => renderizarUnidades(obtenerTodo()));
        }
    });
}

function cargarFiltroPisos(db) {
    const filtroPiso = document.getElementById("filtroPiso");

    if (!filtroPiso) return;

    filtroPiso.innerHTML = `<option value="">Todos</option>`;

    const config = db.configEdificio || {};
    const sotanos = Number(config.sotanos || 0);
    const pisos = Number(config.pisos || 0);

    for (let i = 1; i <= sotanos; i++) {
        filtroPiso.innerHTML += `<option value="S${i}">Sótano ${i}</option>`;
    }

    for (let i = 1; i <= pisos; i++) {
        filtroPiso.innerHTML += `<option value="${i}">Piso ${i}</option>`;
    }
}

function actualizarEstadisticas(db) {
    const unidades = db.departamentos || [];

    const total = unidades.length;
    const departamentos = unidades.filter(u => normalizarTipoUnidad(u.tipo) === "departamento").length;
    const estacionamientos = unidades.filter(u => normalizarTipoUnidad(u.tipo) === "estacionamiento").length;
    const depositos = unidades.filter(u => normalizarTipoUnidad(u.tipo) === "deposito").length;
    const oficinas = unidades.filter(u => normalizarTipoUnidad(u.tipo) === "oficina").length;

    const ocupadas = unidades.filter(u => obtenerEstadoRealUnidad(u) === "ocupada").length;
    const disponibles = unidades.filter(u => obtenerEstadoRealUnidad(u) === "disponible").length;
    const mantenimiento = unidades.filter(u => obtenerEstadoRealUnidad(u) === "mantenimiento").length;

    const porcentaje = total > 0 ? Math.round((ocupadas / total) * 100) : 0;

    setText("totalUnidades", total);
    setText("totalDepartamentos", departamentos);
    setText("totalEstacionamientos", estacionamientos);
    setText("totalDepositos", depositos);
    setText("totalOficinas", oficinas);
    setText("unidadesOcupadas", ocupadas);
    setText("unidadesDisponibles", disponibles);
    setText("unidadesMantenimiento", mantenimiento);
    setText("porcentajeOcupacion", `${porcentaje}%`);
}

function renderizarUnidades(db) {
    const tabla = document.getElementById("tablaUnidades");

    if (!tabla) return;

    let unidades = [...(db.departamentos || [])];

    const busqueda = document.getElementById("filtroBusqueda")?.value.trim().toUpperCase() || "";
    const piso = document.getElementById("filtroPiso")?.value || "";
    const tipo = document.getElementById("filtroTipo")?.value || "";
    const estado = document.getElementById("filtroEstado")?.value || "";

    if (busqueda) {
        unidades = unidades.filter(u =>
            String(u.numero || "").toUpperCase().includes(busqueda)
        );
    }

    if (piso) {
        unidades = unidades.filter(u =>
            String(u.piso) === String(piso)
        );
    }

    if (tipo) {
        unidades = unidades.filter(u =>
            normalizarTipoUnidad(u.tipo) === tipo
        );
    }

    if (estado) {
        unidades = unidades.filter(u =>
            obtenerEstadoRealUnidad(u) === estado
        );
    }

    unidades.sort((a, b) => {
        const pisoA = ordenarPiso(a.piso);
        const pisoB = ordenarPiso(b.piso);

        if (pisoA !== pisoB) return pisoA - pisoB;

        return String(a.numero).localeCompare(String(b.numero));
    });

    if (unidades.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="6">No hay unidades registradas con esos filtros.</td>
            </tr>
        `;
        return;
    }

    tabla.innerHTML = unidades.map(unidad => {
        const estadoUnidad = obtenerEstadoRealUnidad(unidad);

        return `
            <tr>
                <td><strong>${unidad.numero}</strong></td>
                <td>${formatearPiso(unidad.piso)}</td>
                <td>${formatearTipoUnidad(unidad.tipo)}</td>
                <td>${obtenerTextoVinculacion(unidad)}</td>
                <td>
                    <span class="badge ${claseEstado(estadoUnidad)}">
                        ${formatearEstadoUnidad(estadoUnidad)}
                    </span>
                </td>
                <td>
                    <button class="btn btn-blue" onclick="verDetalleUnidad('${unidad.id}')">
                        Ver
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

function verDetalleUnidad(id) {
    const db = obtenerTodo();

    const unidad = (db.departamentos || []).find(u =>
        String(u.id) === String(id)
    );

    if (!unidad) {
        alert("Unidad no encontrada.");
        return;
    }

    const detalle = document.getElementById("detalleUnidad");
    const modal = document.getElementById("modalDetalle");

    if (!detalle || !modal) return;

    const autorizados = unidad.autorizados || [];

    detalle.innerHTML = `
        <p><strong>Unidad:</strong> ${unidad.numero}</p>
        <p><strong>Ubicación:</strong> ${formatearPiso(unidad.piso)}</p>
        <p><strong>Tipo:</strong> ${formatearTipoUnidad(unidad.tipo)}</p>
        <p><strong>Estado:</strong> ${formatearEstadoUnidad(obtenerEstadoRealUnidad(unidad))}</p>
        <p><strong>Observaciones:</strong> ${unidad.observaciones || "-"}</p>
        <hr>

        <p><strong>Propietario:</strong> ${unidad.emailPropietario || "Sin propietario"}</p>
        <p><strong>Estado propietario:</strong> ${unidad.estadoInvitacion || "-"}</p>

        <p><strong>Inquilino:</strong> ${unidad.emailInquilino || "Sin inquilino"}</p>
        <p><strong>Estado inquilino:</strong> ${unidad.estadoInquilino || "-"}</p>

        <p><strong>Usuarios autorizados:</strong></p>
        ${
            autorizados.length === 0
                ? `<p>-</p>`
                : `
                    <ul>
                        ${autorizados.map(a => `
                            <li>${a.correo} - ${capitalizar(a.estado || "pendiente")}</li>
                        `).join("")}
                    </ul>
                `
        }
    `;

    modal.style.display = "flex";
}

function configurarModal() {
    const modal = document.getElementById("modalDetalle");
    const cerrar = document.getElementById("cerrarModal");

    if (cerrar && modal) {
        cerrar.addEventListener("click", () => {
            modal.style.display = "none";
        });
    }

    window.addEventListener("click", event => {
        if (event.target === modal) {
            modal.style.display = "none";
        }
    });
}

function obtenerTextoVinculacion(unidad) {
    const partes = [];

    if (unidad.emailPropietario) {
        partes.push(`Propietario: ${unidad.estadoInvitacion || "pendiente"}`);
    }

    if (unidad.emailInquilino) {
        partes.push(`Inquilino: ${unidad.estadoInquilino || "pendiente"}`);
    }

    const autorizados = unidad.autorizados || [];

    if (autorizados.length > 0) {
        const aceptados = autorizados.filter(a => a.estado === "aceptada").length;
        const pendientes = autorizados.filter(a => a.estado !== "aceptada").length;

        partes.push(`Autorizados: ${aceptados} aceptado(s), ${pendientes} pendiente(s)`);
    }

    return partes.length > 0 ? partes.join("<br>") : "Sin vinculación";
}

function obtenerEstadoRealUnidad(unidad) {
    const estadoManual = normalizarEstadoUnidad(unidad.estado);

    if (estadoManual === "mantenimiento" || estadoManual === "inactiva") {
        return estadoManual;
    }

    const propietarioAceptado =
        unidad.emailPropietario && unidad.estadoInvitacion === "aceptada";

    const inquilinoAceptado =
        unidad.emailInquilino && unidad.estadoInquilino === "aceptada";

    const autorizadoAceptado = (unidad.autorizados || []).some(a =>
        a.estado === "aceptada"
    );

    if (propietarioAceptado || inquilinoAceptado || autorizadoAceptado) {
        return "ocupada";
    }

    return "disponible";
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

    if (valor === "ocupada" || valor === "ocupado") return "ocupada";
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

function formatearEstadoUnidad(estado) {
    const estados = {
        disponible: "Disponible",
        ocupada: "Ocupada",
        mantenimiento: "En mantenimiento",
        inactiva: "Inactiva"
    };

    return estados[estado] || "Disponible";
}

function claseEstado(estado) {
    if (estado === "disponible") return "vacio";
    return "ocupado";
}

function formatearPiso(piso) {
    const valor = String(piso || "");

    if (valor.startsWith("S")) {
        return `Sótano ${valor.replace("S", "")}`;
    }

    return `Piso ${valor}`;
}

function ordenarPiso(piso) {
    const valor = String(piso || "");

    if (valor.startsWith("S")) {
        return -Number(valor.replace("S", ""));
    }

    return Number(valor);
}

function capitalizar(texto) {
    if (!texto) return "";

    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function setText(id, valor) {
    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.textContent = valor;
    }
}