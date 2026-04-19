#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const targetDir = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : process.cwd();

console.log(`🚀 Inicializando proyecto Pion/Handoff en: ${targetDir}`);

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Resolver rutas de plantillas (asumiendo que las plantillas están en ../templates relativas a este JS)
const templatesDir = path.join(__dirname, '..', 'templates');

function copyTemplate(templateName, destName) {
  const src = path.join(templatesDir, templateName);
  const dest = path.join(targetDir, destName || templateName);
  try {
    const content = fs.readFileSync(src, 'utf-8');
    fs.writeFileSync(dest, content, 'utf-8');
    console.log(`✅ Creado: ${destName || templateName}`);
  } catch (err) {
    console.error(`❌ Error al copiar ${templateName}:`, err.message);
  }
}

// Copiar archivos
const filesToScaffold = [
  'package.json',
  'server.js',
  'mcp.js',
  'storage.js',
  'db.js',
  'setup_rustfs.sh'
];

filesToScaffold.forEach(file => copyTemplate(file));

console.log('\n📦 Instalando dependencias básicas...');
try {
  execSync('npm install', { stdio: 'inherit', cwd: targetDir });
  console.log('✅ Dependencias instaladas con éxito.');
} catch (e) {
  console.error('⚠️ Advertencia: No se pudieron instalar las dependencias automáticamente.');
}

console.log(`
🎉 ¡Proyecto generado con éxito!

Siguientes pasos:
1. cd ${process.argv[2] || '.'}
2. Revisa la configuración de puertos en server.js.
3. Para iniciar la base de datos S3 RustFS, inspecciona y ejecuta:
   $ bash setup_rustfs.sh
4. Para levantar la API REST y Servidor MCP:
   $ npm run start

`);
