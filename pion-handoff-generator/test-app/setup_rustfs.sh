#!/bin/bash

# Este script descarga e instala RustFS como fue requerido.
echo "Iniciando descarga e instalación de RustFS..."
echo "Aviso: En Windows, ejecuta este script desde WSL o Git Bash."

# Ejecutar el comando de forma segura
curl -O https://rustfs.com/install_rustfs.sh && bash install_rustfs.sh

echo "Instalación completada. Por favor, asegúrate de levantar el servidor RustFS."
echo "Normalmente: ./rustfs server /data"
