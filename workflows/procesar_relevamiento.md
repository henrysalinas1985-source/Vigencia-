---
description: Cómo procesar una nueva carpeta de relevamiento automáticamente
---

Este flujo de trabajo permite actualizar el Dashboard con una nueva carpeta de investigación.

### Pasos a seguir:

1. **Preparar la Carpeta**: Asegúrate de que la nueva carpeta tenga una estructura similar a `Investigacion` (subcarpetas por tipo de equipo).
2. **Ejecutar el Proceso**:
   // turbo
   Ejecuta el siguiente comando en PowerShell, reemplazando `[RUTA_CARPETA]` con la ruta de tu nueva carpeta:
   ```powershell
   powershell -ExecutionPolicy Bypass -File C:\Users\hesalinas\Music\2025\generar_dashboard.ps1 -RootPath "[RUTA_CARPETA]"
   ```
3. **Ver Resultados**: Abre o recarga el archivo `index.html` en tu navegador. Los datos se habrán actualizado automáticamente.

> [!TIP]
> Si la carpeta tiene nombres consistentes (como '09-04-2025 - Oximetros'), la fecha se tomará de ahí. Si no, el script intentará leerla dentro de los certificados PDF.
