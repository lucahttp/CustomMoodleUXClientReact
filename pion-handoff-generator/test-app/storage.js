const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
require('dotenv').config();

// Configuración S3 conectada hacia RustFS
// RustFS es 100% compatible con S3. Generalmente expone puertos por defecto locales.
const s3Config = {
    endpoint: process.env.RUSTFS_ENDPOINT || "http://127.0.0.1:9000",
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.RUSTFS_ACCESS_KEY || "rustfsadmin", // Ajustar tras montar auth real
      secretAccessKey: process.env.RUSTFS_SECRET_KEY || "rustfsadmin",
    },
    forcePathStyle: true,
};

const s3Client = new S3Client(s3Config);

/**
 * Sube datos (ej. grabaciones de sesiones robadas de WebRTC handoff) a RustFS.
 */
async function uploadData(bucket, key, bodyData) {
    try {
        const command = new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: bodyData,
            ContentType: "application/octet-stream"
        });

        await s3Client.send(command);
        console.log(`[Storage] Objeto ${key} subido exitosamente a RustFS (${bucket}).`);
        return `${s3Config.endpoint}/${bucket}/${key}`;
    } catch (e) {
        console.error("Error subiendo datos a S3 (RustFS):", e);
        throw e;
    }
}

module.exports = {
    s3Client,
    uploadData
}
