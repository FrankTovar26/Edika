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

function cargarConfiguracionUnidades() {
    const db = obtenerTodo();

    db.unidadesGeneradas = db.unidadesGeneradas || [];
    db.departamentos = db.departamentos || [];
    db.usuarios = db.usuarios || [];

    const unidadesPermitidas = obtenerUnidadesGeneradasPermitidas(db);

    if (unidadesPermitidas.length === 0) {
        alert("Primero debes generar la nomenclatura de unidades para el edificio asignado.");
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

function obtenerEdificiosPermitidosLocal() {
    const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));
    const db = obtenerTodo();

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

function obtenerUnidadesGeneradasPermitidas(db) {
    const permitidos = obtenerEdificiosPermitidosLocal();

    if (permitidos.length === 0) return [];

    return (db.unidadesGeneradas || []).filter(unidad =>
        permitidos.includes(String(unidad.edificioId || ""))
    );
}

function obtenerDepartamentosPermitidos(db) {
    const permitidos = obtenerEdificiosPermitidosLocal();

    if (permitidos.length === 0) return [];

    return (db.departamentos || []).filter(dep =>
        permitidos.includes(String(dep.edificioId || ""))
    );
}

function sincronizarUnidadesGeneradasConDepartamentos() {
    const db = obtenerTodo();

    db.unidadesGeneradas = db.unidadesGeneradas || [];
    db.departamentos = db.departamentos || [];

    const unidadesPermitidas = obtenerUnidadesGeneradasPermitidas(db);

    unidadesPermitidas.forEach(unidad => {
        const yaExiste = db.departamentos.some(dep =>
            String(dep.numero) === String(unidad.codigo) &&
            String(dep.edificioId || "") === String(unidad.edificioId || "")
        );

        if (!yaExiste) {
            db.departamentos.push({
                id: Date.now().toString() + Math.random().toString(36).substring(2, 8),
                edificioId: unidad.edificioId,
                numero: unidad.codigo,
                piso: unidad.piso,
                tipo: unidad.tipo,
                estado: unidad.estado || "disponible",
                observaciones: "",
                fechaRegistro: new Date().toISOString(),
                origen: "configuracion",
                autorizados: []
            });
        }
    });

    guardarTodo(db);
}

function cargarTiposPermitidos() {
    const db = obtenerTodo();
    const unidades = obtenerUnidadesGeneradasPermitidas(db);

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
    const unidades = obtenerUnidadesGeneradasPermitidas(db);
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
    const unidades = obtenerUnidadesGeneradasPermitidas(db);

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
    const unidades = obtenerUnidadesGeneradasPermitidas(db);
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
    const unidades = obtenerUnidadesGeneradasPermitidas(db);
    const departamentos = obtenerDepartamentosPermitidos(db);

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
        const edificioA = obtenerNombreEdificio(db, a.edificioId);
        const edificioB = obtenerNombreEdificio(db, b.edificioId);

        const comparacionEdificio = edificioA.localeCompare(edificioB);
        if (comparacionEdificio !== 0) return comparacionEdificio;

        const pisoA = ordenarPiso(a.piso);
        const pisoB = ordenarPiso(b.piso);

        if (pisoA !== pisoB) return pisoA - pisoB;

        return String(a.codigo).localeCompare(String(b.codigo));
    });

    unidadesFiltradas.forEach(unidad => {
        const depRelacionado = departamentos.find(dep =>
            String(dep.numero) === String(unidad.codigo) &&
            String(dep.edificioId || "") === String(unidad.edificioId || "")
        );

        const estaRegistrada = !!depRelacionado;
        const esLaEditada = idEditando && depRelacionado && String(depRelacionado.id) === String(idEditando);
        const edificio = obtenerNombreEdificio(db, unidad.edificioId);

        selectUnidad.innerHTML += `
            <option
                value="${unidad.codigo}"
                data-edificio-id="${unidad.edificioId}"
                ${estaRegistrada && !esLaEditada ? "disabled" : ""}
            >
                ${unidad.codigo} - ${edificio} ${estaRegistrada && !esLaEditada ? "(ya registrada)" : ""}
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
    const permitidos = obtenerEdificiosPermitidosLocal();

    const select = document.getElementById("unidadGeneradaSelect");
    const option = select?.selectedOptions?.[0];
    const edificioSeleccionado = option?.dataset?.edificioId || "";

    return (db.unidadesGeneradas || []).find(unidad => {
        const mismoCodigo = String(unidad.codigo) === String(codigo);
        const edificioPermitido = permitidos.includes(String(unidad.edificioId || ""));
        const mismoEdificio = edificioSeleccionado
            ? String(unidad.edificioId || "") === String(edificioSeleccionado)
            : true;

        return mismoCodigo && edificioPermitido && mismoEdificio;
    }) || null;
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

        const estadoReal = obtenerEstadoRealUnidad({
            edificioId: unidadGenerada.edificioId,
            numero: unidadGenerada.codigo,
            tipo: unidadGenerada.tipo,
            estado: document.getElementById("estadoUnidad")?.value || "disponible"
        });

        const datos = {
            edificioId: unidadGenerada.edificioId,
            numero: unidadGenerada.codigo,
            piso: unidadGenerada.piso,
            tipo: normalizarTipoUnidad(unidadGenerada.tipo),
            estado: estadoReal,
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

        actualizarEstadoUnidadGenerada(datos.numero, datos.estado, datos.edificioId);

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

    let departamentos = obtenerDepartamentosPermitidos(db);

    const busqueda = document.getElementById("buscarUnidad")?.value.trim().toUpperCase() || "";
    const piso = document.getElementById("filtroPisoUnidad")?.value || "";
    const tipo = document.getElementById("filtroTipoUnidad")?.value || "";
    const estado = document.getElementById("filtroEstadoUnidad")?.value || "";

    if (busqueda) {
        departamentos = departamentos.filter(dep => {
            const edificio = obtenerNombreEdificio(db, dep.edificioId).toUpperCase();

            return (
                String(dep.numero || "").toUpperCase().includes(busqueda) ||
                edificio.includes(busqueda)
            );
        });
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
        const edificioA = obtenerNombreEdificio(db, a.edificioId);
        const edificioB = obtenerNombreEdificio(db, b.edificioId);

        const comparacionEdificio = edificioA.localeCompare(edificioB);
        if (comparacionEdificio !== 0) return comparacionEdificio;

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
        const edificio = obtenerNombreEdificio(db, dep.edificioId);
        const ocupante = obtenerTextoOcupanteUnidad(dep);

        return `
            <tr>
                <td>
                    <strong>${dep.numero}</strong><br>
                    <small>${edificio}</small>
                </td>
                <td>${formatearPiso(dep.piso)}</td>
                <td>${formatearTipoUnidad(tipoUnidad)}</td>
                <td>
                    <span class="badge ${claseEstado(estadoUnidad)}">
                        ${formatearEstadoUnidad(estadoUnidad)}
                    </span>
                    ${ocupante ? `<br><small>${ocupante}</small>` : ""}
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
    const departamentos = obtenerDepartamentosPermitidos(db);

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

    const departamento = obtenerDepartamentosPermitidos(db).find(dep =>
        String(dep.id) === String(id)
    );

    if (!departamento) {
        alert("Unidad no encontrada o no pertenece a tu edificio asignado.");
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
        document.getElementById("estadoUnidad").value = obtenerEstadoRealUnidad(departamento);
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
    const departamento = obtenerDepartamentosPermitidos(db).find(dep =>
        String(dep.id) === String(id)
    );

    if (!departamento) {
        alert("Unidad no encontrada o no pertenece a tu edificio asignado.");
        return;
    }

    const resultado = eliminarDepartamento(id);

    if (!resultado.ok) {
        alert(resultado.error);
        return;
    }

    actualizarEstadoUnidadGenerada(departamento.numero, "disponible", departamento.edificioId);

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

    const db = obtenerTodo();
    const permitidos = obtenerEdificiosPermitidosLocal();

    const edificios = (db.edificios || [])
        .filter(edificio => permitidos.includes(String(edificio.id)))
        .map(edificio => edificio.nombre)
        .join(", ");

    ayuda.textContent = edificios
        ? `Selecciona una unidad generada desde Configuración. Edificio(s) disponible(s): ${edificios}.`
        : "Selecciona una unidad generada desde Configuración. El código se completará automáticamente.";
}

function actualizarEstadoUnidadGenerada(codigo, estado, edificioId) {
    const db = obtenerTodo();

    db.unidadesGeneradas = db.unidadesGeneradas || [];

    const unidad = db.unidadesGeneradas.find(u =>
        String(u.codigo) === String(codigo) &&
        String(u.edificioId || "") === String(edificioId || "")
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

    const autorizadoEnUnidad = (dep.autorizados || []).some(a =>
        a.estado === "aceptada"
    );

    const usuarioVinculado = existeUsuarioVinculadoAUnidad(dep);

    if (
        tienePropietarioAceptado ||
        tieneInquilinoAceptado ||
        autorizadoEnUnidad ||
        usuarioVinculado ||
        dep.residente
    ) {
        return "ocupada";
    }

    return "disponible";
}

function existeUsuarioVinculadoAUnidad(dep) {
    const db = obtenerTodo();
    const usuarios = db.usuarios || [];

    return usuarios.some(usuario => {
        if (usuario.estado && usuario.estado !== "activo") {
            return false;
        }

        const unidades = usuario.unidadesAutorizadas || [];

        return unidades.some(unidad => {
            const mismoEdificio = String(unidad.edificioId || "") === String(dep.edificioId || "");
            const mismaUnidadId = unidad.unidadId && dep.id && String(unidad.unidadId) === String(dep.id);
            const mismoNumero = String(unidad.unidadNumero || unidad.numero || "") === String(dep.numero || "");
            const mismoTipo = !unidad.tipoUnidad || normalizarTipoUnidad(unidad.tipoUnidad) === normalizarTipoUnidad(dep.tipo);

            return mismoEdificio && mismoTipo && (mismaUnidadId || mismoNumero);
        });
    });
}

function obtenerTextoOcupanteUnidad(dep) {
    const db = obtenerTodo();
    const usuarios = db.usuarios || [];

    const vinculados = usuarios.filter(usuario => {
        const unidades = usuario.unidadesAutorizadas || [];

        return unidades.some(unidad => {
            const mismoEdificio = String(unidad.edificioId || "") === String(dep.edificioId || "");
            const mismaUnidadId = unidad.unidadId && dep.id && String(unidad.unidadId) === String(dep.id);
            const mismoNumero = String(unidad.unidadNumero || unidad.numero || "") === String(dep.numero || "");
            const mismoTipo = !unidad.tipoUnidad || normalizarTipoUnidad(unidad.tipoUnidad) === normalizarTipoUnidad(dep.tipo);

            return mismoEdificio && mismoTipo && (mismaUnidadId || mismoNumero);
        });
    });

    if (vinculados.length === 0) return "";

    return vinculados
        .map(usuario => {
            const vinculacion = (usuario.unidadesAutorizadas || []).find(unidad => {
                const mismoEdificio = String(unidad.edificioId || "") === String(dep.edificioId || "");
                const mismoNumero = String(unidad.unidadNumero || unidad.numero || "") === String(dep.numero || "");
                return mismoEdificio && mismoNumero;
            });

            const tipo = vinculacion?.tipoVinculacion
                ? capitalizar(vinculacion.tipoVinculacion)
                : "Vinculado";

            return `${tipo}: ${usuario.nombre || usuario.correo || "Usuario"}`;
        })
        .join("<br>");
}

function obtenerNombreEdificio(db, edificioId) {
    const edificio = (db.edificios || []).find(e =>
        String(e.id) === String(edificioId)
    );

    return edificio ? edificio.nombre : "-";
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

function formatearFecha(fechaISO) {
    if (!fechaISO) return "-";

    const fecha = new Date(fechaISO);

    return fecha.toLocaleDateString("es-PE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    });
}

function capitalizar(texto) {
    if (!texto) return "";

    return texto.charAt(0).toUpperCase() + texto.slice(1);
}