document.addEventListener("DOMContentLoaded", () => {
    protegerPaginaAdmin();
    inicializarEdificios();
    renderizarEdificios();
    renderizarUnidadesGeneradas();

    configurarFormulario();
    configurarBotones();
    configurarPreviewNomenclatura();

    alternarModoConfiguracion();
    actualizarPreviewNomenclatura();
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

function inicializarEdificios() {
    const db = obtenerTodo();

    db.edificios = db.edificios || [];
    db.unidadesGeneradas = db.unidadesGeneradas || [];

    guardarTodo(db);
}

function configurarFormulario() {
    const form = document.getElementById("formEdificio");

    if (!form) return;

    form.addEventListener("submit", event => {
        event.preventDefault();

        const id = document.getElementById("edificioId").value;
        const datos = obtenerDatosFormulario();

        if (!datos.ok) {
            alert(datos.error);
            return;
        }

        if (id) {
            editarEdificio(id, datos.data);
        } else {
            registrarEdificio(datos.data);
        }

        limpiarFormulario();
        renderizarEdificios();
        renderizarUnidadesGeneradas();
    });
}

function obtenerDatosFormulario() {
    const modo = document.getElementById("modoConfiguracionUnidades").value;

    const datos = {
        nombre: document.getElementById("nombreEdificio").value.trim(),
        direccion: document.getElementById("direccionEdificio").value.trim(),
        pisos: Number(document.getElementById("pisosEdificio").value),
        sotanos: Number(document.getElementById("sotanosEdificio").value),

        tieneOficinas: document.getElementById("tieneOficinas").value,
        tieneEstacionamientos: document.getElementById("tieneEstacionamientos").value,
        tieneDepositos: document.getElementById("tieneDepositos").value,

        modoConfiguracion: modo,

        departamentosPorPiso: Number(document.getElementById("departamentosPorPiso").value || 0),
        oficinasPorPiso: Number(document.getElementById("oficinasPorPiso").value || 0),
        estacionamientosPorSotano: Number(document.getElementById("estacionamientosPorSotano").value || 0),
        depositosPorSotano: Number(document.getElementById("depositosPorSotano").value || 0),

        configuracionAvanzada: []
    };

    if (!datos.nombre || !datos.direccion) {
        return { ok: false, error: "Completa los campos obligatorios." };
    }

    if (datos.pisos < 1) {
        return { ok: false, error: "Debe existir al menos 1 piso." };
    }

    if (datos.sotanos < 0) {
        return { ok: false, error: "Los sótanos no pueden ser negativos." };
    }

    if (modo === "simple") {
        if (datos.departamentosPorPiso < 0 || datos.oficinasPorPiso < 0 || datos.estacionamientosPorSotano < 0 || datos.depositosPorSotano < 0) {
            return { ok: false, error: "Las cantidades no pueden ser negativas." };
        }
    }

    if (modo === "avanzado") {
        const configuracion = obtenerConfiguracionAvanzada();

        if (configuracion.length === 0) {
            return {
                ok: false,
                error: "Construye la tabla avanzada antes de guardar o generar nomenclatura."
            };
        }

        datos.configuracionAvanzada = configuracion;
    }

    return {
        ok: true,
        data: datos
    };
}

function configurarBotones() {
    const btnCancelar = document.getElementById("btnCancelarEdicion");
    const btnLimpiar = document.getElementById("btnLimpiarDB");
    const btnGenerar = document.getElementById("btnGenerarNomenclatura");
    const btnConstruirAvanzada = document.getElementById("btnConstruirConfiguracionAvanzada");
    const modo = document.getElementById("modoConfiguracionUnidades");

    if (btnCancelar) {
        btnCancelar.addEventListener("click", limpiarFormulario);
    }

    if (btnLimpiar) {
        btnLimpiar.addEventListener("click", () => {
            const confirmar = confirm("¿Seguro que deseas borrar toda la base de datos?");

            if (!confirmar) return;

            limpiarDB();
            window.location.href = "../../../index.html";
        });
    }

    if (btnGenerar) {
        btnGenerar.addEventListener("click", () => {
            const datos = obtenerDatosFormulario();

            if (!datos.ok) {
                alert(datos.error);
                return;
            }

            generarUnidades(datos.data);
        });
    }

    if (btnConstruirAvanzada) {
        btnConstruirAvanzada.addEventListener("click", () => {
            construirTablaAvanzada();
        });
    }

    if (modo) {
        modo.addEventListener("change", () => {
            alternarModoConfiguracion();
            actualizarPreviewNomenclatura();
        });
    }
}

function configurarPreviewNomenclatura() {
    const ids = [
        "pisosEdificio",
        "sotanosEdificio",
        "departamentosPorPiso",
        "oficinasPorPiso",
        "estacionamientosPorSotano",
        "depositosPorSotano",
        "tieneOficinas",
        "tieneEstacionamientos",
        "tieneDepositos"
    ];

    ids.forEach(id => {
        const elemento = document.getElementById(id);

        if (!elemento) return;

        elemento.addEventListener("input", actualizarPreviewNomenclatura);
        elemento.addEventListener("change", actualizarPreviewNomenclatura);
    });
}

function alternarModoConfiguracion() {
    const modo = document.getElementById("modoConfiguracionUnidades").value;
    const simple = document.getElementById("seccionModoSimple");
    const avanzado = document.getElementById("seccionModoAvanzado");

    if (simple) simple.style.display = modo === "simple" ? "block" : "none";
    if (avanzado) avanzado.style.display = modo === "avanzado" ? "block" : "none";
}

function construirTablaAvanzada(configuracionExistente = null) {
    const tabla = document.getElementById("tablaConfiguracionAvanzada");

    if (!tabla) return;

    const pisos = Number(document.getElementById("pisosEdificio").value || 0);
    const sotanos = Number(document.getElementById("sotanosEdificio").value || 0);

    const tieneOficinas = document.getElementById("tieneOficinas").value;
    const tieneEstacionamientos = document.getElementById("tieneEstacionamientos").value;
    const tieneDepositos = document.getElementById("tieneDepositos").value;

    if (pisos < 1) {
        alert("Primero ingresa una cantidad válida de pisos.");
        return;
    }

    const configuracion = configuracionExistente || [];

    let html = "";

    for (let piso = 1; piso <= pisos; piso++) {
        const existente = configuracion.find(item =>
            item.tipoNivel === "piso" && Number(item.nivel) === piso
        );

        html += `
            <tr data-tipo-nivel="piso" data-nivel="${piso}">
                <td>Piso ${piso}</td>

                <td>
                    <input
                        type="number"
                        class="adv-departamentos"
                        min="0"
                        value="${existente?.departamentos ?? 4}"
                        style="width:90px;"
                    >
                </td>

                <td>
                    <input
                        type="number"
                        class="adv-oficinas"
                        min="0"
                        value="${tieneOficinas === "si" ? (existente?.oficinas ?? 0) : 0}"
                        ${tieneOficinas === "si" ? "" : "disabled"}
                        style="width:90px;"
                    >
                </td>

                <td>
                    <input
                        type="number"
                        class="adv-estacionamientos"
                        min="0"
                        value="0"
                        disabled
                        style="width:90px;"
                    >
                </td>

                <td>
                    <input
                        type="number"
                        class="adv-depositos"
                        min="0"
                        value="0"
                        disabled
                        style="width:90px;"
                    >
                </td>
            </tr>
        `;
    }

    for (let sotano = 1; sotano <= sotanos; sotano++) {
        const existente = configuracion.find(item =>
            item.tipoNivel === "sotano" && Number(item.nivel) === sotano
        );

        html += `
            <tr data-tipo-nivel="sotano" data-nivel="${sotano}">
                <td>Sótano ${sotano}</td>

                <td>
                    <input
                        type="number"
                        class="adv-departamentos"
                        min="0"
                        value="0"
                        disabled
                        style="width:90px;"
                    >
                </td>

                <td>
                    <input
                        type="number"
                        class="adv-oficinas"
                        min="0"
                        value="0"
                        disabled
                        style="width:90px;"
                    >
                </td>

                <td>
                    <input
                        type="number"
                        class="adv-estacionamientos"
                        min="0"
                        value="${tieneEstacionamientos === "si" ? (existente?.estacionamientos ?? 10) : 0}"
                        ${tieneEstacionamientos === "si" ? "" : "disabled"}
                        style="width:90px;"
                    >
                </td>

                <td>
                    <input
                        type="number"
                        class="adv-depositos"
                        min="0"
                        value="${tieneDepositos === "si" ? (existente?.depositos ?? 10) : 0}"
                        ${tieneDepositos === "si" ? "" : "disabled"}
                        style="width:90px;"
                    >
                </td>
            </tr>
        `;
    }

    tabla.innerHTML = html || `
        <tr>
            <td colspan="5">No hay niveles para configurar.</td>
        </tr>
    `;

    tabla.querySelectorAll("input").forEach(input => {
        input.addEventListener("input", actualizarPreviewNomenclatura);
        input.addEventListener("change", actualizarPreviewNomenclatura);
    });

    actualizarPreviewNomenclatura();
}

function obtenerConfiguracionAvanzada() {
    const filas = document.querySelectorAll("#tablaConfiguracionAvanzada tr[data-tipo-nivel]");
    const configuracion = [];

    filas.forEach(fila => {
        const tipoNivel = fila.dataset.tipoNivel;
        const nivel = Number(fila.dataset.nivel);

        configuracion.push({
            tipoNivel,
            nivel,
            departamentos: Number(fila.querySelector(".adv-departamentos")?.value || 0),
            oficinas: Number(fila.querySelector(".adv-oficinas")?.value || 0),
            estacionamientos: Number(fila.querySelector(".adv-estacionamientos")?.value || 0),
            depositos: Number(fila.querySelector(".adv-depositos")?.value || 0)
        });
    });

    return configuracion;
}

function actualizarPreviewNomenclatura() {
    const modo = document.getElementById("modoConfiguracionUnidades")?.value || "simple";

    if (modo === "avanzado") {
        actualizarPreviewAvanzado();
    } else {
        actualizarPreviewSimple();
    }
}

function actualizarPreviewSimple() {
    const preview = document.getElementById("previewNomenclatura");

    if (!preview) return;

    const pisos = Number(document.getElementById("pisosEdificio").value || 0);
    const sotanos = Number(document.getElementById("sotanosEdificio").value || 0);

    const departamentosPorPiso = Number(document.getElementById("departamentosPorPiso").value || 0);
    const oficinasPorPiso = Number(document.getElementById("oficinasPorPiso").value || 0);
    const estacionamientosPorSotano = Number(document.getElementById("estacionamientosPorSotano").value || 0);
    const depositosPorSotano = Number(document.getElementById("depositosPorSotano").value || 0);

    const tieneOficinas = document.getElementById("tieneOficinas").value;
    const tieneEstacionamientos = document.getElementById("tieneEstacionamientos").value;
    const tieneDepositos = document.getElementById("tieneDepositos").value;

    const ejemplosDepartamentos = [];
    const ejemplosOficinas = [];
    const ejemplosEstacionamientos = [];
    const ejemplosDepositos = [];

    if (pisos > 0) {
        for (let i = 1; i <= Math.min(departamentosPorPiso, 4); i++) {
            ejemplosDepartamentos.push(`Dpto ${generarCodigoUnidad(1, i)}`);
        }
    }

    if (tieneOficinas === "si") {
        for (let i = 1; i <= Math.min(oficinasPorPiso, 4); i++) {
            ejemplosOficinas.push(`Of ${generarCodigoUnidad(1, i)}`);
        }
    }

    if (tieneEstacionamientos === "si") {
        for (let i = 1; i <= Math.min(estacionamientosPorSotano, 4); i++) {
            ejemplosEstacionamientos.push(`E-S1-${String(i).padStart(2, "0")}`);
        }
    }

    if (tieneDepositos === "si") {
        for (let i = 1; i <= Math.min(depositosPorSotano, 4); i++) {
            ejemplosDepositos.push(`D-S1-${String(i).padStart(2, "0")}`);
        }
    }

    let html = "";
    html += crearCardPreview("🏢 Departamentos", ejemplosDepartamentos);

    if (tieneOficinas === "si") {
        html += crearCardPreview("🏬 Oficinas / Locales", ejemplosOficinas);
    }

    if (tieneEstacionamientos === "si") {
        html += crearCardPreview("🚗 Estacionamientos", ejemplosEstacionamientos);
    }

    if (tieneDepositos === "si") {
        html += crearCardPreview("📦 Depósitos", ejemplosDepositos);
    }

    preview.innerHTML = html;

    actualizarResumenGeneracion(
        pisos * departamentosPorPiso,
        tieneOficinas === "si" ? pisos * oficinasPorPiso : 0,
        tieneEstacionamientos === "si" ? sotanos * estacionamientosPorSotano : 0,
        tieneDepositos === "si" ? sotanos * depositosPorSotano : 0
    );
}

function actualizarPreviewAvanzado() {
    const preview = document.getElementById("previewNomenclatura");

    if (!preview) return;

    const configuracion = obtenerConfiguracionAvanzada();

    if (configuracion.length === 0) {
        preview.innerHTML = `
            <div style="padding:12px; border:1px solid #ddd; border-radius:8px; background:white;">
                Construye la tabla avanzada para visualizar la nomenclatura.
            </div>
        `;

        actualizarResumenGeneracion(0, 0, 0, 0);
        return;
    }

    const unidades = construirUnidadesDesdeAvanzado({
        configuracionAvanzada: configuracion
    });

    const departamentos = unidades
        .filter(u => u.tipo === "departamento")
        .slice(0, 4)
        .map(u => u.codigo);

    const oficinas = unidades
        .filter(u => u.tipo === "oficina")
        .slice(0, 4)
        .map(u => u.codigo);

    const estacionamientos = unidades
        .filter(u => u.tipo === "estacionamiento")
        .slice(0, 4)
        .map(u => u.codigo);

    const depositos = unidades
        .filter(u => u.tipo === "deposito")
        .slice(0, 4)
        .map(u => u.codigo);

    let html = "";

    html += crearCardPreview("🏢 Departamentos", departamentos);
    html += crearCardPreview("🏬 Oficinas / Locales", oficinas);
    html += crearCardPreview("🚗 Estacionamientos", estacionamientos);
    html += crearCardPreview("📦 Depósitos", depositos);

    preview.innerHTML = html;

    actualizarResumenGeneracion(
        unidades.filter(u => u.tipo === "departamento").length,
        unidades.filter(u => u.tipo === "oficina").length,
        unidades.filter(u => u.tipo === "estacionamiento").length,
        unidades.filter(u => u.tipo === "deposito").length
    );
}

function crearCardPreview(titulo, items) {
    return `
        <div style="padding:15px; border:1px solid #ddd; border-radius:10px; background:white;">
            <strong>${titulo}</strong>

            <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
                ${
                    items.length > 0
                        ? items.map(item => `
                            <span style="padding:6px 10px; background:#eff6ff; border-radius:999px; font-size:0.85rem;">
                                ${item}
                            </span>
                        `).join("")
                        : `<span style="color:#666;">No configurado</span>`
                }
            </div>
        </div>
    `;
}

function actualizarResumenGeneracion(totalDepartamentos, totalOficinas, totalEstacionamientos, totalDepositos) {
    document.getElementById("totalDepartamentosGenerados").textContent = totalDepartamentos;
    document.getElementById("totalOficinasGeneradas").textContent = totalOficinas;
    document.getElementById("totalEstacionamientosGenerados").textContent = totalEstacionamientos;
    document.getElementById("totalDepositosGenerados").textContent = totalDepositos;
}

function registrarEdificio(datos) {
    const db = obtenerTodo();

    db.edificios = db.edificios || [];

    const nuevoEdificio = {
        id: Date.now().toString(),
        nombre: datos.nombre,
        direccion: datos.direccion,
        pisos: datos.pisos,
        sotanos: datos.sotanos,
        tieneOficinas: datos.tieneOficinas,
        tieneEstacionamientos: datos.tieneEstacionamientos,
        tieneDepositos: datos.tieneDepositos,
        modoConfiguracion: datos.modoConfiguracion,
        departamentosPorPiso: datos.departamentosPorPiso,
        oficinasPorPiso: datos.oficinasPorPiso,
        estacionamientosPorSotano: datos.estacionamientosPorSotano,
        depositosPorSotano: datos.depositosPorSotano,
        configuracionAvanzada: datos.configuracionAvanzada || [],
        activo: db.edificios.length === 0,
        fechaCreacion: new Date().toISOString()
    };

    db.edificios.push(nuevoEdificio);

    if (nuevoEdificio.activo) {
        db.configEdificio = crearConfigDesdeEdificio(nuevoEdificio);
    }

    guardarTodo(db);

    generarUnidades(datos);

    alert("Edificio registrado correctamente.");
}

function editarEdificio(id, datos) {
    const db = obtenerTodo();

    const edificio = db.edificios.find(e => String(e.id) === String(id));

    if (!edificio) {
        alert("Edificio no encontrado.");
        return;
    }

    edificio.nombre = datos.nombre;
    edificio.direccion = datos.direccion;
    edificio.pisos = datos.pisos;
    edificio.sotanos = datos.sotanos;
    edificio.tieneOficinas = datos.tieneOficinas;
    edificio.tieneEstacionamientos = datos.tieneEstacionamientos;
    edificio.tieneDepositos = datos.tieneDepositos;
    edificio.modoConfiguracion = datos.modoConfiguracion;
    edificio.departamentosPorPiso = datos.departamentosPorPiso;
    edificio.oficinasPorPiso = datos.oficinasPorPiso;
    edificio.estacionamientosPorSotano = datos.estacionamientosPorSotano;
    edificio.depositosPorSotano = datos.depositosPorSotano;
    edificio.configuracionAvanzada = datos.configuracionAvanzada || [];

    if (edificio.activo) {
        db.configEdificio = crearConfigDesdeEdificio(edificio);
    }

    guardarTodo(db);

    generarUnidades(datos);

    alert("Edificio actualizado correctamente.");
}

function generarUnidades(datos) {
    const db = obtenerTodo();

    let unidades = [];

    if (datos.modoConfiguracion === "avanzado") {
        unidades = construirUnidadesDesdeAvanzado(datos);
    } else {
        unidades = construirUnidadesDesdeSimple(datos);
    }

    db.unidadesGeneradas = unidades;

    guardarTodo(db);

    renderizarUnidadesGeneradas();

    alert(`Se generaron ${unidades.length} unidades automáticamente.`);
}

function construirUnidadesDesdeSimple(datos) {
    const unidades = [];

    for (let piso = 1; piso <= datos.pisos; piso++) {
        for (let numero = 1; numero <= datos.departamentosPorPiso; numero++) {
            unidades.push({
                codigo: `Dpto ${generarCodigoUnidad(piso, numero)}`,
                tipo: "departamento",
                piso,
                estado: "disponible"
            });
        }

        if (datos.tieneOficinas === "si") {
            for (let numero = 1; numero <= datos.oficinasPorPiso; numero++) {
                unidades.push({
                    codigo: `Of ${generarCodigoUnidad(piso, numero)}`,
                    tipo: "oficina",
                    piso,
                    estado: "disponible"
                });
            }
        }
    }

    if (datos.tieneEstacionamientos === "si") {
        for (let sotano = 1; sotano <= datos.sotanos; sotano++) {
            for (let numero = 1; numero <= datos.estacionamientosPorSotano; numero++) {
                unidades.push({
                    codigo: `E-S${sotano}-${String(numero).padStart(2, "0")}`,
                    tipo: "estacionamiento",
                    piso: `S${sotano}`,
                    estado: "disponible"
                });
            }
        }
    }

    if (datos.tieneDepositos === "si") {
        for (let sotano = 1; sotano <= datos.sotanos; sotano++) {
            for (let numero = 1; numero <= datos.depositosPorSotano; numero++) {
                unidades.push({
                    codigo: `D-S${sotano}-${String(numero).padStart(2, "0")}`,
                    tipo: "deposito",
                    piso: `S${sotano}`,
                    estado: "disponible"
                });
            }
        }
    }

    return unidades;
}

function construirUnidadesDesdeAvanzado(datos) {
    const unidades = [];
    const configuracion = datos.configuracionAvanzada || [];

    configuracion.forEach(item => {
        if (item.tipoNivel === "piso") {
            for (let numero = 1; numero <= item.departamentos; numero++) {
                unidades.push({
                    codigo: `Dpto ${generarCodigoUnidad(item.nivel, numero)}`,
                    tipo: "departamento",
                    piso: item.nivel,
                    estado: "disponible"
                });
            }

            for (let numero = 1; numero <= item.oficinas; numero++) {
                unidades.push({
                    codigo: `Of ${generarCodigoUnidad(item.nivel, numero)}`,
                    tipo: "oficina",
                    piso: item.nivel,
                    estado: "disponible"
                });
            }
        }

        if (item.tipoNivel === "sotano") {
            for (let numero = 1; numero <= item.estacionamientos; numero++) {
                unidades.push({
                    codigo: `E-S${item.nivel}-${String(numero).padStart(2, "0")}`,
                    tipo: "estacionamiento",
                    piso: `S${item.nivel}`,
                    estado: "disponible"
                });
            }

            for (let numero = 1; numero <= item.depositos; numero++) {
                unidades.push({
                    codigo: `D-S${item.nivel}-${String(numero).padStart(2, "0")}`,
                    tipo: "deposito",
                    piso: `S${item.nivel}`,
                    estado: "disponible"
                });
            }
        }
    });

    return unidades;
}

function renderizarEdificios() {
    const db = obtenerTodo();
    const tabla = document.getElementById("tablaEdificios");

    if (!tabla) return;

    const edificios = db.edificios || [];

    if (edificios.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="12">No hay edificios registrados.</td>
            </tr>
        `;
        return;
    }

    tabla.innerHTML = edificios.map(edificio => {
        const resumen = obtenerResumenEdificio(edificio);

        return `
            <tr>
                <td>${edificio.nombre}</td>
                <td>${edificio.direccion}</td>
                <td>${edificio.pisos}</td>
                <td>${edificio.sotanos || 0}</td>
                <td>${edificio.modoConfiguracion === "avanzado" ? "Avanzado" : "Simple"}</td>
                <td>${resumen.departamentos}</td>
                <td>${resumen.oficinas}</td>
                <td>${resumen.estacionamientos}</td>
                <td>${resumen.depositos}</td>
                <td>
                    <span class="badge ${edificio.activo ? "vacio" : "ocupado"}">
                        ${edificio.activo ? "Activo" : "Inactivo"}
                    </span>
                </td>
                <td>${formatearFecha(edificio.fechaCreacion)}</td>
                <td>
                    <button class="btn btn-blue" onclick="cargarEdificioParaEditar('${edificio.id}')">
                        Editar
                    </button>

                    <button class="btn btn-green" onclick="activarEdificio('${edificio.id}')">
                        Activar
                    </button>

                    <button class="btn btn-red" onclick="desactivarEdificio('${edificio.id}')">
                        Desactivar
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

function obtenerResumenEdificio(edificio) {
    if (edificio.modoConfiguracion === "avanzado") {
        const unidades = construirUnidadesDesdeAvanzado(edificio);

        return {
            departamentos: unidades.filter(u => u.tipo === "departamento").length,
            oficinas: unidades.filter(u => u.tipo === "oficina").length,
            estacionamientos: unidades.filter(u => u.tipo === "estacionamiento").length,
            depositos: unidades.filter(u => u.tipo === "deposito").length
        };
    }

    return {
        departamentos: Number(edificio.pisos) * Number(edificio.departamentosPorPiso || 0),
        oficinas: edificio.tieneOficinas === "si"
            ? Number(edificio.pisos) * Number(edificio.oficinasPorPiso || 0)
            : 0,
        estacionamientos: edificio.tieneEstacionamientos === "si"
            ? Number(edificio.sotanos || 0) * Number(edificio.estacionamientosPorSotano || 0)
            : 0,
        depositos: edificio.tieneDepositos === "si"
            ? Number(edificio.sotanos || 0) * Number(edificio.depositosPorSotano || 0)
            : 0
    };
}

function renderizarUnidadesGeneradas() {
    const db = obtenerTodo();
    const tabla = document.getElementById("tablaUnidadesGeneradas");

    if (!tabla) return;

    const unidades = db.unidadesGeneradas || [];

    if (unidades.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="4">No hay unidades generadas.</td>
            </tr>
        `;
        return;
    }

    tabla.innerHTML = unidades.map(unidad => `
        <tr>
            <td>${unidad.codigo}</td>
            <td>${capitalizar(unidad.tipo)}</td>
            <td>${unidad.piso}</td>
            <td>
                <span class="badge vacio">
                    Disponible
                </span>
            </td>
        </tr>
    `).join("");
}

function cargarEdificioParaEditar(id) {
    const db = obtenerTodo();
    const edificio = db.edificios.find(e => String(e.id) === String(id));

    if (!edificio) return;

    document.getElementById("edificioId").value = edificio.id;
    document.getElementById("nombreEdificio").value = edificio.nombre;
    document.getElementById("direccionEdificio").value = edificio.direccion;
    document.getElementById("pisosEdificio").value = edificio.pisos;
    document.getElementById("sotanosEdificio").value = edificio.sotanos || 0;
    document.getElementById("tieneOficinas").value = edificio.tieneOficinas || "no";
    document.getElementById("tieneEstacionamientos").value = edificio.tieneEstacionamientos || "si";
    document.getElementById("tieneDepositos").value = edificio.tieneDepositos || "si";
    document.getElementById("modoConfiguracionUnidades").value = edificio.modoConfiguracion || "simple";

    document.getElementById("departamentosPorPiso").value = edificio.departamentosPorPiso || 4;
    document.getElementById("oficinasPorPiso").value = edificio.oficinasPorPiso || 0;
    document.getElementById("estacionamientosPorSotano").value = edificio.estacionamientosPorSotano || 10;
    document.getElementById("depositosPorSotano").value = edificio.depositosPorSotano || 10;

    alternarModoConfiguracion();

    if ((edificio.modoConfiguracion || "simple") === "avanzado") {
        construirTablaAvanzada(edificio.configuracionAvanzada || []);
    }

    actualizarPreviewNomenclatura();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function activarEdificio(id) {
    const db = obtenerTodo();
    const edificio = db.edificios.find(e => String(e.id) === String(id));

    if (!edificio) return;

    db.edificios.forEach(e => e.activo = false);

    edificio.activo = true;
    db.configEdificio = crearConfigDesdeEdificio(edificio);

    guardarTodo(db);
    renderizarEdificios();

    alert("Edificio activado correctamente.");
}

function desactivarEdificio(id) {
    const db = obtenerTodo();
    const edificio = db.edificios.find(e => String(e.id) === String(id));

    if (!edificio) return;

    edificio.activo = false;

    const activo = db.edificios.find(e => e.activo);

    db.configEdificio = activo
        ? crearConfigDesdeEdificio(activo)
        : null;

    guardarTodo(db);
    renderizarEdificios();

    alert("Edificio desactivado correctamente.");
}

function crearConfigDesdeEdificio(edificio) {
    return {
        nombre: edificio.nombre,
        direccion: edificio.direccion,
        pisos: edificio.pisos,
        sotanos: edificio.sotanos,
        tieneOficinas: edificio.tieneOficinas,
        tieneEstacionamientos: edificio.tieneEstacionamientos,
        tieneDepositos: edificio.tieneDepositos,
        modoConfiguracion: edificio.modoConfiguracion,
        departamentosPorPiso: edificio.departamentosPorPiso,
        oficinasPorPiso: edificio.oficinasPorPiso,
        estacionamientosPorSotano: edificio.estacionamientosPorSotano,
        depositosPorSotano: edificio.depositosPorSotano,
        configuracionAvanzada: edificio.configuracionAvanzada || []
    };
}

function limpiarFormulario() {
    const form = document.getElementById("formEdificio");

    if (form) form.reset();

    document.getElementById("edificioId").value = "";
    document.getElementById("sotanosEdificio").value = 0;
    document.getElementById("tieneOficinas").value = "no";
    document.getElementById("tieneEstacionamientos").value = "si";
    document.getElementById("tieneDepositos").value = "si";
    document.getElementById("modoConfiguracionUnidades").value = "simple";

    document.getElementById("departamentosPorPiso").value = 4;
    document.getElementById("oficinasPorPiso").value = 0;
    document.getElementById("estacionamientosPorSotano").value = 10;
    document.getElementById("depositosPorSotano").value = 10;

    const tablaAvanzada = document.getElementById("tablaConfiguracionAvanzada");

    if (tablaAvanzada) {
        tablaAvanzada.innerHTML = `
            <tr>
                <td colspan="5">
                    Presiona “Construir tabla avanzada” para personalizar la distribución.
                </td>
            </tr>
        `;
    }

    alternarModoConfiguracion();
    actualizarPreviewNomenclatura();
}

function generarCodigoUnidad(piso, numero) {
    return `${piso}${String(numero).padStart(2, "0")}`;
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