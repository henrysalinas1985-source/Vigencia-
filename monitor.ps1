$watchPath = "C:\Users\hesalinas\Music\2025\DropZone"
$procesadoPath = "C:\Users\hesalinas\Music\2025\Procesados"
$scriptPath = "C:\Users\hesalinas\Music\2025\generar_dashboard.ps1"

Write-Host "--- Monitor de Relevamiento Activo ---" -ForegroundColor Cyan
Write-Host "Vigilando carpeta: $watchPath"
Write-Host "Los nuevos relevamientos se procesarǭn automǭticamente."

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $watchPath
$watcher.Filter = "*.*"
$watcher.IncludeSubdirectories = $false
$watcher.EnableRaisingEvents = $true

$action = {
    $path = $Event.SourceEventArgs.FullPath
    $name = $Event.SourceEventArgs.Name
    $changeType = $Event.SourceEventArgs.ChangeType
    
    if (Test-Path -Path $path -PathType Container) {
        Write-Host "Se detectó nueva carpeta: $name. Procesando..." -ForegroundColor Yellow
        
        # Esperar un momento para que termine la copia de archivos
        Start-Sleep -Seconds 5
        
        # Ejecutar el generador
        powershell -ExecutionPolicy Bypass -File $scriptPath -RootPath $path
        
        # Mover a procesados para mantener limpia la entrada
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        Move-Item -Path $path -Destination (Join-Path $procesadoPath "$($name)_$timestamp") -Force
        
        Write-Host "Proceso completado para $name. Dashboard actualizado." -ForegroundColor Green
    }
}

Register-ObjectEvent $watcher "Created" -Action $action

while ($true) {
    Start-Sleep -Seconds 1
}
