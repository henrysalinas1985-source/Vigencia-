param (
    [string]$RootPath = "C:\Users\hesalinas\Music\2025\Investigacion",
    [string]$OutputPath = "C:\Users\hesalinas\Music\2025\data.js"
)

Write-Host "--- Iniciando Procesamiento Automático de Relevamiento ---" -ForegroundColor Cyan
Write-Host "Carpeta Origen: $RootPath"

$results = @()
$meses = @{
    "enero" = "01"; "febrero" = "02"; "marzo" = "03"; "abril" = "04";
    "mayo" = "05"; "junio" = "06"; "julio" = "07"; "agosto" = "08";
    "septiembre" = "09"; "octubre" = "10"; "noviembre" = "11"; "diciembre" = "12"
}

# 1. Obtener subcarpetas de primer nivel (Categorías)
$categorias = Get-ChildItem -Path $RootPath -Directory

foreach ($catDir in $categorias) {
    Write-Host "Procesando categoría: $($catDir.Name)" -ForegroundColor Yellow
    
    # Extraer Fecha del nombre de la carpeta (ej: 09-04-2025 - Oximetros)
    $fechaCarpeta = "N/A"
    if ($catDir.Name -match "(\d{2}-\d{2}-\d{4})") {
        $fechaCarpeta = $Matches[1] -replace "-", "/"
    }
    
    # Nombre del equipo (limpiar fecha si existe)
    $equipoBase = $catDir.Name -replace "^\d{2}-\d{2}-\d{4}\s*(- )*", ""

    # Buscar archivos recursivamente
    $excludePatterns = @(
        "IC-OXI", "Contrastaci", "Instrumento", "Seguridad Electrica", 
        "Anemomet", "Contador", "Decibelimet", "Fotomet", "Luxomet", 
        "Emery", "Registro de Conteo", "^SE\s", "^SE-", "Contrastaci", "Validad"
    )
    
    $files = Get-ChildItem -Path $catDir.FullName -Recurse -File -Include *.pdf, *.xlsx, *.xls | Where-Object {
        $fileName = $_.Name
        $fullPath = $_.FullName
        $match = $false
        foreach ($pattern in $excludePatterns) {
            # Búsqueda insensible a tildes usando regex simplificado o -like
            if ($fileName -match $pattern -or $fullPath -match $pattern) { $match = $true; break }
        }
        
        # Filtro extra para Cabinas: Solo queremos el certificado principal
        if ($equipoBase -match "Cabina|Bioseguridad" -and $fileName -match "\.pdf$") {
            if ($fileName -notmatch "SWISS MEDICAL GROUP") { $match = $true }
        }

        -not $match
    }

    foreach ($file in $files) {
        # Para Mondis/Datalogger vinculados a Excel, ignorar el PDF si existe el Excel para evitar duplicados genéricos
        if ($equipoBase -match "Mondis|Datalogger" -and $file.Extension -eq ".pdf") {
            $excelEquivalent = Join-Path $file.Directory.FullName ($base + ".xlsx")
            if (Test-Path $excelEquivalent) { continue }
            $excelEquivalent = Join-Path $file.Directory.FullName ($base + ".xls")
            if (Test-Path $excelEquivalent) { continue }
        }

        $serie = "N/A"
        $fechaFinal = $fechaCarpeta
        $base = [io.path]::GetFileNameWithoutExtension($file.Name)

        # 1. Extracción profunda desde PDF (Prioridad Global)
        if ($file.Extension -eq ".pdf") {
            try {
                $raw = Get-Content -Path $file.FullName -Raw -Encoding latin1 -ErrorAction SilentlyContinue
                # Limpiar y normalizar para regex
                $content = [regex]::Replace($raw, '[^ -~]', ' ')
                
                # A) Fecha (Cualquier DD de [Mes] de YYYY)
                if ($content -match "(\d{1,2})\s+de\s+([a-zA-Z]{4,12})\s+de\s+(\d{4})") {
                    $dia = $Matches[1].PadLeft(2, '0')
                    $mesNombre = $Matches[2].ToLower().Trim()
                    $anio = $Matches[3]
                    if ($meses.ContainsKey($mesNombre)) { 
                        $fechaFinal = "$dia/$($meses[$mesNombre])/$anio" 
                    }
                }
                elseif ($content -match "(\d{2}/\d{2}/\d{4})") {
                    $fechaFinal = $Matches[1]
                }
                
                # B) Serie (Etiquetas explícitas)
                if ($content -match "(?:N[°\.º]?\s*Serie|S[\/\.]?N|Identificaci[óo]n|Serial)[:\s]*([a-zA-Z0-9\.\-]+)") {
                    $serieDetectada = $Matches[1].Trim()
                    if ($serieDetectada.Length -gt 2 -and $serieDetectada -notmatch "^[0-9a-f]{8}-") {
                        $serie = $serieDetectada
                    }
                }
                elseif ($content -match "#(\d+)") {
                    $serie = $Matches[1]
                }

                # C) Equipo (Etiqueta Objeto o Equipo)
                if ($content -match "(?:Objeto|Equipo):\s*([A-Z\xc1\xc9\xcd\xd3\xda\xd1 ]+)") {
                    $val = $Matches[1].Trim()
                    if ($val.Length -gt 3) { $equipoBase = $val }
                }
            }
            catch {}
        }
        # 1.2 Extracción desde Excel para Dataloggers (Mondis)
        elseif ($file.Extension -match "\.xlsx$|\.xls$" -and $equipoBase -match "Mondis|Datalogger") {
            try {
                $excel = New-Object -ComObject Excel.Application -ErrorAction SilentlyContinue
                if ($excel) {
                    $excel.Visible = $false
                    $workbook = $excel.Workbooks.Open($file.FullName)
                    $sheet = $workbook.Sheets.Item(1)
                    
                    # A) Datos Generales del Excel
                    $modeloExcel = ($sheet.Cells.Item(5, 4).Text -replace "Modelo:\s*", "").Trim() # D5
                    $marcaExcel = ($sheet.Cells.Item(8, 4).Text -replace "Marca:\s*", "").Trim()  # D8
                    $fechaExcel = ($sheet.Cells.Item(8, 8).Text).Trim() # H8
                    
                    if ($fechaExcel -match "\d{2}/\d{2}/\d{4}") { $fechaFinal = $fechaExcel }
                    $equipoDesc = [regex]::Replace(($marcaExcel + " " + $modeloExcel).Trim(), "\s+", " ")
                    if ($equipoDesc -eq "") { $equipoDesc = $equipoBase }

                    # B) Buscar tabla de sensores (usualmente desde fila 42)
                    $sensoresEncontrados = 0
                    for ($row = 43; $row -le 150; $row++) {
                        $sensorSerial = ($sheet.Cells.Item($row, 2).Text).Trim() # Columna B: Sensor
                        if ($sensorSerial -match "^\d{5,}") {
                            $ubicacion = ($sheet.Cells.Item($row, 1).Text).Trim() # Columna A: Ubicación
                            $results += [PSCustomObject]@{
                                Equipo = "$ubicacion"
                                Fecha  = $fechaFinal
                                Serie  = $sensorSerial
                            }
                            $sensoresEncontrados++
                        }
                    }
                    $workbook.Close($false)
                    $excel.Quit()
                    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
                    
                    continue # Siempre saltar fallback para archivos Excel en estas categorías
                }
            }
            catch {
                if ($excel) { $excel.Quit() }
            }
        }

        # 2. Fallbacks (Nombre de archivo o carpeta)
        if ($serie -eq "N/A" -or $serie -match "^[0-9a-f]{8}-") {
            if ($equipoBase -match "Centrifuga" -and $base -match "CENTRIF-(\d+)") { $serie = $Matches[1] }
            elseif ($base -match "#(\d+)") { $serie = $Matches[1] }
            elseif ($base -match "(\d{8,12})") { $serie = $Matches[1] }
            elseif ($base -match "^\d{4,6}$") { $serie = $base }
            elseif ($file.Directory.Name -match "^\d{4,6}$") { $serie = $file.Directory.Name }
            else { $serie = $base }
        }

        $results += [PSCustomObject]@{
            Equipo = $equipoBase
            Fecha  = $fechaFinal
            Serie  = $serie
        }
    }
}

# Limpiar duplicados y nulos. Priorizar los que tienen Fecha válida.
$finalData = $results | Where-Object { $_.Serie -match "^\d+$" -or ($_.Serie -ne "N/A" -and $_.Serie.Length -gt 2) } | 
Sort-Object -Property Serie, @{Expression = { if ($_.Fecha -eq "N/A") { 1 }else { 0 } } } | 
Group-Object Serie | ForEach-Object { $_.Group | Select-Object -First 1 } |
Sort-Object Serie

# Generar archivo data.js
$json = $finalData | ConvertTo-Json -Compress
"const equipmentData = $json;" | Out-File -FilePath $OutputPath -Encoding utf8

Write-Host "--- Proceso Completado ---" -ForegroundColor Green
Write-Host "Total Equipos: $($finalData.Count)"
Write-Host "Archivo generado: $OutputPath"
