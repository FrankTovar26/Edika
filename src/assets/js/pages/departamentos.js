document.addEventListener("DOMContentLoaded", () => {
    protegerPaginaAdmin();
    cargarConfiguracionUnidades();
    configurarFormularioDepartamento();
    configurarCambioTipoUnidad();
    configurarFiltros();
    renderizarDepartamentos();
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

function cargarConfiguracionUnidades() {
    const db = obtenerTodo();
    const config = db.configEdificio;

    if (!config || !config.pisos) {
        alert("Primero debes configurar el edificio.");
        window.location.href = "config.html";
        return;
    }

    cargarTiposPermitidos(config);
    cargarPisosPorTipo();
    cargarFiltroPisos(config);
    actualizarAyudaFormato();
}

function cargarTiposPermitidos(config) {
    const selectTipo = document.getElementById("tipoUnidad");
    const filtroTipo = document.getElementById("filtroTipoUnidad");

    const tipos = [
        { value: "departamento", label: "Departamento", permitido: true },
        { value: "estacionamiento", label: "Estacionamiento", permitido: config.tieneEstacionamientos === "si" },
        { value: "deposito", label: "Depósito", permitido: config.tieneDepositos === "si" },
        { value: "oficina", label: "Oficina / Local", permitido: config.tieneOficinas === "si" }
    ];

    if (selectTipo) {
        selectTipo.innerHTML = "";
        tipos.filter(t => t.permitido).forEach(t => {
            selectTipo.innerHTML += `<option value="${t.value}">${t.label}</option>`;
        });
    }

    if (filtroTipo) {
        filtroTipo.innerHTML = `<option value="">Todos</option>`;
        tipos.filter(t => t.permitido).forEach(t => {
            filtroTipo.innerHTML += `<option value="${t.value}">${t.label}</option>`;
        });
    }
}

function configurarCambioTipoUnidad() {
    const tipoUnidad = document.getElementById("tipoUnidad");

    if (!tipoUnidad) return;

    tipoUnidad.addEventListener("change", () => {
        cargarPisosPorTipo();
        actualizarAyudaFormato();
        limpiarCodigoUnidad();
    });
}

function cargarPisosPorTipo() {
    const db = obtenerTodo();
    const config = db.configEdificio;

    const selectPiso = document.getElementById("pisoDepartamento");
    const tipo = document.getElementById("tipoUnidad")?.value || "departamento";

    if (!selectPiso || !config) return;

    selectPiso.innerHTML = `<option value="">Seleccione ubicación...</option>`;

    const ubicaciones = obtenerUbicacionesPermitidasPorTipo(tipo, config);

    ubicaciones.forEach(ubicacion => {
        selectPiso.innerHTML += `
            <option value="${ubicacion.value}">
                ${ubicacion.label}
            </option>
        `;
    });
}

function cargarFiltroPisos(config) {
    const filtroPiso = document.getElementById("filtroPisoUnidad");

    if (!filtroPiso) return;

    filtroPiso.innerHTML = `<option value="">Todos</option>`;

    const ubicaciones = obtenerTodasLasUbicaciones(config);

    ubicaciones.forEach(ubicacion => {
        filtroPiso.innerHTML += `
            <option value="${ubicacion.value}">
                ${ubicacion.label}
            </option>
        `;
    });
}

function obtenerUbicacionesPermitidasPorTipo(tipo, config) {
    const sotanos = Number(config.sotanos || 0);
    const pisos = Number(config.pisos || 0);

    const ubicaciones = [];

    const agregarSotanos = () => {
        for (let i = 1; i <= sotanos; i++) {
            ubicaciones.push({
                value: `S${i}`,
                label: `Sótano ${i}`
            });
        }
    };

    const agregarPisos = () => {
        for (let i = 1; i <= pisos; i++) {
            ubicaciones.push({
                value: String(i),
                label: `Piso ${i}`
            });
        }
    };

    if (tipo === "departamento") {
        agregarPisos();
    }

    if (tipo === "estacionamiento") {
        if (sotanos > 0) {
            agregarSotanos();
        } else {
            agregarPisos();
        }
    }

    if (tipo === "deposito") {
        if (sotanos > 0) {
            agregarSotanos();
        } else {
            agregarPisos();
        }
    }

    if (tipo === "oficina") {
        agregarPisos();
    }

    return ubicaciones;
}

function obtenerTodasLasUbicaciones(config) {
    const ubicaciones = [];
    const sotanos = Number(config.sotanos || 0);
    const pisos = Number(config.pisos || 0);

    for (let i = 1; i <= sotanos; i++) {
        ubicaciones.push({
            value: `S${i}`,
            label: `Sótano ${i}`
        });
    }

    for (let i = 1; i <= pisos; i++) {
        ubicaciones.push({
            value: String(i),
            label: `Piso ${i}`
        });
    }

    return ubicaciones;
}

function configurarFormularioDepartamento() {
    const form = document.getElementById("formDepartamento");
    const btnCancelar = document.getElementById("btnCancelarEdicion");

    if (!form) return;

    form.addEventListener("submit", event => {
        event.preventDefault();

        const id = document.getElementById("departamentoId").value;

        const datos = {
            numero: document.getElementById("numeroDepartamento").value.trim().toUpperCase(),
            piso: document.getElementById("pisoDepartamento").value,
            tipo: document.getElementById("tipoUnidad")?.value || "departamento",
            estado: document.getElementById("estadoUnidad")?.value || "disponible",
            observaciones: document.getElementById("observacionesUnidad")?.value.trim() || ""
        };

        const resultado = id
            ? editarDepartamento(id, datos)
            : agregarDepartamento(datos);

        if (!resultado.ok) {
            alert(resultado.error);
            return;
        }

        limpiarFormularioDepartamento();
        cargarPisosPorTipo();
        renderizarDepartamentos();

        alert(id ? "Unidad actualizada correctamente." : "Unidad registrada correctamente.");
    });

    if (btnCancelar) {
        btnCancelar.addEventListener("click", () => {
            limpiarFormularioDepartamento();
            cargarPisosPorTipo();
        });
    }
}

function configurarFiltros() {
    const filtros = [
        "buscarUnidad",
        "filtroPisoUnidad",
        "filtroTipoUnidad",
        "filtroEstadoUnidad"
    ];

    filtros.forEach(id => {
        const elemento = document.getElementById(id);

        if (elemento) {
            elemento.addEventListener("input", renderizarDepartamentos);
            elemento.addEventListener("change", renderizarDepartamentos);
        }
    });
}

function renderizarDepartamentos() {
    const tbody = document.getElementById("listaDepartamentos");
    const db = obtenerTodo();

    if (!tbody) return;

    let departamentos = [...(db.departamentos || [])];

    const busqueda = document.getElementById("buscarUnidad")?.value.trim().toUpperCase() || "";
    const piso = document.getElementById("filtroPisoUnidad")?.value || "";
    const tipo = document.getElementById("filtroTipoUnidad")?.value || "";
    const estado = document.getElementById("filtroEstadoUnidad")?.value || "";

    if (busqueda) {
        departamentos = departamentos.filter(dep =>
            String(dep.numero || "").toUpperCase().includes(busqueda)
        );
    }

    if (piso) {
        departamentos = departamentos.filter(dep =>
            String(dep.piso) === String(piso)
        );
    }

    if (tipo) {
        departamentos = departamentos.filter(dep =>
            normalizarTipoUnidad(dep.tipo) === tipo
        );
    }

    if (estado) {
        departamentos = departamentos.filter(dep =>
            obtenerEstadoRealUnidad(dep) === estado
        );
    }

    departamentos.sort((a, b) => {
        const pisoA = ordenarPiso(a.piso);
        const pisoB = ordenarPiso(b.piso);

        if (pisoA !== pisoB) return pisoA - pisoB;

        return String(a.numero).localeCompare(String(b.numero));
    });

    actualizarEstadisticas();

    if (departamentos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7">No hay unidades registradas con esos criterios.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = departamentos.map(dep => {
        const estadoUnidad = obtenerEstadoRealUnidad(dep);
        const tipoUnidad = normalizarTipoUnidad(dep.tipo);

        return `
            <tr>
                <td><strong>${dep.numero}</strong></td>
                <td>${formatearPiso(dep.piso)}</td>
                <td>${formatearTipoUnidad(tipoUnidad)}</td>
                <td>
                    <span class="badge ${claseEstado(estadoUnidad)}">
                        ${formatearEstadoUnidad(estadoUnidad)}
                    </span>
                </td>
                <td>${dep.observaciones || "-"}</td>
                <td>${formatearFecha(dep.fechaRegistro)}</td>
                <td>
                    <button class="btn btn-blue" onclick="cargarDepartamentoParaEditar('${dep.id}')">
                        Editar
                    </button>

                    <button class="btn btn-red" onclick="eliminarUnidad('${dep.id}')">
                        Eliminar
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

function actualizarEstadisticas() {
    const db = obtenerTodo();
    const departamentos = db.departamentos || [];

    const disponibles = departamentos.filter(d =>
        obtenerEstadoRealUnidad(d) === "disponible"
    ).length;

    const ocupadas = departamentos.filter(d =>
        obtenerEstadoRealUnidad(d) === "ocupada"
    ).length;

    const mantenimiento = departamentos.filter(d =>
        obtenerEstadoRealUnidad(d) === "mantenimiento"
    ).length;

    const total = document.getElementById("totalUnidades");
    const disp = document.getElementById("unidadesDisponibles");
    const ocup = document.getElementById("unidadesOcupadas");
    const mant = document.getElementById("unidadesMantenimiento");

    if (total) total.textContent = departamentos.length;
    if (disp) disp.textContent = disponibles;
    if (ocup) ocup.textContent = ocupadas;
    if (mant) mant.textContent = mantenimiento;
}

function cargarDepartamentoParaEditar(id) {
    const db = obtenerTodo();

    const departamento = (db.departamentos || []).find(dep =>
        String(dep.id) === String(id)
    );

    if (!departamento) {
        alert("Unidad no encontrada.");
        return;
    }

    document.getElementById("departamentoId").value = departamento.id;
    document.getElementById("tipoUnidad").value = normalizarTipoUnidad(departamento.tipo);

    cargarPisosPorTipo();

    document.getElementById("numeroDepartamento").value = departamento.numero;
    document.getElementById("pisoDepartamento").value = departamento.piso;

    if (document.getElementById("estadoUnidad")) {
        document.getElementById("estadoUnidad").value = normalizarEstadoUnidad(departamento.estado);
    }

    if (document.getElementById("observacionesUnidad")) {
        document.getElementById("observacionesUnidad").value = departamento.observaciones || "";
    }

    actualizarAyudaFormato();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function eliminarUnidad(id) {
    const confirmar = confirm("¿Está seguro de eliminar esta unidad?");

    if (!confirmar) return;

    const resultado = eliminarDepartamento(id);

    if (!resultado.ok) {
        alert(resultado.error);
        return;
    }

    renderizarDepartamentos();

    alert("Unidad eliminada correctamente.");
}

function limpiarFormularioDepartamento() {
    const form = document.getElementById("formDepartamento");
    const departamentoId = document.getElementById("departamentoId");

    if (form) form.reset();
    if (departamentoId) departamentoId.value = "";

    actualizarAyudaFormato();
}

function limpiarCodigoUnidad() {
    const inputCodigo = document.getElementById("numeroDepartamento");

    if (inputCodigo) inputCodigo.value = "";
}

function actualizarAyudaFormato() {
    const ayuda = document.getElementById("ayudaFormatoUnidad");
    const codigo = document.getElementById("numeroDepartamento");
    const tipo = document.getElementById("tipoUnidad")?.value || "departamento";

    if (!ayuda) return;

    const ayudas = {
        departamento: {
            texto: "Formato requerido para departamento: Piso-Letra. Ejemplo: 1-A, 2-B.",
            placeholder: "Ej: 1-A"
        },
        estacionamiento: {
            texto: "Formato requerido para estacionamiento: E-Número. Ejemplo: E-01, E-02.",
            placeholder: "Ej: E-01"
        },
        deposito: {
            texto: "Formato requerido para depósito: D-Número. Ejemplo: D-01, D-02.",
            placeholder: "Ej: D-01"
        },
        oficina: {
            texto: "Formato requerido para oficina/local: OF-Número. Ejemplo: OF-101, OF-201.",
            placeholder: "Ej: OF-101"
        }
    };

    ayuda.textContent = ayudas[tipo]?.texto || ayudas.departamento.texto;

    if (codigo) {
        codigo.placeholder = ayudas[tipo]?.placeholder || "Ej: 1-A";
    }
}

function obtenerEstadoRealUnidad(dep) {
    const estadoManual = normalizarEstadoUnidad(dep.estado);

    if (estadoManual === "mantenimiento" || estadoManual === "inactiva") {
        return estadoManual;
    }

    const tienePropietarioAceptado =
        dep.emailPropietario && dep.estadoInvitacion === "aceptada";

    const tieneInquilinoAceptado =
        dep.emailInquilino && dep.estadoInquilino === "aceptada";

    if (tienePropietarioAceptado || tieneInquilinoAceptado || dep.residente) {
        return "ocupada";
    }

    return "disponible";
}

function normalizarEstadoUnidad(estado) {
    if (!estado) return "disponible";

    const valor = String(estado).toLowerCase().trim();

    if (valor === "ocupado") return "ocupada";
    if (valor === "ocupada") return "ocupada";
    if (valor === "mantenimiento") return "mantenimiento";
    if (valor === "en mantenimiento") return "mantenimiento";
    if (valor === "inactiva") return "inactiva";
    if (valor === "inactivo") return "inactiva";

    return "disponible";
}

function normalizarTipoUnidad(tipo) {
    if (!tipo) return "departamento";

    const valor = String(tipo).toLowerCase().trim();

    if (valor === "estacionamiento") return "estacionamiento";
    if (valor === "deposito" || valor === "depósito") return "deposito";
    if (valor === "oficina" || valor === "local") return "oficina";

    return "departamento";
}

function claseEstado(estado) {
    if (estado === "disponible") return "vacio";
    if (estado === "ocupada") return "ocupado";
    if (estado === "mantenimiento") return "ocupado";
    if (estado === "inactiva") return "ocupado";

    return "vacio";
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

function formatearTipoUnidad(tipo) {
    const tipos = {
        departamento: "Departamento",
        estacionamiento: "Estacionamiento",
        deposito: "Depósito",
        oficina: "Oficina / Local"
    };

    return tipos[tipo] || "Departamento";
}

function formatearPiso(piso) {
    const valor = String(piso);

    if (valor.startsWith("S")) {
        return `Sótano ${valor.replace("S", "")}`;
    }

    return `Piso ${valor}`;
}

function ordenarPiso(piso) {
    const valor = String(piso);

    if (valor.startsWith("S")) {
        return -Number(valor.replace("S", ""));
    }

    return Number(valor);
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