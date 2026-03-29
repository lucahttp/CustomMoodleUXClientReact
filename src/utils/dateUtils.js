const ZOOM_DATE_REGEX = /([A-Z][a-z]+), (\d{1,2}) de ([A-Z][a-z]+) de (\d{4}) - (\d{2}):(\d{2})/i;

const MESES = {
  'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
  'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11,
  'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
  'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11
};

export function parseZoomDate(nombreClase) {
  const match = nombreClase.match(ZOOM_DATE_REGEX);
  
  if (!match) {
    return null;
  }
  
  const [, diaSemana, dia, mesNombre, anio, hora, minuto] = match;
  const mesIndex = MESES[mesNombre.toLowerCase()] ?? MESES[mesNombre.toLowerCase().substring(0, 3)];
  
  const fecha = new Date(
    parseInt(anio),
    mesIndex,
    parseInt(dia),
    parseInt(hora),
    parseInt(minuto)
  );
  
  return {
    fecha,
    diaSemana,
    dia: parseInt(dia),
    mes: mesNombre,
    anio: parseInt(anio),
    hora: parseInt(hora),
    minuto: parseInt(minuto),
    timestamp: fecha.getTime(),
    esPasada: fecha.getTime() < Date.now(),
    esHoy: esHoyMismo(fecha),
    esManiana: esManianaMismo(fecha)
  };
}

function esHoyMismo(fecha) {
  const hoy = new Date();
  return fecha.getDate() === hoy.getDate() &&
    fecha.getMonth() === hoy.getMonth() &&
    fecha.getFullYear() === hoy.getFullYear();
}

function esManianaMismo(fecha) {
  const maniana = new Date();
  maniana.setDate(maniana.getDate() + 1);
  return fecha.getDate() === maniana.getDate() &&
    fecha.getMonth() === maniana.getMonth() &&
    fecha.getFullYear() === maniana.getFullYear();
}

export function formatearFechaClase(fechaInfo) {
  if (!fechaInfo) return '';
  
  if (fechaInfo.esHoy) return `Hoy a las ${pad(fechaInfo.hora)}:${pad(fechaInfo.minuto)}`;
  if (fechaInfo.esManiana) return `Mañana a las ${pad(fechaInfo.hora)}:${pad(fechaInfo.minuto)}`;
  
  return `${fechaInfo.diaSemana} ${fechaInfo.dia} de ${fechaInfo.mes} a las ${pad(fechaInfo.hora)}:${pad(fechaInfo.minuto)}`;
}

function pad(num) {
  return num.toString().padStart(2, '0');
}

export function agruparClasesPorFecha(clases) {
  const pasadas = [];
  const futuras = [];
  const sinFecha = [];
  
  clases.forEach(clase => {
    const fechaInfo = parseZoomDate(clase.name);
    if (!fechaInfo) {
      sinFecha.push(clase);
    } else if (fechaInfo.esPasada) {
      pasadas.push({ ...clase, fechaInfo });
    } else {
      futuras.push({ ...clase, fechaInfo });
    }
  });
  
  // Ordenar: más reciente primero para pasadas, más cercano primero para futuras
  pasadas.sort((a, b) => b.fechaInfo.timestamp - a.fechaInfo.timestamp);
  futuras.sort((a, b) => a.fechaInfo.timestamp - b.fechaInfo.timestamp);
  
  return { pasadas, futuras, sinFecha };
}