document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('tableBody');
    const searchInput = document.getElementById('searchInput');
    const classFilter = document.getElementById('classFilter');
    const totalEquipos = document.getElementById('totalEquipos');
    const totalTipos = document.getElementById('totalTipos');
    const upcomingCalibrations = document.getElementById('upcomingCalibrations');
    const totalEquiposCard = document.getElementById('totalEquiposCard');
    const upcomingCalibrationsCard = document.getElementById('upcomingCalibrationsCard');
    const resetBtn = document.getElementById('resetBtn');
    const backToDashboard = document.getElementById('backToDashboard');
    const clearDataBtn = document.getElementById('clearDataBtn');
    const dashboardView = document.getElementById('dashboardView');
    const uploadView = document.getElementById('uploadView');
    const folderInput = document.getElementById('folderInput');
    const selectFolderBtn = document.getElementById('selectFolderBtn');
    const uploadStatus = document.getElementById('uploadStatus');

    // Configurar pdf.js
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    let allData = [];
    let showOnlyAlerts = false;

    // Cargar datos
    function loadData() {
        try {
            const savedData = localStorage.getItem('equipmentData');
            allData = savedData ? JSON.parse(savedData) : equipmentData;
            populateCategories(allData);
            applyFilters();
            updateStats(allData);
        } catch (error) {
            console.error('Error:', error);
            tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color: red; padding: 2rem;">Error al cargar los datos.</td></tr>`;
        }
    }

    async function extractTextFromPDF(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = "";
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                fullText += textContent.items.map(item => item.str).join(" ") + " ";
            }
            // Limpiar espacios múltiples que causan problemas
            fullText = fullText.replace(/\s+/g, ' ');
            return fullText;
        } catch (e) {
            console.error("Error leyendo PDF:", e);
            return "";
        }
    }

    function parseDate(dateStr) {
        if (!dateStr || dateStr === 'N/A') return null;
        const [day, month, year] = dateStr.split('/').map(Number);
        return new Date(year, month - 1, day);
    }

    function isUpcoming(dateStr) {
        const calDate = parseDate(dateStr);
        if (!calDate) return false;
        const nextCal = new Date(calDate);
        nextCal.setFullYear(nextCal.getFullYear() + 1);
        const now = new Date();
        const diffTime = nextCal - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 && diffDays <= 90;
    }

    function populateCategories(data) {
        classFilter.innerHTML = '<option value="all">Todas las clases</option>';
        const categories = [...new Set(data.map(i => i.Equipo))].sort();
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            classFilter.appendChild(option);
        });
    }

    function applyFilters() {
        const term = searchInput.value.toLowerCase();
        const selectedClass = classFilter.value;
        let filtered = allData.filter(item => {
            const matchesSearch = item.Serie.toLowerCase().includes(term) || item.Fecha.toLowerCase().includes(term);
            const matchesClass = selectedClass === 'all' || item.Equipo === selectedClass;
            const matchesAlert = !showOnlyAlerts || isUpcoming(item.Fecha);
            return matchesSearch && matchesClass && matchesAlert;
        });
        if (showOnlyAlerts) {
            filtered.sort((a, b) => a.Equipo.localeCompare(b.Equipo));
        }
        renderTable(filtered);
    }

    function renderTable(data) {
        tableBody.innerHTML = '';
        if (data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 2rem;">No se encontraron resultados.</td></tr>`;
            return;
        }
        data.forEach(item => {
            const tr = document.createElement('tr');
            const alertClass = isUpcoming(item.Fecha) ? 'badge-alert' : '';
            tr.innerHTML = `
                <td><span class="badge badge-equipo">${item.Equipo}</span></td>
                <td><span class="serie-text">${item.Serie}</span></td>
                <td><span class="badge badge-date ${alertClass}">${item.Fecha}</span></td>
            `;
            tableBody.appendChild(tr);
        });
    }

    function updateStats(data) {
        totalEquipos.textContent = data.length;
        const types = new Set(data.map(i => i.Equipo));
        totalTipos.textContent = types.size;
        const alertCount = data.filter(i => isUpcoming(i.Fecha)).length;
        upcomingCalibrations.textContent = alertCount;
    }

    selectFolderBtn.addEventListener('click', () => folderInput.click());

    folderInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        uploadStatus.classList.remove('hidden');
        selectFolderBtn.disabled = true;

        const newResults = [];
        const equipmentMap = new Map(); // Usar Map para mejor control de duplicados
        const mesesMap = { "enero": "01", "febrero": "02", "marzo": "03", "abril": "04", "mayo": "05", "junio": "06", "julio": "07", "agosto": "08", "septiembre": "09", "octubre": "10", "noviembre": "11", "diciembre": "12" };

        // Patrones de exclusión mejorados
        const excludePatterns = [
            'IC-OXI', 'Contrastaci', 'Instrumento', 'Seguridad Electrica', 
            'Anemometro', 'Anemómetro', 'Contador', 'Decibelimetro', 'Decibelímetro',
            'Fotometro', 'Fotómetro', 'Luxometro', 'Luxómetro',
            'Emery', 'Registro de Conteo', 'Validaci', 'Validad'
        ];

        for (const file of files) {
            const path = file.webkitRelativePath;
            const parts = path.split('/');
            const filename = file.name;
            const filebase = filename.split('.')[0];
            const ext = filename.toLowerCase().split('.').pop();

            // Filtrar archivos no deseados
            if (!['pdf', 'xlsx', 'xls'].includes(ext)) continue;
            
            // Verificar patrones de exclusión en nombre y path
            const shouldExclude = excludePatterns.some(pattern => 
                filename.includes(pattern) || path.includes(pattern)
            );
            if (shouldExclude) continue;
            
            // Excluir archivos que empiezan con "SE " o "SE-"
            if (filebase.match(/^SE[\s-]/i)) continue;

            let equipo = "Otro";
            let fecha = "N/A";
            let serie = "N/A";

            // 1. Extraer equipo y fecha de la carpeta principal (nivel 1)
            const folderMatch = parts[1] ? parts[1].match(/^(\d{2}-\d{2}-\d{4})\s*(?:-\s*)?(.*)$/) : null;
            if (folderMatch) {
                fecha = folderMatch[1].replace(/-/g, '/');
                equipo = folderMatch[2].trim() || "Equipo";
            } else if (parts[1]) {
                equipo = parts[1];
            }
            
            // Si el equipo es un año (como "2025"), archivo PDF, o número, buscar en carpeta padre
            if (equipo.match(/^\d{4}$/) || equipo.toLowerCase().endsWith('.pdf') || equipo.match(/^\d+$/)) {
                // Buscar hacia atrás en el path para encontrar el nombre real del equipo
                for (let i = parts.length - 2; i >= 1; i--) {
                    if (parts[i] && 
                        !parts[i].match(/^\d{4}$/) && 
                        !parts[i].toLowerCase().endsWith('.pdf') &&
                        !parts[i].match(/^\d+$/) &&
                        parts[i].length > 2) {
                        equipo = parts[i];
                        break;
                    }
                }
            }

            // 2. Extraer Serie del path o nombre de archivo (mejorado)
            // Casos especiales por tipo de equipo
            const equipoLower = equipo.toLowerCase();
            
            // CASO ESPECIAL: Balanzas - SIEMPRE buscar en carpeta, ignorar archivos UUID
            if (equipoLower.includes('balanza') || equipoLower.includes('altimetro')) {
                // Buscar carpeta con número de 4-5 dígitos (nivel 2 o 3)
                for (let i = 2; i < parts.length; i++) {
                    if (parts[i] && parts[i].match(/^\d{4,5}$/) && parts[i] !== 'OTRAS') {
                        serie = parts[i];
                        break;
                    }
                }
            }
            // CASO ESPECIAL: Pipetas - serie en nombre de archivo (8 dígitos o alfanumérico)
            else if (equipoLower.includes('pipeta')) {
                // Buscar número de 8 dígitos en el nombre del archivo
                if (filebase.match(/^\d{8,9}$/)) {
                    serie = filebase;
                }
                // O buscar patrón con letras seguido de números (SJ23938, VH23667, etc.)
                else if (filebase.match(/^[A-Z]{2}\d+$/i)) {
                    serie = filebase;
                }
                // O buscar patrón con letras y números mezclados
                else if (filebase.match(/^[A-Z0-9]{5,}$/i)) {
                    serie = filebase;
                }
            }
            // CASO ESPECIAL: Cabinas de bioseguridad - serie en subcarpeta
            else if (equipoLower.includes('cabina') || equipoLower.includes('bioseguridad')) {
                // Buscar subcarpeta con número (ej: /107/ o /108/)
                const cabinaMatch = path.match(/\/(\d{3})\//);
                if (cabinaMatch) {
                    serie = cabinaMatch[1];
                }
                // También buscar #107 o #108 en el nombre del archivo
                else if (filebase.match(/#(\d{3})/)) {
                    serie = filebase.match(/#(\d{3})/)[1];
                }
            }
            // CASO ESPECIAL: Centrífugas - puede tener CENTRIF- o solo número
            else if (equipoLower.includes('centrif')) {
                // Buscar CENTRIF-XXXXX en carpeta o archivo
                const centrifMatch = path.match(/CENTRIF-(\d+)/i) || filebase.match(/CENTRIF-(\d+)/i);
                if (centrifMatch) {
                    serie = centrifMatch[1];
                }
                // O buscar carpeta con solo número
                else if (parts[2] && parts[2].match(/^\d{4,6}$/)) {
                    serie = parts[2];
                }
                // O archivo con solo número
                else if (filebase.match(/^\d{4,6}$/)) {
                    serie = filebase;
                }
            }
            // CASO ESPECIAL: ECG - formato "ECG - 07.12706" o "ECG - ELE-8020006"
            else if (equipoLower.includes('ecg')) {
                const ecgMatch = path.match(/ECG\s*-\s*([A-Z0-9\.\-]+)/i) || filebase.match(/ECG-([A-Z0-9\.\-]+)/i);
                if (ecgMatch) {
                    serie = ecgMatch[1];
                }
            }
            // CASO ESPECIAL: Ecógrafo - formato USD0531320
            else if (equipoLower.includes('ecografo') || equipoLower.includes('ecógrafo')) {
                const ecografoMatch = path.match(/USD(\d+)/i) || filebase.match(/USD(\d+)/i);
                if (ecografoMatch) {
                    serie = 'USD' + ecografoMatch[1];
                }
            }
            // CASOS GENERALES
            else {
                // Prioridad 1: Carpeta con número de serie (subcarpetas nivel 2)
                if (parts[2] && parts[2].match(/^\d{4,}$/)) {
                    serie = parts[2];
                }
                // Prioridad 2: Patrones específicos en nombre de archivo
                else if (filebase.match(/(?:SN|TER-|EZ-|AGI-|AGITADO-|CEN-|EST-|ESTUFA-)\s*(\d+)/i)) {
                    serie = filebase.match(/(?:SN|TER-|EZ-|AGI-|AGITADO-|CEN-|EST-|ESTUFA-)\s*(\d+)/i)[1];
                }
                // Prioridad 3: Número largo en el nombre (8+ dígitos)
                else if (filebase.match(/(\d{8,})/)) {
                    serie = filebase.match(/(\d{8,})/)[1];
                }
                // Prioridad 4: Hash seguido de número
                else if (filebase.match(/#(\d+)/)) {
                    serie = filebase.match(/#(\d+)/)[1];
                }
                // Prioridad 5: Número de 4-7 dígitos standalone
                else if (filebase.match(/\b(\d{4,7})\b/)) {
                    serie = filebase.match(/\b(\d{4,7})\b/)[1];
                }
            }

            // 3. EXTRACCION PROFUNDA (PDF) - Solo si es PDF
            if (ext === 'pdf') {
                const text = await extractTextFromPDF(file);
                if (text) {
                    // CASO ESPECIAL: Certificados consolidados de pipetas (múltiples series en un PDF)
                    if (equipoLower.includes('pipeta') && (text.includes('Detalle de Instrumentos') || text.includes('Pipeta N'))) {
                        // Extraer fecha del procedimiento
                        const fechaMatch = text.match(/Fecha\s*del\s*Procedimiento\s*(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})/i) ||
                                          text.match(/Fecha\s*(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})/i);
                        if (fechaMatch) {
                            fecha = `${fechaMatch[1]}/${fechaMatch[2]}/${fechaMatch[3]}`;
                        }
                        
                        // Extraer todas las series
                        const seriePattern = /Serie\s*:\s*([A-Z0-9]+)/gi;
                        const series = [...text.matchAll(seriePattern)];
                        
                        // Agregar cada pipeta como un equipo separado
                        series.forEach(match => {
                            const serieIndividual = match[1].trim();
                            if (serieIndividual.length >= 5 && 
                                serieIndividual !== 'EQUIPO' && 
                                !serieIndividual.match(/^\d{2}\/\d{2}/)) {
                                
                                const key = `PIPETAS-${serieIndividual}`;
                                if (!equipmentMap.has(key)) {
                                    equipmentMap.set(key, { Equipo: 'PIPETAS', Fecha: fecha, Serie: serieIndividual });
                                }
                            }
                        });
                        
                        continue;
                    }
                    
                    // --- PATRONES DE FECHA (para todos los PDFs) ---
                    let dateMatch = null;
                    
                    // Patrón 0: "Fecha del Procedimiento" (PIPETAS - PRIORIDAD)
                    dateMatch = text.match(/Fecha\s*del\s*Procedimiento\s*(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})/i);
                    if (dateMatch) {
                        fecha = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`;
                    }
                    
                    // Patrón 1: "Fecha de calibración:" seguido de "DD de Mes de YYYY"
                    if (fecha === "N/A") {
                        dateMatch = text.match(/Fecha\s*de\s*calibraci[oó]n\s*[:\s]*(\d{1,2})\s*de\s*(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s*de\s*(\d{4})/i);
                        if (dateMatch) {
                            const dia = dateMatch[1].padStart(2, '0');
                            const mesNombre = dateMatch[2].toLowerCase().trim();
                            const anio = dateMatch[3];
                            if (mesesMap[mesNombre]) {
                                fecha = `${dia}/${mesesMap[mesNombre]}/${anio}`;
                            }
                        }
                    }
                    
                    // Patrón 2: "Fecha de calibración:" seguido de DD/MM/YYYY
                    if (fecha === "N/A") {
                        dateMatch = text.match(/Fecha\s*de\s*calibraci[oó]n\s*[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
                        if (dateMatch) {
                            fecha = dateMatch[1];
                        }
                    }
                    
                    // Patrón 3: "Fecha:" seguido de DD/MM/YYYY
                    if (fecha === "N/A") {
                        dateMatch = text.match(/(?:Fecha|fecha)\s*[:\s]*(\d{2}\/\d{2}\/\d{4})/);
                        if (dateMatch) {
                            fecha = dateMatch[1];
                        }
                    }
                    
                    // Patrón 4: Cualquier "DD de Mes de YYYY"
                    if (fecha === "N/A") {
                        dateMatch = text.match(/(\d{1,2})\s*de\s*(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s*de\s*(\d{4})/i);
                        if (dateMatch) {
                            const dia = dateMatch[1].padStart(2, '0');
                            const mesNombre = dateMatch[2].toLowerCase().trim();
                            const anio = dateMatch[3];
                            if (mesesMap[mesNombre]) {
                                fecha = `${dia}/${mesesMap[mesNombre]}/${anio}`;
                            }
                        }
                    }
                    
                    // Patrón 5: Primera fecha DD/MM/YYYY encontrada (con o sin espacios)
                    if (fecha === "N/A") {
                        dateMatch = text.match(/(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})/);
                        if (dateMatch) {
                            fecha = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`;
                        }
                    }
                    
                    // Patrón 6: DD-MM-YYYY
                    if (fecha === "N/A") {
                        dateMatch = text.match(/(\d{2})-(\d{2})-(\d{4})/);
                        if (dateMatch) {
                            fecha = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`;
                        }
                    }

                    // --- PATRONES DE SERIE (mejorados) ---
                    // Solo extraer del PDF si no tenemos una serie válida
                    if (serie === "N/A" || serie.length < 4) {
                        // Patrón 1: "N° SERIE:" (con espacio y mayúsculas - común en pipetas)
                        let snMatch = text.match(/N[°º]\s*SERIE[:\s]+(\d+)/i);
                        if (snMatch) {
                            serie = snMatch[1].trim();
                        }
                        // Patrón 2: "N° Serie:" o "Identificación:"
                        if (!snMatch) {
                            snMatch = text.match(/(?:N[°º.]?\s*Serie|Identificaci[oó]n)[:\s]+([A-Z0-9\-\.]+)/i);
                            if (snMatch) {
                                const extracted = snMatch[1].trim();
                                if (extracted.length >= 3 && extracted.length <= 20 && extracted.match(/^[A-Z0-9\-\.]+$/i)) {
                                    serie = extracted;
                                }
                            }
                        }
                        // Patrón 3: "S/N:" o "S.N:"
                        if (serie === "N/A" || serie.length < 4) {
                            snMatch = text.match(/S[\/\.]N[:\s]+([A-Z0-9\-\.]+)/i);
                            if (snMatch) {
                                const extracted = snMatch[1].trim();
                                if (extracted.length >= 3 && extracted.length <= 20 && extracted.match(/^[A-Z0-9\-\.]+$/i)) {
                                    serie = extracted;
                                }
                            }
                        }
                        // Patrón 4: Hash seguido de número
                        if (serie === "N/A" || serie.length < 4) {
                            snMatch = text.match(/#(\d{4,})/);
                            if (snMatch) {
                                serie = snMatch[1];
                            }
                        }
                    }

                    // --- EQUIPO (solo si no tenemos uno válido) ---
                    if (equipo === "Otro" || equipo === "Equipo") {
                        const eqMatch = text.match(/(?:Equipo|Objeto)[:\s]+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s]+?)(?=\s*(?:Rango|Mod|Marca|Edif|Fabricante|N[°º.]|$))/i);
                        if (eqMatch) {
                            const extracted = eqMatch[1].trim();
                            if (extracted.length > 3 && extracted.length < 50) {
                                equipo = extracted;
                            }
                        }
                    }
                }
            }

            // Validar que tengamos una serie válida antes de agregar
            // Excluir UUIDs/GUIDs (formato: 8-4-4-4-12 caracteres hexadecimales)
            const isUUID = serie.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
            if (serie === "N/A" || serie.length < 3 || isUUID) {
                console.log('Serie rechazada:', serie, 'isUUID:', !!isUUID);
                continue; // Saltar si no hay serie válida o es un UUID
            }

            // Usar Map para evitar duplicados, priorizando entradas con fecha válida
            const key = `${equipo}-${serie}`;
            const existing = equipmentMap.get(key);
            
            if (!existing) {
                equipmentMap.set(key, { Equipo: equipo, Fecha: fecha, Serie: serie });
            } else {
                // Si ya existe, mantener el que tenga fecha válida
                if (fecha !== "N/A" && existing.Fecha === "N/A") {
                    equipmentMap.set(key, { Equipo: equipo, Fecha: fecha, Serie: serie });
                }
            }
        }

        // Convertir Map a array
        const processedResults = Array.from(equipmentMap.values());

        // Combinar con datos existentes (no sobrescribir)
        const existingData = localStorage.getItem('equipmentData');
        let combinedData = processedResults;
        
        if (existingData) {
            const existing = JSON.parse(existingData);
            const existingMap = new Map(existing.map(item => [`${item.Equipo}-${item.Serie}`, item]));
            
            // Agregar nuevos datos
            processedResults.forEach(item => {
                existingMap.set(`${item.Equipo}-${item.Serie}`, item);
            });
            
            combinedData = Array.from(existingMap.values());
        }

        allData = combinedData;
        localStorage.setItem('equipmentData', JSON.stringify(combinedData));
        
        setTimeout(() => {
            uploadStatus.classList.add('hidden');
            selectFolderBtn.disabled = false;
            uploadView.classList.add('hidden');
            dashboardView.classList.remove('hidden');
            loadData();
        }, 1000);
    });

    searchInput.addEventListener('input', applyFilters);
    classFilter.addEventListener('change', applyFilters);
    upcomingCalibrationsCard.addEventListener('click', () => {
        showOnlyAlerts = !showOnlyAlerts;
        upcomingCalibrationsCard.classList.toggle('active-filter', showOnlyAlerts);
        totalEquiposCard.classList.remove('active-filter');
        applyFilters();
    });
    totalEquiposCard.addEventListener('click', () => {
        showOnlyAlerts = false;
        upcomingCalibrationsCard.classList.remove('active-filter');
        totalEquiposCard.classList.add('active-filter');
        searchInput.value = '';
        classFilter.value = 'all';
        applyFilters();
    });
    resetBtn.addEventListener('click', () => {
        dashboardView.classList.add('hidden');
        uploadView.classList.remove('hidden');
    });
    backToDashboard.addEventListener('click', () => {
        uploadView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
    });
    
    clearDataBtn.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres eliminar todos los datos? Esta acción no se puede deshacer.')) {
            localStorage.removeItem('equipmentData');
            allData = [];
            loadData();
            alert('Datos eliminados correctamente');
        }
    });
    
    loadData();
});
