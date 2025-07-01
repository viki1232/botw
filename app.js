const { createBot, createProvider, createFlow, addKeyword } = require('@bot-whatsapp/bot');
const schedule = require('node-schedule');
const QRPortalWeb = require('@bot-whatsapp/portal');
const BaileysProvider = require('@bot-whatsapp/provider/baileys');
const MongoAdapter = require('@bot-whatsapp/database/mongo');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require("openai");
require("dotenv").config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
// Importar funciones de Baileys
const { getContentType, downloadContentFromMessage } = require('@whiskeysockets/baileys');
const MONGO_DB_URI = 'mongodb://0.0.0.0:27017';
const MONGO_DB_NAME = 'db_bot';
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);
require('dotenv').config();

// o si usas require:
// const sdNotify = require('sd-notify');

// Configurar credenciales de Google Speech-to-Text
// Establece la variable de entorno para las credenciales
process.env.GOOGLE_APPLICATION_CREDENTIALS = './google-credentials.json';

const speech = require('@google-cloud/speech');
const client = new speech.SpeechClient();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


// Crear carpetas necesarias
if (!fs.existsSync('./temp')) {
    fs.mkdirSync('./temp');
}
if (!fs.existsSync('./audios')) {
    fs.mkdirSync('./audios');
}

// Función para procesar audio con el método correcto
async function procesarAudio(ctx) {
    try {
        console.log('🎵 Iniciando procesamiento de audio...');
        console.log('Estructura completa del ctx:', JSON.stringify(ctx, null, 2));
        
        let message = ctx.message?.message;
        
        // Si no hay message.message, pero hay audioMessage directamente
        if (!message && ctx.message?.audioMessage) {
            message = { audioMessage: ctx.message.audioMessage };
        }
        
        if (!message) {
            console.log('❌ No se encontró el mensaje en la estructura esperada');
            return null;
        }
        
        const type = getContentType(message);
        
        if (!type) {
            console.log('❌ No se pudo determinar el tipo de mensaje');
            console.log('Estructura del mensaje:', JSON.stringify(message, null, 2));
            return null;
        }
        
        console.log('✅ Tipo de mensaje detectado:', type);
        
        if (type !== 'audioMessage') {
            console.log('❌ El mensaje no es un audio');
            return null;
        }
        
        const content = message[type];
        
        try {
            console.log('📥 Descargando audio...');
            const stream = await downloadContentFromMessage(content, 'audio');
            let buffer = Buffer.from([]);
            
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }
            
            // Guardar el audio con timestamp
            const timestamp = Date.now();
            const audioPath = path.join('./audios', `audio-${timestamp}.ogg`);
            fs.writeFileSync(audioPath, buffer);
            console.log('✅ Audio descargado con éxito:', audioPath);
            
            // Convertir a WAV para Google Speech-to-Text
            const wavPath = path.join('./temp', `audio-${timestamp}.wav`);
            
            await new Promise((resolve, reject) => {
                ffmpeg(audioPath)
                    .toFormat('wav')
                    .audioChannels(1)
                    .audioFrequency(16000)
                    .on('end', () => {
                        console.log('✅ Conversión a WAV completada');
                        resolve();
                    })
                    .on('error', (err) => {
                        console.log('❌ Error en conversión:', err);
                        reject(err);
                    })
                    .save(wavPath);
            });
            
            // Transcribir con Google Speech-to-Text
             
            const audioData = fs.readFileSync(wavPath).toString('base64');
            
            const request = {
                audio: {
                    content: audioData,
                },
                config: {
                    encoding: 'LINEAR16',
                    sampleRateHertz: 16000,
                    languageCode: 'es-ES',
                    enableAutomaticPunctuation: true,
                },
            };
            
            console.log('🔊 Enviando a Google Speech-to-Text...');
            const [response] = await client.recognize(request);
            
            let transcription = '';
            if (response.results && response.results.length > 0) {
                transcription = response.results
                    .map(result => result.alternatives[0].transcript)
                    .join('\n');
                console.log('✅ Transcripción exitosa:', transcription);
            }
        
            
            // Placeholder temporal
            
            console.log('📝 Transcripción (placeholder):', transcription);
            
            // Limpiar archivo temporal WAV
            try {
                fs.unlinkSync(wavPath);
                console.log('🗑️ Archivo temporal eliminado');
            } catch (cleanupError) {
                console.log('⚠️ Error al limpiar:', cleanupError);
            }
            
            return transcription || null;
            
        } catch (error) {
            console.log('❌ Error en procesamiento de audio:', error);
            return null;
        }
        
    } catch (error) {
        console.error('❌ Error general:', error);
        console.log('Estructura completa del error:', error);
        return null;
    }
}


  // Puedes seguir agregando el resto...


const sesionesChat = {};

const flujoRespuestaIA = addKeyword('', { sensitive: true })
    .addAction(async (ctx, { flowDynamic, provider }) => {
        console.log('\n================== MENSAJE RECIBIDO ==================');
        console.log('📨 Fecha y hora:', new Date().toISOString());
        console.log('👤 De:', ctx.from);
        console.log('📝 ID del mensaje:', ctx.id);
        console.log('📄 Cuerpo (ctx.body):', ctx.body);
        console.log('📱 Tipo de mensaje:', ctx.message?.messageType);
        console.log('🎵 Audio presente:', !!ctx.message?.audioMessage);
        console.log('====================================================\n');
        
        let pregunta = ctx.body?.toLowerCase() || '';
        
        // Detectar audio
        const messageType = getContentType(ctx.message?.message);
        const isAudioEvent = ctx.body?.includes('_event_voice_note_');
        const hasAudioMessage = ctx.message?.audioMessage || ctx.message?.message?.audioMessage;
        
        console.log('Detección de audio:');
        console.log('- messageType:', messageType);
        console.log('- isAudioEvent:', isAudioEvent);
        console.log('- hasAudioMessage:', !!hasAudioMessage);
        
        // Si detectamos un audio, procesarlo
        if (messageType === 'audioMessage' || isAudioEvent || hasAudioMessage) {
            console.log('🎤 PROCESANDO AUDIO...');
            await flowDynamic('🎵 Estoy procesando tu audio...');
            
            const textoAudio = await procesarAudio(ctx);
            
            if (textoAudio && textoAudio.trim()) {
                pregunta = textoAudio.toLowerCase();
                console.log('✅ Texto del audio:', textoAudio);
                await flowDynamic(`📝 *He entendido:* "${textoAudio}"\n\n`);
            } else {
                await flowDynamic('⚠️ No pude procesar el audio. Intenta escribir tu mensaje.');
                return;
            }
        }
        
        if (!pregunta.trim()) {
            console.log('Sin pregunta válida');
            return;
        }
        
        // CONTEXTO personalizado
        const contexto = `
Eres un asistente experto en productos de limpieza de la empresa Smartlink.
Responde de forma breve y clara sobre estos productos. No inventes respuestas. No hables de temas fuera de limpieza.

Recuerda 4l es un galón y 20l es una caneca

Catálogo:
Crema Exfoliante Cuerpo, Manos y Pies: Exfolia y humecta la piel. Precio: $5.00 (400 ml), $10.00 (1000 ml), $35.00 (4500 ml). sin fragancia
Crema Exfoliante para Rostro: Limpia profundamente y remueve células muertas del rostro. Precio: $3.00 (100 ml)
Crema Hidratación Cuerpo, Manos y Pies: Hidrata y nutre la piel seca o maltratada. Precio: $6.00 (400 ml), $11.00 (1000 ml)
Crema Hidratación Intensiva para Cabello: Repara y nutre cabello dañado o maltratado. Precio: $7.00 (400 ml), $11.00 (1000 ml). sin fragancia
Almoral Crema Hidratante: Hidrata la piel dejándola suave y tersa. Precio: $2.00 (130 grs), $5.00 (450 grs)
Crema Limpiadora de Superficie: Para limpiar y proteger diversas superficies del hogar. Precio: $3.00 (330 grs), $9.00 (1100 grs)
Jabón Corporal C/Aloevera: Limpia y humecta la piel con propiedades del aloe vera. Precio: $2.00 (370 ml), $4.00 (1L), $12.00 (4L), $55.00 (20L). fragancia Avena
Jabón Antibacterial: Elimina gérmenes y bacterias de las manos y cuerpo. Precio: $1.00 (370 ml), $2.00 (1L), $7.00 (4L), $30.00 (20L). Frangancias: "Coco","Mandarina","Manzana verde","Manzanilla"
Gel Antibacterial: Limpieza de manos sin agua. Precio: $2.00 (370 ml), $4.00 (1L), $14.00 (4L). sin fragancia
Gel Mentolado: Gel refrescante con aroma a mentol para masajes. Precio: $7.00 (1L), $25.00 (4L)
Shampoo de Avena: Limpia y nutre el cabello con propiedades de la avena. Precio: $2.00 (370 ml), $3.50 (750 ml), $4.00 (1L), $12.00 (4L), $55.00 (20L). Fragancia avena
Shampoo Antiresiduo: Elimina acumulación de productos en el cabello. Precio: $1.50 (370 ml), $2.50 (1L), $8.00 (4L), $35.00 (20L). Fragancia cítrica
Shampoo con Aloe Vera: Limpia y fortalece el cabello con propiedades del aloe vera. Precio: $2.00 (370 ml), $4.00 (750 ml), $4.00 (1L), $15.00 (4L), $70.00 (20L). Fragancia frutal
Shampoo Aloe Vera sin Sal: Ideal para cabellos tratados químicamente, sin sal. Precio: $3.00 (370 ml), $6.00 (750 ml), $7.00 (1L), $20.00 (4L), $80.00 (20L). Fragancia manzanilla y miel
Alcohol Común 70%: Desinfectante para superficies y manos. Precio: $3.00 (1L), $10.00 (4L), $45.00 (20L)
Alcohol Mentolado 70% Menticol: Desinfectante con aroma refrescante a mentol. Precio: $3.50 (1L), $12.00 (4L), $50.00 (20L)
Alcohol Común 96%: Para desinfección y uso médico. Precio: $4.00 (1L), $13.00 (4L), $60.00 (20L)
Alcohol Industrial 98%: Para uso industrial y limpieza profunda. Precio: $5.50 (1L), $17.00 (4L), $80.00 (20L)
Limpia Vidrio: Limpia vidrios y espejos sin dejar marcas. Precio: $2.00 (600 ml spray), $2.00 (1L), $6.00 (4L), $25.00 (20L). sin fragancia
Desinfectante: Elimina bacterias y gérmenes de superficies. Precio: $1.50 (600 ml), $1.50 (1L), $5.00 (4L), $22.00 (20L). tiene las siguientes fragancias:"Alegría","Árbol de navidad","Bambú","Bouquet","Cariño","Cerezo","Chavela","Cielo","Eucalipto","Floral","Lavanda","Mango","Manzana Canela","Manzana verde","Maracuyá", "Navidad","Pasión","Pera-Manzana"
Desinfectante Cera: Desinfecta y da brillo a superficies. Precio: $3.00 (1L), $9.00 (4L), $40.00 (20L). tiene  las siguientes fragancias:"Alegría", "Almendra","Árbol de Navidad","Avena", "Bambú", "Bastón de Navidad", 
                    "Brave Musk", "Brizza", "Bombum", "Bosque", "Bouquet", "Café", "Cariño", 
                    "Carro nuevo", "Cerezo", "Chavela", "Cherry", "Chocolate caliente", "Cielo", "Coco", 
                    "Eucalipto", "Floral", "Fresa", "Galleta de jengibre", "Gentleman", "Lavanda", 
                    "Limón", "Mandarina", "Mango", "Manzana canela", "Manzana verde", "Manzanilla", 
                    "Manzanilla y miel", "Maracuyá", "Menta", "Naranja", "Navidad", "Nochebuena", 
                    "Ortiga", "Pan de Pascua", "Pasión", "Pera", "Pera-manzana", "Perla", "Pitahaya", 
                    "Ponche", "Sándalo", "Sandía", "Stella", "Tofee", "Uva", "Vainilla", 
                    "Vainilla Oriental", "Victoria Amor"
Desengrasante Biodegradable: Elimina grasa respetando el medio ambiente. Precio: $2.00 (600 ml), $2.00 (1L), $6.00 (4L), $25.00 (20L)
Desengrasante Industrial: Elimina grasa de cocina, horno, campana y parrilla. Precio: $3.50 (1L),r $11.00 (4L), $50.00 (20L)
Desengrasante para Mecánico: Especial para remover grasa y aceite de motores. Precio: $2.50 (1L), $8.00 (4L), $35.00 (20L)
Detergente Líquido para Ropa: Para lavar ropa a mano o en lavadora. Precio: $2.50 (1L), $9.00 (4L), $40.00 (20L). fragancia Perla
Difusores electricos: Para aromatizar espacios. Precio: $20.00.
Blanqueador para Ropa Base Cloro: Blanquea y desinfecta la ropa. Precio: $2.00 (1L), $5.00 (4L), $22.00 (20L)
Blanqueador de Ropa en Polvo: Elimina manchas difíciles. Precio: $3.50 (450 grs), $9.00 (1150 grs)
Suavizante de Ropa: Deja la ropa suave y perfumada. Precio: $2.50 (1L), $9.00 (4L), $40.00 (20L). Fragancia Perla
Cloro 5%: Para desinfección general. Precio: $1.00 (1L), $3.00 (4L), $13.00 (20L). sin fragancia
Cloro 10%: Mayor concentración para limpieza profunda. Precio: $2.00 (1L), $6.00 (4L), $26.00 (20L). sin fragancia
Cloro Jabonoso: Limpia y desinfecta baños, pisos y cocinas. Precio: $2.00 (1L), $4.50 (4L), $20.00 (20L). sin fragancia
Lavaplatos en Crema: Limpia y desengrasa platos y utensilios. Precio: $2.25 (800 gr), $15.00 (7 kls). fragancia limon
Lavaplatos Líquido: Para lavar platos a mano. Precio: $2.50 (1L), $8.00 (4L), $35.00 (20L). fragancia Naranja
Fragancia Automotriz: Aroma duradero para vehículos. Precio: $1.50 (8 ml), $6.00 (120 ml). Tiene las siguientes fragancias:"Alegría", "Almendra","Árbol de Navidad","Avena", "Bambú", "Bastón de Navidad", 
                    "Brave Musk", "Brizza", "Bombum", "Bosque", "Bouquet", "Café","canela", "Cariño", 
                    "Carro nuevo", "Cerezo", "Chavela", "Cherry", "Chocolate caliente", "Cielo", "Coco", 
                    "Eucalipto", "Floral", "Fresa", "Galleta de jengibre", "Gentleman", "Lavanda", 
                    "Limón", "Mandarina", "Mango", "Manzana canela", "Manzana verde", "Manzanilla", 
                    "Manzanilla y miel", "Maracuyá", "Menta", "Naranja", "Navidad", "Nochebuena", 
                    "Ortiga", "Pan de Pascua", "Pasión", "Pera", "Pera-manzana", "Perla", "Pitahaya", 
                    "Ponche", "Sándalo", "Sandía", "Stella", "Tofee", "Uva", "Vainilla", 
                    "Vainilla Oriental", "Victoria Amor","X-mas"

Fragancia para Difusor: Recarga para difusores. Precio: $3.00 (20 ml), $12.00 (120 ml). tiene las siguientes fragancias:
                    "Alegría", "Almendra","Árbol de Navidad","Avena", "Bambú", "Bastón de Navidad", 
                    "Brave Musk", "Brizza", "Bombum", "Bosque", "Bouquet", "Café", "Cariño", 
                    "Carro nuevo", "Cerezo", "Chavela", "Cherry", "Chocolate caliente", "Cielo", "Coco", 
                    "Eucalipto", "Floral", "Fresa", "Galleta de jengibre", "Gentleman", "Lavanda", 
                    "Limón", "Mandarina", "Mango", "Manzana canela", "Manzana verde", "Manzanilla", 
                    "Manzanilla y miel", "Maracuyá", "Menta", "Naranja", "Navidad", "Nochebuena", 
                    "Ortiga", "Pan de Pascua", "Pasión", "Pera", "Pera-manzana", "Perla", "Pitahaya", 
                    "Ponche", "Sándalo", "Sandía", "Stella", "Tofee", "Uva", "Vainilla", 
                    "Vainilla Oriental", "Victoria Amor"

Fragancia de Varilla Bambu: Aromatiza espacios mediante varillas. Precio: $4.00 (50 ml), $6.00 (120 ml). Tiene las siguientes fragancias: "Alegría", "Almendra","Árbol de Navidad","Avena", "Bambú", "Bastón de Navidad", 
                    "Brave Musk", "Brizza", "Bombum", "Bosque", "Bouquet", "Café","Canela", "Cariño", 
                    "Carro nuevo", "Cerezo", "Chavela", "Cherry", "Chocolate caliente", "Cielo", "Coco", 
                    "Eucalipto", "Floral", "Fresa", "Galleta de jengibre", "Gentleman", "Lavanda", 
                    "Limón", "Mandarina", "Mango", "Manzana canela", "Manzana verde", "Manzanilla", 
                    "Manzanilla y miel", "Maracuyá", "Menta", "Naranja", "Navidad", "Nochebuena", 
                    "Ortiga", "Pan de Pascua", "Pasión", "Pera", "Pera-manzana", "Perla", "Pitahaya", 
                    "Ponche", "Sándalo", "Sandía", "Stella", "Tofee", "Uva", "Vainilla", 
                    "Vainilla Oriental", "Victoria Amor"

Fragancia en Splash: Aroma en spray para textiles. Precio: $4.00 (125 ml spray). Tiene las siguientes fragancias:"Alegría", "Almendra","Árbol de Navidad","Avena", "Bambú", "Bastón de Navidad", 
                    "Brave Musk", "Brizza", "Bombum", "Bosque", "Bouquet", "Café","canela", "Cariño", 
                    "Carro nuevo", "Cerezo", "Chavela", "Cherry", "Chocolate caliente", "Cielo", "Coco", 
                    "Eucalipto", "Floral", "Fresa", "Galleta de jengibre", "Gentleman", "Lavanda", 
                    "Limón", "Mandarina", "Mango", "Manzana canela", "Manzana verde", "Manzanilla", 
                    "Manzanilla y miel", "Maracuyá", "Menta", "Naranja", "Navidad", "Nochebuena", 
                    "Ortiga", "Pan de Pascua", "Pasión", "Pera", "Pera-manzana", "Perla", "Pitahaya", 
                    "Ponche", "Sándalo", "Sandía", "Stella", "Tofee", "Uva", "Vainilla", 
                    "Vainilla Oriental", "Victoria Amor","X-más"

Fragancia para Rociadores y Splash: Aromas para ambientes. Precio: $3.00 (120 ml), $5.50 (240 ml), $10.00 (500 ml), $18.00 (1L), $65.00 (4L)
Almoral Líquido para Spray con Fragancia: Aromatizador ambiental. Precio: $3.00 (220 ml), $7.00 (1L), $25.00 (4L)
Almoral Para Llantas: Da brillo y protección a las llantas. Precio: $4.00 (220 ml)
Amonio Cuaternario: Desinfectante de amplio espectro. Precio: $3.00 (1L), $10.00 (4L), $45.00 (20L). Sin fragancia
Antisarro: Elimina sarro y residuos de minerales. Precio: $3.50 (1L), $12.00 (4L). sin fragancia
Bicarbonato de Sodio: Múltiples usos de limpieza. Precio: $4.00 (500 grs). sin fragancia
Cera Líquida: Protege y da brillo a superficies. Precio: $3.00 (1L), $10.00 (4L), $45.00 (20L)
Velas para Masaje Mentolada: Para masajes relajantes. Precio: $6.00 (100 ml), $8.50 (150 ml)
Fundas para Basura (varios tamaños): Para recolección de desechos. Precios desde $0.60 hasta $3.70 según tamaño y cantidad. 

Pregunta del cliente:
"${pregunta}"

Reglas generales:

Responde solo si la pregunta está relacionada con productos de limpieza.

Sé breve, directo y claro.

Usa emojis relacionados con limpieza (ej: 🧼🧽🧴✨).

Intenta siempre tratar de vender, no te quedes nunca callado, se amable y responda con lo que sepas.
nunca digas que no tienes informacion sbre el tema, con lo que tenemos en la base de datos responde.



---

Catálogo

Si piden el catálogo, responde:
"Sigue este enlace para ver nuestro catálogo en WhatsApp: https://wa.me/c/593998081000 🧴🧽✨"



---

Información o comprar

Si piden info o quieren comprar, responde directamente con la info clara y precisa.



---

Hablar con un encargado

Si piden hablar con alguien:
"Un momento, por favor... Gracias por contactar a un encargado. Estará contigo en breve, normalmente en unos minutos 🧼."



---

Entregas a domicilio:

Solo hacemos entregas en Quito desde Carcelén hasta La Patria El Ejido.


Si preguntan por otros sectores y compran más de $100:
"Podemos hacer el envío a tu sector si la compra supera los $100, pero debe pagarse por adelantado 💵🧴."


---

Pago:

Métodos aceptados: transferencia, DeUna, efectivo.

Todo pedido se paga por adelantado, ya sea cliente nuevo o frecuente.



---

Confirmación de pedido:

Si confirman compra y no han enviado ubicación, responde:
"Por favor, mándanos tu ubicación por Google Maps para coordinar la entrega 📍, o avísame si prefieres retirar en nuestra oficina 🧼. Indícanos también el método de pago que vas a usar 💵."
si no sabes si la ubicacion esta dentro de la zona de entrega manda un mensaje de que lo vas a pasar con un encargado.

Cuando el cliente confirma el pago, responde:
"Perfecto, te voy a poner en contacto con el encargado para que coordine la entrega 🧽."


---

Descuentos:

Solo hay descuentos para personas que vienen al local, 20% de descuento, sea al por mayor o no.

No hay descuentos al por mayor.

Compra al por mayor: desde $100 en adelante.



---

Otros datos clave:

Hacemos marca blanca.

Damos descuento a distribuidores.

Suavizante y detergente son hipoalergénicos 🧼.

No se paga en cuotas, solo al contado.

Productos con diferente fragancia cuestan lo mismo.

Difusores y fundas no tienen fragancia porque son de plástico.

Podemos hacer fragancias personalizadas, solo para compras al por mayor.

No hay límite de compra.

Tenemos 8 años en el mercado.



---
sin ofertas actuales.

---

Horario de atención del local:

Lunes a sábado, de 10:00 a.m. a 6:00 p.m.


---

Medios no textuales:

Si el usuario manda sticker, audio o video responde amablemente.

Si se despiden, responde de forma natural y amable.


si te preguntan comparacion entre productos investiga y responde con lo que sepas

si ponen palabras que se relacionen con los productos dale la informacion del producto

cuando te hagan pedidos si puedes hacer los mensajes largos con todos los productos que te pidan, agregando el total

si preguntan la direccion o palabra parecida sobre donde se encuentra el local manda esto: https://maps.app.goo.gl/DP2p6AH2M3sUpkEf6


`;

try {

    const numero = ctx.from;
    let respuesta;
    const MAX_HISTORIAL = 10; // <- Declaración aquí arriba

    if (!sesionesChat[numero]) {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: contexto },
                { role: "user", content: pregunta }
            ],
            temperature: 0.4,
            max_tokens: 500,
        });

        respuesta = response.choices[0].message.content.trim(); // <- Asignación
        sesionesChat[numero] = {
            contexto,
            historial: [
                { role: "system", content: contexto },
                { role: "user", content: pregunta },
                { role: "assistant", content: respuesta }
            ]
        };
    } else {
        const chat = sesionesChat[numero];
        chat.historial.push({ role: "user", content: pregunta });

    // Limitar historial para que no crezca demasiado
        if (chat.historial.length > MAX_HISTORIAL) {
            chat.historial = chat.historial.slice(chat.historial.length - MAX_HISTORIAL);
        }

    // Llamada a OpenAI
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: chat.historial,
            temperature: 0.4,
            max_tokens: 500,
        });

        respuesta = response.choices[0].message.content.trim();
        chat.historial.push({ role: "assistant", content: respuesta });
    }

    console.log('🧠 Respuesta IA:', respuesta);
    await flowDynamic(respuesta);
    actividad();
} catch (error) {
    console.error('❌ Error al obtener respuesta de la IA:', error);
    await flowDynamic('⚠️ Ocurrió un error al responder tu pregunta.');
    
}
});

  


const main = async () => {
    const adaptorDB = new MongoAdapter({
        dbUri: MONGO_DB_URI,
        dbName: MONGO_DB_NAME,
    });

    

    const adaptorFlow = createFlow([flujoRespuestaIA]);

    let esperandoRespuesta = false;
    let temporizadorReinicio = null;
    let ultimaActividad = Date.now();

    function actividad() {
        esperandoRespuesta = false;
        if (temporizadorReinicio) clearTimeout(temporizadorReinicio);
        ultimaActividad = Date.now();
    }

    function onMensajeEntrante(ctx) {
        esperandoRespuesta = true;

        temporizadorReinicio = setTimeout(() => {
            if (esperandoRespuesta) {
                console.error("❌ El bot no respondió al mensaje, reiniciando...");
                process.exit(1); // reinicio automático por systemd
            }
        }, 20000); // espera 10 segundos
    }
     const adaptorProvider = createProvider(BaileysProvider, {
        onMessage: async (ctx) => {
            onMensajeEntrante(ctx); // vigila si responde
            actividad();            // actualiza actividad
        },
    });

    await createBot({
        flow: adaptorFlow,
        provider: adaptorProvider,
        database: adaptorDB,
    });

    console.log('Bot iniciado correctamente y conectado a WhatsApp');
    QRPortalWeb({ port: 3000 });
};

main();
// ...existing code...