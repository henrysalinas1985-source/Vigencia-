import os
import re
import json

root_dir = r"c:\Users\hesalinas\Music\2025\Investigacion"
extracted_data = []

# Date pattern: DD-MM-YYYY
date_pattern = re.compile(r"(\d{2}-\d{2}-\d{4})")
# Serial pattern: Long numbers or prefixed numbers
serial_pattern = re.compile(r"(\d{8,})")
sn_pattern = re.compile(r"(?:SN|TER-|EZ-)\s*(\d+)")

# Month mapping for date conversion
months_map = {
    "enero": "01", "febrero": "02", "marzo": "03", "abril": "04",
    "mayo": "05", "junio": "06", "julio": "07", "agosto": "08",
    "septiembre": "09", "octubre": "10", "noviembre": "11", "diciembre": "12"
}

for folder in os.listdir(root_dir):
    folder_path = os.path.join(root_dir, folder)
    if not os.path.isdir(folder_path):
        continue
    
    # Base info from folder name
    date_match = date_pattern.search(folder)
    fecha = date_match.group(1).replace("-", "/") if date_match else "N/A"
    
    # Strip date from folder name to get equipo
    equipo = re.sub(r"^\d{2}-\d{2}-\d{4}\s*(- )*", "", folder)
    
    # Walk through files
    for root, dirs, files in os.walk(folder_path):
        # Skip 'Instrumento' or 'Excel' subfolders if they just contain duplicates
        for file in files:
            if not file.lower().endswith(('.pdf', '.xlsx', '.xls')):
                continue
            
            # Skip restricted patterns
            exclude_keywords = [
                "IC-OXI", "Contrastación", "Instrumento", "Seguridad Electrica",
                "Anemometro", "Contador", "Decibelimetro", "Fotometro", "Luxometro",
                "Emery", "Registro de Conteo", "Contrastaci"
            ]
            if any(k in file or k in root for k in exclude_keywords):
                continue
            if file.startswith(("SE ", "SE-")):
                continue

            file_base = os.path.splitext(file)[0]
            serie = "N/A"
            fecha_final = fecha
            equipo_final = equipo

            # A) Serial by priority
            if "centrifuga" in equipo.lower():
                if re.match(r"^\d+$", file_base): serie = file_base
                elif "CENTRIF-" in file_base: serie = file_base.split("CENTRIF-")[-1]
                else: serie = file_base
            elif any(k in equipo.lower() for k in ["cabina", "bioseguridad"]):
                match = re.search(r"#(\d+)", file_base)
                if match: serie = match.group(1)
                elif re.match(r"^\d+$", os.path.basename(root)): serie = os.path.basename(root)
            else:
                sn_match = sn_pattern.search(file_base)
                if sn_match: serie = sn_match.group(1)
                else:
                    hash_match = re.search(r"#(\d+)", file_base)
                    if hash_match: serie = hash_match.group(1)
                    else:
                        num_match = re.search(r"(\d{8,12})", file_base)
                        if num_match: serie = num_match.group(1)
                        else: serie = file_base

            # B) PDF extraction
            if file.lower().endswith('.pdf'):
                try:
                    with open(os.path.join(root, file), 'rb') as f:
                        content = f.read().decode('latin-1', errors='ignore')
                        
                        # Date
                        long_date_match = re.search(r"Fecha(?:\s+de\s+calibraci\w*)?:\s*(\d{1,2})\s*de\s*(\w+)\s*de\s*(\d{4})", content, re.IGNORECASE)
                        if long_date_match:
                            dia = long_date_match.group(1).zfill(2)
                            mes_nombre = long_date_match.group(2).lower()
                            anio = long_date_match.group(3)
                            if mes_nombre in months_map:
                                fecha_final = f"{dia}/{months_map[mes_nombre]}/{anio}"
                        else:
                            fecha_match = re.search(r"Fecha:\s*(\d{2}/\d{2}/\d{4})", content)
                            if fecha_match:
                                fecha_final = fecha_match.group(1)
                        
                        # Serial fallback
                        if serie == "N/A" or len(serie) < 3:
                            sn_match = re.search(r"N\. [sS]erie:\s*(\d+)", content)
                            if sn_match: serie = sn_match.group(1)
                            else:
                                hash_match = re.search(r"#(\d+)", content)
                                if hash_match: serie = hash_match.group(1)
                except:
                    pass

            extracted_data.append({
                "Folder": folder,
                "Equipo": equipo_final,
                "Fecha": fecha_final,
                "Serie": serie,
                "File": file
            })

print(json.dumps(extracted_data, indent=2))
