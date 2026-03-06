$root = "c:\Users\hesalinas\Music\2025\Investigacion"
$results = @()
$meses = @{
    "enero" = "01"; "febrero" = "02"; "marzo" = "03"; "abril" = "04";
    "mayo" = "05"; "junio" = "06"; "julio" = "07"; "agosto" = "08";
    "septiembre" = "09"; "octubre" = "10"; "noviembre" = "11"; "diciembre" = "12"
}

$subdirs = Get-ChildItem -Path $root -Directory
foreach ($dir in $subdirs) {
    # Extract Date: DD-MM-YYYY (Folder or File)
    $fecha = "N/A"
    if ($dir.Name -match "(\d{2}-\d{2}-\d{4})") {
        $fecha = $Matches[1] -replace "-", "/"
    }

    # Extract Equipo (strip date from start)
    $equipo = $dir.Name -replace "^\d{2}-\d{2}-\d{4}\s*(- )*", ""
    
    # Special case: If folder is just a serial number (like 34150), check parent or subfiles
    if ($equipo -match "^\d+$" -and $dir.Parent.Name -eq "Centrifugas") {
        $equipo = "Centrifuga"
    }

    # Find files, exclude obvious templates/instruments/safety certs
    $excludePatterns = @(
        "IC-OXI", "Contrastaci", "Instrumento", "Seguridad Electrica", 
        "Anemometro", "Contador", "Decibelimetro", "Fotometro", "Luxometro", 
        "Emery", "Registro de Conteo", "^SE\s", "^SE-", "Contrastaci"
    )
    
    $files = Get-ChildItem -Path $dir.FullName -Recurse -File -Include *.pdf, *.xlsx, *.xls | Where-Object {
        $fileName = $_.Name
        $fullPath = $_.FullName
        $match = $false
        foreach ($pattern in $excludePatterns) {
            if ($fileName -match $pattern -or $fullPath -match $pattern) { $match = $true; break }
        }
        -not $match
    }

    foreach ($file in $files) {
        $serie = "N/A"
        $base = [io.path]::GetFileNameWithoutExtension($file.Name)
        $fechaFinal = $fecha
        
        # A) Serial by priority
        if ($equipo -match "Centrifuga") {
            if ($base -match "^\d+$") { $serie = $base }
            elseif ($base -match "CENTRIF-(\d+)") { $serie = $Matches[1] }
            else { $serie = $base }
        }
        elseif ($equipo -match "Cabina|Bioseguridad") {
            if ($base -match "#(\d+)") { $serie = $Matches[1] }
            elseif ($dir.Name -match "^\d+$") { $serie = $dir.Name }
        }
        else {
            if ($base -match "(?:SN|TER-|EZ-)\s*(\d+)") { $serie = $Matches[1] }
            elseif ($base -match "(\d{8,12})") { $serie = $Matches[1] }
            else { $serie = $base }
        }

        # B) PDF extraction
        if ($file.Extension -eq ".pdf") {
            try {
                $content = Get-Content -Path $file.FullName -Raw -Encoding latin1 -ErrorAction SilentlyContinue
                
                # B1) Date
                if ($content -match "Fecha(?:\s+de\s+calibraci\w*)?:\s*(\d{1,2})\s*de\s*(\w+)\s*de\s*(\d{4})") {
                    $dia = $Matches[1].PadLeft(2, '0')
                    $mesNombre = $Matches[2].ToLower()
                    $anio = $Matches[3]
                    if ($meses.ContainsKey($mesNombre)) { $fechaFinal = "$dia/$($meses[$mesNombre])/$anio" }
                }
                elseif ($content -match "Fecha:\s*(\d{2}/\d{2}/\d{4})") { $fechaFinal = $Matches[1] }

                # B2) Serial fallback
                if ($serie -match "^\d{1,2}$" -or $serie -eq "N/A" -or $serie.Length -lt 3) {
                    if ($content -match "N. serie:\s*(\d+)") { $serie = $Matches[1] }
                    elseif ($content -match "#(\d+)") { $serie = $Matches[1] }
                }
            }
            catch {}
        }

        $results += [PSCustomObject]@{
            Folder  = $dir.Name
            Equipo  = $equipo
            Fecha   = $fechaFinal
            Serie   = $serie
            Archivo = $file.Name
        }
    }
}

$results | ConvertTo-Json
