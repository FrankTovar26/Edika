document.addEventListener("DOMContentLoaded", () => {
    protegerPaginaAdmin();

    asegurarFiltroEdificioDashboard();
    asegurarColumnaEdificioTabla();

    if (requierePrimeraConfiguracion()) {
        cargarDashboardVacio();
        configurarFiltros();
        configurarBotonLimpiarFiltros();
        configurarModal();
        mostrarModalPrimeraConfiguracion();
        return;
    }

    cargarDashboard();
    configurarFiltros();
    configurarBotonLimpiarFiltros();
    configurarModal();
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

function requierePrimeraConfiguracion() {
    const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));
    const db = obtenerTodo();

    if (!sesion) return false;

    if (sesion.rol !== "admin" && sesion.rol !== "superadmin") {
        return false;
    }

    const edificios = db.edificios || [];

    if (edificios.length === 0) {
        return true;
    }

    if (sesion.rol === "superadmin") {
        return false;
    }

    const edificiosAsignados = obtenerIdsEdificiosAsignadosSesion(sesion);

    if (edificiosAsignados.length === 0) {
        return true;
    }

    const existeEdificioAsignado = edificios.some(edificio =>
        edificiosAsignados.includes(String(edificio.id))
    );

    return !existeEdificioAsignado;
}

function mostrarModalPrimeraConfiguracion() {
    const modal = document.getElementById("modalPrimeraConfiguracion");
    const btnIr = document.getElementById("btnIrPrimeraConfig");
    const btnCancelar = document.getElementById("btnCancelarPrimeraConfig");

    if (!modal) {
        const confirmar = confirm(
            "Aún no tienes edificios configurados o asignados. ¿Deseas realizar la primera configuración?"
        );

        if (confirmar) {
            window.location.href = "config.html";
        }

        return;
    }

    modal.style.display = "flex";

    if (btnIr) {
        btnIr.onclick = () => {
            window.location.href = "config.html";
        };
    }

    if (btnCancelar) {
        btnCancelar.onclick = () => {
            modal.style.display = "none";
        };
    }
}

function cargarDashboardVacio() {
    setText("tituloEdificio", "Dashboard Administrador");

    setText("totalUnidades", 0);
    setText("totalDepartamentos", 0);
    setText("totalEstacionamientos", 0);
    setText("totalDepositos", 0);
    setText("totalOficinas", 0);
    setText("unidadesOcupadas", 0);
    setText("unidadesDisponibles", 0);
    setText("unidadesMantenimiento", 0);
    setText("porcentajeOcupacion", "0%");

    const resumen = document.getElementById("resumenEdificios");
    if (resumen) {
        resumen.innerHTML = `
            <p class="empty-text">
                No hay edificios configurados o asignados.
            </p>
        `;
    }

    const filtroPiso = document.getElementById("filtroPiso");
    if (filtroPiso) {
        filtroPiso.innerHTML = `<option value="">Todos</option>`;
    }

    const filtroEdificio = document.getElementById("filtroEdificio");
    if (filtroEdificio) {
        filtroEdificio.innerHTML = `<option value="">Todos los edificios</option>`;
    }

    const tabla = document.getElementById("tablaUnidades");
    if (tabla) {
        tabla.innerHTML = `
            <tr>
                <td colspan="7">
                    No hay edificios configurados o asignados. Realiza la primera configuración para comenzar.
                </td>
            </tr>
        `;
    }
}

function cargarDashboard() {
    const db = obtenerTodo();

    cargarTituloEdificio(db);
    cargarFiltroEdificios(db);
    cargarFiltroPisos(db);
    actualizarEstadisticas(db);
    renderizarResumenEdificios(db);
    renderizarUnidades(db);
}

function asegurarFiltroEdificioDashboard() {
    if (document.getElementById("filtroEdificio")) return;

    const contenedor = document.querySelector(".form-group-container");

    if (!contenedor) return;

    const grupo = document.createElement("div");
    grupo.className = "group";

    grupo.innerHTML = `
        <label for="filtroEdificio">Edificio</label>
        <select id="filtroEdificio">
            <option value="">Todos los edificios</option>
        </select>
    `;

    contenedor.prepend(grupo);
}

function asegurarColumnaEdificioTabla() {
    const tabla = document.querySelector("table");
    const theadRow = tabla?.querySelector("thead tr");

    if (!theadRow) return;

    const yaExiste = Array.from(theadRow.children).some(th =>
        th.textContent.trim().toLowerCase() === "edificio"
    );

    if (yaExiste) return;

    const th = document.createElement("th");
    th.textContent = "Edificio";

    theadRow.insertBefore(th, theadRow.firstElementChild);
}

function obtenerIdsEdificiosAsignadosSesion(sesion) {
    if (!sesion) return [];

    if (Array.isArray(sesion.edificioIds) && sesion.edificioIds.length > 0) {
        return sesion.edificioIds.filter(Boolean).map(String);
    }

    if (sesion.edificioId) {
        return [String(sesion.edificioId)];
    }

    return [];
}

function obtenerEdificiosPermitidosDashboard(db = obtenerTodo()) {
    const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));

    if (!sesion) return [];

    const edificios = db.edificios || [];

    if (sesion.rol === "superadmin") {
        return edificios
            .filter(edificio => edificio.activo !== false)
            .map(edificio => String(edificio.id));
    }

    if (sesion.rol === "admin") {
        const asignados = obtenerIdsEdificiosAsignadosSesion(sesion);

        return edificios
            .filter(edificio =>
                edificio.activo !== false &&
                asignados.includes(String(edificio.id))
            )
            .map(edificio => String(edificio.id));
    }

    return [];
}

function obtenerEdificiosVisiblesDashboard(db = obtenerTodo()) {
    const permitidos = obtenerEdificiosPermitidosDashboard(db);

    return (db.edificios || []).filter(edificio =>
        permitidos.includes(String(edificio.id))
    );
}

function cargarFiltroEdificios(db) {
    const select = document.getElementById("filtroEdificio");

    if (!select) return;

    const valorActual = localStorage.getItem("edifika_dashboard_filtro_edificio") || select.value || "";
    const edificios = obtenerEdificiosVisiblesDashboard(db);

    select.innerHTML = `<option value="">Todos los edificios</option>`;

    edificios.forEach(edificio => {
        select.innerHTML += `
            <option value="${edificio.id}">
                ${edificio.nombre}
            </option>
        `;
    });

    const existeValorActual = edificios.some(edificio =>
        String(edificio.id) === String(valorActual)
    );

    select.value = existeValorActual ? valorActual : "";
}

function obtenerUnidadesPermitidasDashboard(db) {
    const permitidos = obtenerEdificiosPermitidosDashboard(db);

    if (permitidos.length === 0) {
        return [];
    }

    const unidadesBase = [];

    const departamentos = db.departamentos || [];
    departamentos.forEach(unidad => {
        unidadesBase.push(normalizarUnidadDashboard(unidad));
    });

    const unidadesGeneradas = db.unidadesGeneradas || [];
    unidadesGeneradas.forEach(unidad => {
        unidadesBase.push(normalizarUnidadDashboard(unidad));
    });

    const mapa = new Map();

    unidadesBase.forEach(unidad => {
        if (!unidad.edificioId) return;

        const clave = `${unidad.edificioId}_${unidad.numero}_${unidad.tipo}`;

        if (!mapa.has(clave)) {
            mapa.set(clave, unidad);
        } else {
            const existente = mapa.get(clave);

            mapa.set(clave, {
                ...unidad,
                ...existente,
                id: existente.id || unidad.id,
                numero: existente.numero || unidad.numero,
                codigo: existente.codigo || unidad.codigo,
                edificioId: existente.edificioId || unidad.edificioId
            });
        }
    });

    return Array.from(mapa.values()).filter(unidad =>
        permitidos.includes(String(unidad.edificioId))
    );
}

function normalizarUnidadDashboard(unidad) {
    const numero = unidad.numero || unidad.codigo || unidad.nombre || "-";
    const tipo = normalizarTipoUnidad(unidad.tipo);

    return {
        ...unidad,
        id: unidad.id || `${unidad.edificioId || "sin-edificio"}_${numero}_${tipo}`,
        numero,
        codigo: unidad.codigo || numero,
        tipo,
        piso: unidad.piso || unidad.ubicacion || "",
        edificioId: unidad.edificioId || "",
        estado: unidad.estado || "disponible",
        autorizados: unidad.autorizados || []
    };
}

function obtenerUnidadesFiltradasDashboard(db) {
    let unidades = [...obtenerUnidadesPermitidasDashboard(db)];

    const filtroEdificio = document.getElementById("filtroEdificio")?.value || "";
    const busqueda = document.getElementById("filtroBusqueda")?.value.trim().toUpperCase() || "";
    const piso = document.getElementById("filtroPiso")?.value || "";
    const tipo = document.getElementById("filtroTipo")?.value || "";
    const estado = document.getElementById("filtroEstado")?.value || "";

    if (filtroEdificio) {
        unidades = unidades.filter(u =>
            String(u.edificioId) === String(filtroEdificio)
        );
    }

    if (busqueda) {
        unidades = unidades.filter(u => {
            const edificio = obtenerNombreEdificio(db, u.edificioId).toUpperCase();

            return (
                String(u.numero || "").toUpperCase().includes(busqueda) ||
                String(u.codigo || "").toUpperCase().includes(busqueda) ||
                edificio.includes(busqueda)
            );
        });
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

    return unidades;
}

function cargarTituloEdificio(db) {
    const titulo = document.getElementById("tituloEdificio");

    if (!titulo) return;

    const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));
    const edificios = obtenerEdificiosVisiblesDashboard(db);
    const filtroEdificio = document.getElementById("filtroEdificio")?.value || "";

    if (filtroEdificio) {
        const edificio = edificios.find(e => String(e.id) === String(filtroEdificio));
        titulo.textContent = edificio
            ? `Dashboard - ${edificio.nombre}`
            : "Dashboard Administrador";
        return;
    }

    if (sesion?.rol === "superadmin") {
        titulo.textContent = edificios.length > 0
            ? `Dashboard General - Superadministrador (${edificios.length} edificios activos)`
            : "Dashboard General - Superadministrador";
        return;
    }

    titulo.textContent = edificios.length > 0
        ? `Dashboard - ${edificios.map(e => e.nombre).join(", ")}`
        : "Dashboard Administrador";
}

function configurarFiltros() {
    const filtros = ["filtroEdificio", "filtroBusqueda", "filtroPiso", "filtroTipo", "filtroEstado"];

    filtros.forEach(id => {
        const elemento = document.getElementById(id);

        if (elemento) {
            elemento.addEventListener("input", actualizarDashboardPorFiltros);
            elemento.addEventListener("change", actualizarDashboardPorFiltros);
        }
    });
}

function actualizarDashboardPorFiltros(event) {
    const id = event?.target?.id || "";
    const db = obtenerTodo();

    if (id === "filtroEdificio") {
        localStorage.setItem(
            "edifika_dashboard_filtro_edificio",
            event.target.value
        );

        cargarFiltroPisos(db);
        cargarTituloEdificio(db);
    }

    actualizarEstadisticas(db);
    renderizarResumenEdificios(db);
    renderizarUnidades(db);
}

function configurarBotonLimpiarFiltros() {
    const boton = document.getElementById("btnLimpiarFiltros");

    if (!boton) return;

    boton.addEventListener("click", () => {
        localStorage.removeItem("edifika_dashboard_filtro_edificio");

        const filtroEdificio = document.getElementById("filtroEdificio");
        const filtroBusqueda = document.getElementById("filtroBusqueda");
        const filtroPiso = document.getElementById("filtroPiso");
        const filtroTipo = document.getElementById("filtroTipo");
        const filtroEstado = document.getElementById("filtroEstado");

        if (filtroEdificio) filtroEdificio.value = "";
        if (filtroBusqueda) filtroBusqueda.value = "";
        if (filtroPiso) filtroPiso.value = "";
        if (filtroTipo) filtroTipo.value = "";
        if (filtroEstado) filtroEstado.value = "";

        const db = obtenerTodo();

        cargarFiltroPisos(db);
        cargarTituloEdificio(db);
        actualizarEstadisticas(db);
        renderizarResumenEdificios(db);
        renderizarUnidades(db);
    });
}

function cargarFiltroPisos(db) {
    const filtroPiso = document.getElementById("filtroPiso");

    if (!filtroPiso) return;

    const valorActual = filtroPiso.value;
    const unidades = obtenerUnidadesFiltradasSoloEdificio(db);

    const ubicaciones = [...new Set(
        unidades
            .map(unidad => String(unidad.piso || ""))
            .filter(Boolean)
    )].sort((a, b) => ordenarPiso(a) - ordenarPiso(b));

    filtroPiso.innerHTML = `<option value="">Todos</option>`;

    ubicaciones.forEach(piso => {
        filtroPiso.innerHTML += `
            <option value="${piso}">
                ${formatearPiso(piso)}
            </option>
        `;
    });

    if (ubicaciones.includes(String(valorActual))) {
        filtroPiso.value = valorActual;
    }
}

function obtenerUnidadesFiltradasSoloEdificio(db) {
    let unidades = [...obtenerUnidadesPermitidasDashboard(db)];

    const filtroEdificio = document.getElementById("filtroEdificio")?.value || "";

    if (filtroEdificio) {
        unidades = unidades.filter(u =>
            String(u.edificioId) === String(filtroEdificio)
        );
    }

    return unidades;
}

function actualizarEstadisticas(db) {
    const unidades = obtenerUnidadesFiltradasDashboard(db);

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

function renderizarResumenEdificios(db) {
    const contenedor = document.getElementById("resumenEdificios");

    if (!contenedor) return;

    let edificios = obtenerEdificiosVisiblesDashboard(db);
    const filtroEdificio = document.getElementById("filtroEdificio")?.value || "";

    if (filtroEdificio) {
        edificios = edificios.filter(edificio =>
            String(edificio.id) === String(filtroEdificio)
        );
    }

    if (edificios.length === 0) {
        contenedor.innerHTML = `
            <p class="empty-text">
                No hay edificios activos para mostrar.
            </p>
        `;
        return;
    }

    contenedor.innerHTML = edificios.map(edificio => {
        const unidades = obtenerUnidadesPermitidasDashboard(db).filter(u =>
            String(u.edificioId) === String(edificio.id)
        );

        const total = unidades.length;
        const departamentos = unidades.filter(u => normalizarTipoUnidad(u.tipo) === "departamento").length;
        const estacionamientos = unidades.filter(u => normalizarTipoUnidad(u.tipo) === "estacionamiento").length;
        const depositos = unidades.filter(u => normalizarTipoUnidad(u.tipo) === "deposito").length;
        const oficinas = unidades.filter(u => normalizarTipoUnidad(u.tipo) === "oficina").length;

        const ocupadas = unidades.filter(u => obtenerEstadoRealUnidad(u) === "ocupada").length;
        const disponibles = unidades.filter(u => obtenerEstadoRealUnidad(u) === "disponible").length;
        const mantenimiento = unidades.filter(u => obtenerEstadoRealUnidad(u) === "mantenimiento").length;

        const porcentaje = total > 0 ? Math.round((ocupadas / total) * 100) : 0;

        return `
            <div class="resumen-edificio-card">
                <div class="resumen-edificio-header">
                    <h3>${edificio.nombre}</h3>
                    <span class="badge ${edificio.activo !== false ? "vacio" : "inactivo"}">
                        ${edificio.activo !== false ? "Activo" : "Inactivo"}
                    </span>
                </div>

                <div class="resumen-edificio-metrics">
                    <span><strong>${total}</strong><br>Total</span>
                    <span><strong>${departamentos}</strong><br>Departamentos</span>
                    <span><strong>${estacionamientos}</strong><br>Estacionamientos</span>
                    <span><strong>${depositos}</strong><br>Depósitos</span>
                    <span><strong>${oficinas}</strong><br>Oficinas</span>
                    <span><strong>${ocupadas}</strong><br>Ocupadas</span>
                    <span><strong>${disponibles}</strong><br>Disponibles</span>
                    <span><strong>${mantenimiento}</strong><br>Mantenimiento</span>
                    <span><strong>${porcentaje}%</strong><br>Ocupación</span>
                </div>
            </div>
        `;
    }).join("");
}

function renderizarUnidades(db) {
    const tabla = document.getElementById("tablaUnidades");

    if (!tabla) return;

    let unidades = obtenerUnidadesFiltradasDashboard(db);

    unidades.sort((a, b) => {
        const edificioA = obtenerNombreEdificio(db, a.edificioId);
        const edificioB = obtenerNombreEdificio(db, b.edificioId);

        const comparacionEdificio = edificioA.localeCompare(edificioB);
        if (comparacionEdificio !== 0) return comparacionEdificio;

        const pisoA = ordenarPiso(a.piso);
        const pisoB = ordenarPiso(b.piso);

        if (pisoA !== pisoB) return pisoA - pisoB;

        return String(a.numero).localeCompare(String(b.numero));
    });

    if (unidades.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="7">No hay unidades registradas con esos filtros.</td>
            </tr>
        `;
        return;
    }

    tabla.innerHTML = unidades.map(unidad => {
        const estadoUnidad = obtenerEstadoRealUnidad(unidad);
        const edificio = obtenerNombreEdificio(db, unidad.edificioId);

        return `
            <tr>
                <td>${edificio}</td>
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

    const unidad = obtenerUnidadesPermitidasDashboard(db).find(u =>
        String(u.id) === String(id)
    );

    if (!unidad) {
        alert("Unidad no encontrada o no pertenece a tus edificios asignados.");
        return;
    }

    const detalle = document.getElementById("detalleUnidad");
    const modal = document.getElementById("modalDetalle");

    if (!detalle || !modal) return;

    const autorizados = unidad.autorizados || [];
    const edificio = (db.edificios || []).find(e =>
        String(e.id) === String(unidad.edificioId)
    );

    detalle.innerHTML = `
        <p><strong>Edificio:</strong> ${edificio ? edificio.nombre : "-"}</p>
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

function obtenerNombreEdificio(db, edificioId) {
    const edificio = (db.edificios || []).find(e =>
        String(e.id) === String(edificioId)
    );

    return edificio ? edificio.nombre : "-";
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
    if (estado === "mantenimiento") return "pendiente";
    if (estado === "inactiva") return "inactivo";

    return "ocupado";
}

function formatearPiso(piso) {
    const valor = String(piso || "");

    if (!valor) return "-";

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

    return Number(valor) || 0;
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

/* =========================================================
   DASHBOARD FINANCIERO
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        cargarDashboardFinanciero();
        cargarDashboardAlertas();
    }, 100);
});

function cargarDashboardFinanciero() {

    const db = obtenerTodo();

    const cuotas = db.cuotas || [];
    const pagos = db.pagos || [];
    const incidencias = db.incidencias || [];
    const reservas = db.reservas || [];

    let totalCobrado = 0;
    let totalMorosidad = 0;
    let totalFacturacion = 0;

    let cuotasVencidas = 0;

    cuotas.forEach(cuota => {

        const monto = Number(cuota.monto || 0);

        totalFacturacion += monto;

        const estado = String(cuota.estado || "").toLowerCase();

        if (estado === "pagado") {
            totalCobrado += monto;
        }

        if (estado === "vencido") {
            totalMorosidad += monto;
            cuotasVencidas++;
        }

    });

    const porcentajeCobranza =
        totalFacturacion > 0
            ? Math.round((totalCobrado / totalFacturacion) * 100)
            : 0;

    const incidenciasAbiertas = incidencias.filter(item => {
        return ["abierto", "en proceso"]
            .includes(String(item.estado || "").toLowerCase());
    }).length;

    const reservasActivas = reservas.filter(item => {
        return ["aprobado", "pendiente"]
            .includes(String(item.estado || "").toLowerCase());
    }).length;

    const pagosRegistrados = pagos.length;

    setText("totalCobradoDashboard", `S/ ${formatearMonto(totalCobrado)}`);
    setText("totalMorosidadDashboard", `S/ ${formatearMonto(totalMorosidad)}`);

    setText("reservasPendientesDashboard", reservasActivas);
    setText("incidenciasAbiertasDashboard", incidenciasAbiertas);

    setText("facturacionMensualDashboard", `S/ ${formatearMonto(totalFacturacion)}`);
    setText("pagosRegistradosDashboard", pagosRegistrados);

    setText("cuotasVencidasDashboard", cuotasVencidas);

    setText(
        "porcentajeCobranzaDashboard",
        `${porcentajeCobranza}%`
    );

}

/* =========================================================
   ALERTAS DASHBOARD
========================================================= */

function cargarDashboardAlertas() {

    const db = obtenerTodo();

    const cuotas = db.cuotas || [];
    const incidencias = db.incidencias || [];
    const reservas = db.reservas || [];

    const contenedor = document.getElementById("dashboardAlertas");

    if (!contenedor) return;

    const alertas = [];

    /* =========================
       MOROSIDAD
    ========================= */

    const cuotasVencidas = cuotas.filter(c =>
        String(c.estado || "").toLowerCase() === "vencido"
    );

    if (cuotasVencidas.length > 0) {

        const total = cuotasVencidas.reduce((sum, item) => {
            return sum + Number(item.monto || 0);
        }, 0);

        alertas.push(`
            <div class="alert-card alert-danger">
                <strong>Morosidad detectada</strong>
                <p>
                    Existen ${cuotasVencidas.length} cuota(s) vencida(s)
                    por un total de S/ ${formatearMonto(total)}.
                </p>
            </div>
        `);

    }

    /* =========================
       INCIDENCIAS
    ========================= */

    const incidenciasAbiertas = incidencias.filter(i =>
        ["abierto", "en proceso"]
            .includes(String(i.estado || "").toLowerCase())
    );

    if (incidenciasAbiertas.length > 0) {

        alertas.push(`
            <div class="alert-card alert-warning">
                <strong>Incidencias pendientes</strong>
                <p>
                    Hay ${incidenciasAbiertas.length}
                    incidencia(s) aún sin resolver.
                </p>
            </div>
        `);

    }

    /* =========================
       MANTENIMIENTOS
    ========================= */

    const reservasMantenimiento = reservas.filter(r =>
        String(r.estado || "").toLowerCase() === "mantenimiento"
    );

    if (reservasMantenimiento.length > 0) {

        alertas.push(`
            <div class="alert-card alert-info">
                <strong>Áreas en mantenimiento</strong>
                <p>
                    Existen ${reservasMantenimiento.length}
                    reserva(s) bloqueadas por mantenimiento.
                </p>
            </div>
        `);

    }

    /* =========================
       SIN ALERTAS
    ========================= */

    if (alertas.length === 0) {

        contenedor.innerHTML = `
            <div class="alert-card alert-success">
                <strong>Todo en orden</strong>
                <p>
                    No existen alertas importantes actualmente.
                </p>
            </div>
        `;

        return;
    }

    contenedor.innerHTML = alertas.join("");

}

/* =========================================================
   HELPERS
========================================================= */

function formatearMonto(valor) {

    const numero = Number(valor || 0);

    return numero.toLocaleString("es-PE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

}