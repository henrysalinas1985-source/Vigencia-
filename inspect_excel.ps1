$excelPath = "C:\Users\hesalinas\Music\2025\Investigacion\Mondis\DATALOGGER\mp CEN-DATCSL.xlsx"
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$workbook = $excel.Workbooks.Open($excelPath)
$sheet = $workbook.Sheets.Item(1)

Write-Host "--- Buscando encabezado 'Sensor' en $excelPath ---"
$foundRow = -1
$foundCol = -1

for ($row = 1; $row -le 250; $row++) {
    for ($col = 1; $col -le 20; $col++) {
        $val = $sheet.Cells.Item($row, $col).Text
        if ($val -like "*Sensor*") {
            Write-Host "Encontrado '$val' en Fila $($row), Columna $($col)"
            if ($val -eq "Sensor" -or $val -eq "Ubicación Sensor") {
                $foundRow = $row
                $foundCol = $col
            }
        }
    }
}

if ($foundRow -ne -1) {
    Write-Host "`n--- Datos alrededor del hallazgo (Fila $($foundRow)) ---"
    for ($r = $foundRow; $r -le ($foundRow + 20); $r++) {
        $foundData = $false
        $line = ""
        for ($c = 1; $c -le 15; $c++) {
            $val = $sheet.Cells.Item($r, $c).Text
            if ($val -and $val.Trim() -ne "") { $foundData = $true }
            $line += "[$($val)] "
        }
        if ($foundData) {
            Write-Host "Fila $($r): $($line)"
        }
    }
}

$workbook.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
