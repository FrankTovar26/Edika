document.addEventListener("DOMContentLoaded", () => {
    protegerPaginaAdmin();
    cargarConfiguracionUnidades();
    configurarFormularioDepartamento();
    configurarCambioTipoUnidad();
    configurarCambioPisoUnidad();
    configurarCambioUnidadGenerada();
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

    db.unidadesGeneradas = db.unidadesGeneradas || [];
    db.departamentos = db.departamentos || [];

    if (!db.configEdificio || !db.configEdificio.pisos) {
        alert("Primero debes configurar el edificio.");
        window.location.href = "config.html";
        return;
    }

    if (db.unidadesGeneradas.length === 0) {
        alert("Primero debes generar la nomenclatura de unidades en Configuración.");
        window.location.href = "config.html";
        return;
    }

    sincronizarUnidadesGeneradasConDepartamentos();

    cargarTiposPermitidos();
    cargarPisosPorTipo();
    cargarUnidadesGeneradasSelect();
    cargarFiltroPisos();
    cargarFiltroTipos();
    actualizarAyudaFormato();
}

function sincronizarUnidadesGeneradasConDepartamentos() {
    const db = obtenerTodo();

    db.unidadesGeneradas = db.unidadesGeneradas || [];
    db.departamentos = db.departamentos || [];

    db.unidadesGeneradas.forEach(unidad => {
        const yaExiste = db.departamentos.some(dep =>
            String(dep.numero) === String(unidad.codigo)
        );

        if (!yaExiste) {
            db.departamentos.push({
                id: Date.now().toString() + Math.random().toString(36).substring(2, 8),
                numero: unidad.codigo,
                piso: unidad.piso,
                tipo: unidad.tipo,
                estado: unidad.estado || "disponible",
                observaciones: "",
                fechaRegistro: new Date().toISOString(),
                origen: "configuracion"
            });
        }
    });

    guardarTodo(db);
}

function cargarTiposPermitidos() {
    const db = obtenerTodo();
    const unidades = db.unidadesGeneradas || [];

    const selectTipo = document.getElementById("tipoUnidad");
    const tiposUnicos = [...new Set(unidades.map(u => normalizarTipoUnidad(u.tipo)))];

    const ordenTipos = [
        { value: "departamento", label: "Departamento" },
        { value: "oficina", label: "Oficina / Local" },
        { value: "estacionamiento", label: "Estacionamiento" },
        { value: "deposito", label: "Depósito" }
    ];

    if (!selectTipo) return;

    selectTipo.innerHTML = `<option value="">Seleccione tipo...</option>`;

    ordenTipos
        .filter(tipo => tiposUnicos.includes(tipo.value))
        .forEach(tipo => {
            selectTipo.innerHTML += `
                <option value="${tipo.value}">
                    ${tipo.label}
                </option>
            `;
        });
}

function cargarFiltroTipos() {
    const db = obtenerTodo();
    const unidades = db.unidadesGeneradas || [];
    const filtroTipo = document.getElementById("filtroTipoUnidad");

    if (!filtroTipo) return;

    const tiposUnicos = [...new Set(unidades.map(u => normalizarTipoUnidad(u.tipo)))];

    const ordenTipos = [
        { value: "departamento", label: "Departamento" },
        { value: "oficina", label: "Oficina / Local" },
        { value: "estacionamiento", label: "Estacionamiento" },
        { value: "deposito", label: "Depósito" }
    ];

    filtroTipo.innerHTML = `<option value="">Todos</option>`;

    ordenTipos
        .filter(tipo => tiposUnicos.includes(tipo.value))
        .forEach(tipo => {
            filtroTipo.innerHTML += `
                <option value="${tipo.value}">
                    ${tipo.label}
                </option>
            `;
        });
}

function configurarCambioTipoUnidad() {
    const tipoUnidad = document.getElementById("tipoUnidad");

    if (!tipoUnidad) return;

    tipoUnidad.addEventListener("change", () => {
        cargarPisosPorTipo();
        cargarUnidadesGeneradasSelect();
        limpiarCodigoUnidad();
        actualizarAyudaFormato();
    });
}

function configurarCambioPisoUnidad() {
    const pisoUnidad = document.getElementById("pisoDepartamento");

    if (!pisoUnidad) return;

    pisoUnidad.addEventListener("change", () => {
        cargarUnidadesGeneradasSelect();
        limpiarCodigoUnidad();
    });
}

function configurarCambioUnidadGenerada() {
    const unidadSelect = document.getElementById("unidadGeneradaSelect");

    if (!unidadSelect) return;

    unidadSelect.addEventListener("change", () => {
        const unidad = obtenerUnidadGeneradaPorCodigo(unidadSelect.value);

        if (!unidad) {
            limpiarCodigoUnidad();
            return;
        }

        document.getElementById("numeroDepartamento").value = unidad.codigo;
        document.getElementById("pisoDepartamento").value = unidad.piso;
        document.getElementById("tipoUnidad").value = normalizarTipoUnidad(unidad.tipo);

        const estadoUnidad = document.getElementById("estadoUnidad");
        if (estadoUnidad) {
            estadoUnidad.value = normalizarEstadoUnidad(unidad.estado || "disponible");
        }
    });
}

function cargarPisosPorTipo() {
    const db = obtenerTodo();
    const unidades = db.unidadesGeneradas || [];

    const selectPiso = document.getElementById("pisoDepartamento");
    const tipo = document.getElementById("tipoUnidad")?.value || "";

    if (!selectPiso) return;

    selectPiso.innerHTML = `<option value="">Seleccione ubicación...</option>`;

    let unidadesFiltradas = unidades;

    if (tipo) {
        unidadesFiltradas = unidadesFiltradas.filter(unidad =>
            normalizarTipoUnidad(unidad.tipo) === tipo
        );
    }

    const ubicaciones = obtenerUbicacionesDesdeUnidades(unidadesFiltradas);

    ubicaciones.forEach(ubicacion => {
        selectPiso.innerHTML += `
            <option value="${ubicacion.value}">
                ${ubicacion.label}
            </option>
        `;
    });
}

function cargarFiltroPisos() {
    const db = obtenerTodo();
    const unidades = db.unidadesGeneradas || [];
    const filtroPiso = document.getElementById("filtroPisoUnidad");

    if (!filtroPiso) return;

    filtroPiso.innerHTML = `<option value="">Todos</option>`;

    const ubicaciones = obtenerUbicacionesDesdeUnidades(unidades);

    ubicaciones.forEach(ubicacion => {
        filtroPiso.innerHTML += `
            <option value="${ubicacion.value}">
                ${ubicacion.label}
            </option>
        `;
    });
}

function cargarUnidadesGeneradasSelect() {
    const db = obtenerTodo();
    const unidades = db.unidadesGeneradas || [];
    const departamentos = db.departamentos || [];

    const selectUnidad = document.getElementById("unidadGeneradaSelect");
    const tipo = document.getElementById("tipoUnidad")?.value || "";
    const piso = document.getElementById("pisoDepartamento")?.value || "";
    const idEditando = document.getElementById("departamentoId")?.value || "";

    if (!selectUnidad) return;

    selectUnidad.innerHTML = `<option value="">Seleccione unidad...</option>`;

    let unidadesFiltradas = unidades;

    if (tipo) {
        unidadesFiltradas = unidadesFiltradas.filter(unidad =>
            normalizarTipoUnidad(unidad.tipo) === tipo
        );
    }

    if (piso) {
        unidadesFiltradas = unidadesFiltradas.filter(unidad =>
            String(unidad.piso) === String(piso)
        );
    }

    unidadesFiltradas.sort((a, b) => {
        const pisoA = ordenarPiso(a.piso);
        const pisoB = ordenarPiso(b.piso);

        if (pisoA !== pisoB) return pisoA - pisoB;

        return String(a.codigo).localeCompare(String(b.codigo));
    });

    unidadesFiltradas.forEach(unidad => {
        const depRelacionado = departamentos.find(dep =>
            String(dep.numero) === String(unidad.codigo)
        );

        const estaRegistrada = !!depRelacionado;
        const esLaEditada = idEditando && depRelacionado && String(depRelacionado.id) === String(idEditando);

        selectUnidad.innerHTML += `
            <option
                value="${unidad.codigo}"
                ${estaRegistrada && !esLaEditada ? "disabled" : ""}
            >
                ${unidad.codigo} ${estaRegistrada && !esLaEditada ? "(ya registrada)" : ""}
            </option>
        `;
    });
}

function obtenerUbicacionesDesdeUnidades(unidades) {
    const mapa = new Map();

    unidades.forEach(unidad => {
        const value = String(unidad.piso);

        if (!mapa.has(value)) {
            mapa.set(value, {
                value,
                label: formatearPiso(value)
            });
        }
    });

    return [...mapa.values()].sort((a, b) =>
        ordenarPiso(a.value) - ordenarPiso(b.value)
    );
}

function obtenerUnidadGeneradaPorCodigo(codigo) {
    const db = obtenerTodo();

    return (db.unidadesGeneradas || []).find(unidad =>
        String(unidad.codigo) === String(codigo)
    ) || null;
}

function configurarFormularioDepartamento() {
    const form = document.getElementById("formDepartamento");
    const btnCancelar = document.getElementById("btnCancelarEdicion");

    if (!form) return;

    form.addEventListener("submit", event => {
        event.preventDefault();

        const id = document.getElementById("departamentoId").value;
        const codigo = document.getElementById("numeroDepartamento").value.trim();

        const unidadGenerada = obtenerUnidadGeneradaPorCodigo(codigo);

        if (!unidadGenerada) {
            alert("Selecciona una unidad generada válida.");
            return;
        }

        const datos = {
            numero: unidadGenerada.codigo,
            piso: unidadGenerada.piso,
            tipo: normalizarTipoUnidad(unidadGenerada.tipo),
            estado: document.getElementById("estadoUnidad")?.value || "disponible",
            observaciones: document.getElementById("observacionesUnidad")?.value.trim() || "",
            origen: "configuracion"
        };

        const resultado = id
            ? editarDepartamento(id, datos)
            : agregarDepartamento(datos);

        if (!resultado.ok) {
            alert(resultado.error);
            return;
        }

        actualizarEstadoUnidadGenerada(datos.numero, datos.estado);

        limpiarFormularioDepartamento();
        cargarPisosPorTipo();
        cargarUnidadesGeneradasSelect();
        renderizarDepartamentos();

        alert(id ? "Unidad actualizada correctamente." : "Unidad registrada correctamente.");
    });

    if (btnCancelar) {
        btnCancelar.addEventListener("click", () => {
            limpiarFormularioDepartamento();
            cargarPisosPorTipo();
            cargarUnidadesGeneradasSelect();
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

    document.getElementById("pisoDepartamento").value = departamento.piso;

    cargarUnidadesGeneradasSelect();

    document.getElementById("unidadGeneradaSelect").value = departamento.numero;
    document.getElementById("numeroDepartamento").value = departamento.numero;

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
    const confirmar = confirm("¿Está seguro de eliminar esta unidad del listado administrativo? La nomenclatura seguirá disponible en Configuración.");

    if (!confirmar) return;

    const db = obtenerTodo();
    const departamento = (db.departamentos || []).find(dep =>
        String(dep.id) === String(id)
    );

    const resultado = eliminarDepartamento(id);

    if (!resultado.ok) {
        alert(resultado.error);
        return;
    }

    if (departamento) {
        actualizarEstadoUnidadGenerada(departamento.numero, "disponible");
    }

    cargarUnidadesGeneradasSelect();
    renderizarDepartamentos();

    alert("Unidad eliminada correctamente.");
}

function limpiarFormularioDepartamento() {
    const form = document.getElementById("formDepartamento");
    const departamentoId = document.getElementById("departamentoId");

    if (form) form.reset();
    if (departamentoId) departamentoId.value = "";

    limpiarCodigoUnidad();
    actualizarAyudaFormato();
}

function limpiarCodigoUnidad() {
    const inputCodigo = document.getElementById("numeroDepartamento");
    const unidadSelect = document.getElementById("unidadGeneradaSelect");

    if (inputCodigo) inputCodigo.value = "";
    if (unidadSelect) unidadSelect.value = "";
}

function actualizarAyudaFormato() {
    const ayuda = document.getElementById("ayudaFormatoUnidad");

    if (!ayuda) return;

    ayuda.textContent = "Selecciona una unidad generada desde Configuración. El código se completará automáticamente y no podrá editarse manualmente.";
}

function actualizarEstadoUnidadGenerada(codigo, estado) {
    const db = obtenerTodo();

    db.unidadesGeneradas = db.unidadesGeneradas || [];

    const unidad = db.unidadesGeneradas.find(u =>
        String(u.codigo) === String(codigo)
    );

    if (unidad) {
        unidad.estado = estado;
        guardarTodo(db);
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

    return estadoManual;
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