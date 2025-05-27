const { createBot, createProvider, createFlow, addKeyword } = require('@bot-whatsapp/bot');
const schedule = require('node-schedule');
const QRPortalWeb = require('@bot-whatsapp/portal');
const BaileysProvider = require('@bot-whatsapp/provider/baileys');
const MongoAdapter = require('@bot-whatsapp/database/mongo');
const fs = require('fs');
const path = require('path');

const { GoogleGenerativeAI } = require('@google/generative-ai');
// Importar funciones de Baileys
const { getContentType, downloadContentFromMessage } = require('@whiskeysockets/baileys');
const MONGO_DB_URI = 'mongodb://0.0.0.0:27017';
const MONGO_DB_NAME = 'db_bot';
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);

// Configurar credenciales de Google Speech-to-Text
// Establece la variable de entorno para las credenciales
process.env.GOOGLE_APPLICATION_CREDENTIALS = './google-credentials.json';

const speech = require('@google-cloud/speech');
const client = new speech.SpeechClient();
const API_KEY = 'AIzaSyDpQYRzsBqcwimiZteaSXrg-DFj7fJccEg';
const MODEL = 'gemini-2.0-flash';

const genAI = new GoogleGenerativeAI(API_KEY);

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

const contactos = [
    { nombre: "Alessandra", numero: "593991689279" },
    { nombre: "Mery", numero: "593962655494" },
    { nombre: "Jose", numero: "593993442528" },
    { nombre: "Maria", numero: "593939865489" },
    { nombre: "Gabriel", numero: "593962916247" },
    { nombre: "Lili", numero: "593994063704" },
    { nombre: "Yolanda", numero: "593969435888" },
    { nombre: "Susana", numero: "593997940663" },
    { nombre: "Natalie", numero: "593998045512" },
    { nombre: "Ivan", numero: "593985605827" },
    { nombre: "Julio", numero: "593998484956" },
    { nombre: "Ariel", numero: "593992621524" },
    { nombre: "Jose", numero: "593963722673" },
    { nombre: "Ana", numero: "593960539728" },
    { nombre: "Ana", numero: "593978777915" },
    { nombre: "Fernando", numero: "593984199160" },
    { nombre: "Nicole", numero: "593995063211" },
    { nombre: "Estimado Cliente Hacienda los Arrieros", numero: "593984636606" },
    { nombre: "Patricio", numero: "593999193858" },
    { nombre: "Lupita", numero: "593995679417" },
    { nombre: "Vanessa", numero: "593961351352" },
    { nombre: "Jesus", numero: "593984858024" },
    { nombre: "Michael", numero: "593981517703" },
    { nombre: "Olimar", numero: "593992875076" },
    { nombre: "Said", numero: "593963693851" },
    { nombre: "Vivian", numero: "593994003887" },
    { nombre: "Guadalupe", numero: "593995386024" },
    { nombre: "Valentina", numero: "593984992954" },
    { nombre: "Gabriela", numero: "593960888017" },
    { nombre: "Juan Pablo", numero: "593992728321" },
    { nombre: "Sashar", numero: "593964113650" },
    { nombre: "Erick", numero: "593984981532" },
    { nombre: "Diego", numero: "593987480081" },
    { nombre: "Alan", numero: "593978823867" },
    { nombre: "David", numero: "593995764194" },
    { nombre: "Juan", numero: "593995275553" },
    { nombre: "Rita", numero: "593987030605" },
    { nombre: "Fernanda", numero: "593979036463" },
    { nombre: "Mayerli", numero: "593960147645" },
    { nombre: "Alberto", numero: "593997442092" },
    { nombre: "Sabrina", numero: "593987052726" },
    { nombre: "Stalin", numero: "593994715645" },
    { nombre: "Angel", numero: "593993331009" },
    { nombre: "Adriana", numero: "593987336142" },
    { nombre: "Sebastian", numero: "593985475973" },
    { nombre: "Mayola", numero: "593983044695" },
    { nombre: "Gabriel", numero: "593987006152" },
    { nombre: "Madmud", numero: "593958885385" },
    { nombre: "Cecilia", numero: "593987295137" },
    { nombre: "Washington", numero: "593995758394" },
    { nombre: "Lucia", numero: "593983165159" },
    { nombre: "Daniel", numero: "593984604205" },
    { nombre: "Andrea", numero: "593999918333" },
    { nombre: "Antonieta", numero: "593989937994" },
    { nombre: "Mery", numero: "593987023961" },
    { nombre: "Santiago", numero: "593993630066" },
    { nombre: "Isabel", numero: "593963528947" },
    { nombre: "Jessica", numero: "593984076858" },
    { nombre: "Isidro", numero: "593984555633" },
    { nombre: "Ariel", numero: "593995173667" },
    { nombre: "Miley", numero: "593968164027" },
    { nombre: "Andrea", numero: "593998319172" },
    { nombre: "Grace", numero: "593994020049" },
    { nombre: "Monica", numero: "593987603292" },
    { nombre: "Consuelo", numero: "593998696391" },
    { nombre: "Hugo", numero: "593996076644" },
    { nombre: "Bairo", numero: "593999729878" },
    { nombre: "Sres, Colombia Arepa", numero: "593985475973" },
    { nombre: "Jesus", numero: "593962982326" },
    { nombre: "Mayola", numero: "593983044695" },
    { nombre: "Yoxi", numero: "593969767956"},
    { nombre: "Beatriz", numero: "593986938105"},
    { nombre: "Jaime", numero: "593999743816"},
    { nombre: "Romy", numero: "593996429924"},
    { nombre: "Luis", numero: "593979007059"},
    { nombre: "Viviana", numero: "593992882651"},
    { nombre: "Enrique", numero: "593980182028"},
    { nombre: "Gema", numero: "593963229072"},
    { nombre: "Dariana", numero: "593963722100"},
    { nombre: "Alberto", numero: "593992718035"},
    { nombre: "Magaly", numero: "593982278980"},
    { nombre: "Sandy", numero: "593987330019"},
    { nombre: "Nancy", numero: "593994230531"},
    { nombre: "Elio", numero: "593984981532"},
    { nombre: "Maria Cristina", numero: "593987722761"},
    { nombre: "Omar", numero: "593980062361"},
    { nombre: "Roberto", numero: "593996576491"},
    { nombre: "Daniela", numero: "593939799374" },
    { nombre: "Yuliana", numero: "593978715541" },
    { nombre: "Lina", numero: "593978984989" },
    { nombre: "Susana", numero: "593998144837" },
    { nombre: "Norma", numero: "593998628700" },
    { nombre: "Fanny", numero: "593961006363" },
    { nombre: "Fabian", numero: "593989174820" },
    { nombre: "Laura", numero: "593963722678" },
    { nombre: "David", numero: "593960823515" },
    { nombre: "Maria", numero: "593983815594" },
    { nombre: "Santiago", numero: "593982742882" },
    { nombre: "Mauricio", numero: "593978631648" },
    { nombre: "Fabricio", numero: "593978943064" },
    { nombre: "Yisander", numero: "593999245254" },
    { nombre: "Silvana", numero: "593992980340" },
    { nombre: "Freddy", numero: "593963108587" },
    { nombre: "Lisbeth", numero: "593998470385" },
    { nombre: "David", numero: "593959573760" },
    { nombre: "Maria Alejandra", numero: "593998960730" },
    { nombre: "Anais", numero: "593997974001" },
    { nombre: "Claudia", numero: "593984028233" },
    { nombre: "Larissa", numero: "593997191720" },
    { nombre: "Yureima", numero: "593987140870" },
    { nombre: "Lorena", numero: "593987149970" },
    { nombre: "Vanessa", numero: "593992717057" },
    { nombre: "Leticia", numero: "593963789302" },
    { nombre: "Michael", numero: "593979191018" },
    { nombre: "Pamela", numero: "593963438297" },
    { nombre: "Manuel", numero: "593958765825" },
    { nombre: "Yicenia", numero: "593995091948" },
    { nombre: "Eduardo", numero: "593998163276" },
    { nombre: "Genesis", numero: "593999854086" },
    { nombre: "Alexandra", numero: "593999219795" },
    { nombre: "Isabel", numero: "593995625935" },
    { nombre: "Luis", numero: "593978868193" },
    { nombre: "David", numero: "593984267819" },
    { nombre: "Jose", numero: "593982375924" },
    { nombre: "Abel", numero: "593996463765" },
    { nombre: "Danien", numero: "593963188134" },
    { nombre: "Jose", numero: "593964023530" },
    { nombre: "Victor", numero: "593995100000" },
    { nombre: "Anthony", numero: "593985653896" },
    { nombre: "Joan", numero: "593978626391" },
    { nombre: "Sebastian", numero: "593983719725" },
    { nombre: "Alejandro", numero: "593995278312" },
    { nombre: "Jefferson", numero: "593999776548" },
    { nombre: "Johana", numero: "593963166423" },
    { nombre: "Johana", numero: "593983598001" },
    { nombre: "Gabriel", numero: "593999217181" },
    { nombre: "Jorge", numero: "593983500172" },
    { nombre: "Sebastian", numero: "593983372068" },
    { nombre: "Silvia", numero: "593962833737" },
    { nombre: "Tatiana", numero: "593958873005" },
    { nombre: "Isaac", numero: "593961451514" },
    { nombre: "Angel", numero: "593987953758" },
    { nombre: "Josman", numero: "593978907087" },
    { nombre: "Carlos", numero: "593992649453" },
    { nombre: "Elian", numero: "593983237575" },
    { nombre: "Lis", numero: "593985353489" },
    { nombre: "Mishel", numero: "593987079691" },
    { nombre: "Pamela", numero: "593967454931" },
    { nombre: "Elisa", numero: "593984016651" },
    { nombre: "Cynthia", numero: "593963641268" },
    { nombre: "Erdy", numero: "593963790364" },
    { nombre: "Edison", numero: "593994912943" },
    { nombre: "Francisco", numero: "593991347671" },
    { nombre: "Diana", numero: "593967233977" },
    { nombre: "Carlos", numero: "593998072690" },
    { nombre: "Alexandra", numero: "593995691090" },
    { nombre: "Elidee", numero: "593963718768" },
    { nombre: "Tania", numero: "593992720150" },
    { nombre: "Nora", numero: "593987621919" },
    { nombre: "Ximena", numero: "593997096048" },
    { nombre: "Alex", numero: "593983508746" },
    { nombre: "Gloria", numero: "593962591279" },
    { nombre: "Alexandra", numero: "593999707726" },
    { nombre: "Oscar", numero: "593999660359" },
    { nombre: "Evelin", numero: "593984739332" },
    { nombre: "Piedad", numero: "593979673561" },
    { nombre: "Silvia", numero: "593998987442" },
    { nombre: "Consuelo", numero: "593992618200" },
    { nombre: "Guadalupe", numero: "593995440666" },
    { nombre: "Angel", numero: "593959729043" },
    { nombre: "Eduardo", numero: "593996364923" },
    { nombre: "Maritza", numero: "593958845122" },
    { nombre: "Solmaire", numero: "593998917974" },
    { nombre: "Karla", numero: "593987869562" },
    { nombre: "Suritiak", numero: "593996817084" },
    { nombre: "Cesar", numero: "593962921921" },
    { nombre: "Eros", numero: "593963608927" },
    { nombre: "Gerzon", numero: "593995371939" },
    { nombre: "Juan Carlos", numero: "593999032528" },
    { nombre: "Marcelo", numero: "593999662749" },
    { nombre: "Freddy", numero: "593979383892" },
    { nombre: "William", numero: "593979710821" },
    { nombre: "Nicole", numero: "593987198408" },
    { nombre: "German", numero: "593939540852" },
    { nombre: "Nikole", numero: "593978785216" },
    { nombre: "Aracelly", numero: "593998719913" },
    { nombre: "Marlene", numero: "593998827269" },
    { nombre: "Erick", numero: "593986864747" },
    { nombre: "Claudia", numero: "593967550113" },
    { nombre: "Cliente de Smartlink", numero: "593985182892" },
    { nombre: "Jonathan", numero: "593964147533" },
    { nombre: "Indira", numero: "593958783752" },
    { nombre: "Jairon", numero: "593985375453" },
    { nombre: "Angel", numero: "593959729043" },
    { nombre: "Patricio", numero: "593984398516" },
    { nombre: "Oswaldo", numero: "593998794758" }
  ];
  
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
Shampoo con Aloe Vera: Limpia y fortalece el cabello con propiedades del aloe vera. Precio: $2.00 (370 ml), $3.50 (750 ml), $4.00 (1L), $12.00 (4L), $55.00 (20L). Fragancia frutal
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

Si no sabes qué responder, usa:
"🤖 No tengo información sobre eso. En un momento te paso con el encargado para que responda a tu duda."



---

Respuestas automáticas según el mensaje del usuario:

Saludo simple (Ej: "Hola")

Responde amablemente:
"¡Hola! Gracias por escribirnos 🧼. ¿En qué te puedo ayudar hoy?"



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

Si el usuario manda sticker, audio o video, NO respondas con texto.

Si se despiden, responde de forma natural y amable.


si te preguntan comparacion entre productos investiga y responde con lo que sepas

si ponen palabras que se relacionen con los productos dale la informacion del producto


`;

try {
    const numero = ctx.from;

    if (!sesionesChat[numero]) {
    // Inicia o reutiliza el chat por número
    
        const chat = await genAI.getGenerativeModel({ model: MODEL }).startChat({
            history: [
                {
                    role: "user",
                    parts: [{ text: "Eres un asistente experto en productos de limpieza de la empresa Smartlink." }]
                },
                {
                    role: "model",
                    parts: [{ text: "¡Hola! ¿En qué puedo ayudarte hoy sobre nuestros productos de limpieza?" }]
                }
            ],
            generationConfig: {
                maxOutputTokens: 100,
            },
        });
        sesionesChat[numero] = chat;
        
    }

    const chat = sesionesChat[numero];
    const result = await chat.sendMessage(`${contexto}`);
    const response = await result.response;
    const texto = response.text();
   
    await flowDynamic(texto || '🤖 No encontré una respuesta.');
    console.log("📨 Texto enviado a Gemini:", texto);
} catch (error) {
    console.error('Error con Gemini:', error);
    await flowDynamic('⚠️ Lo siento, ocurrió un error al responder tu pregunta.');
}
});

  
const main = async () => {
    const adaptorDB = new MongoAdapter({
        dbUri: MONGO_DB_URI,
        dbName: MONGO_DB_NAME,
    });

    const adaptorFlow = createFlow([flujoRespuestaIA]);
    const adaptorProvider = createProvider(BaileysProvider);

    createBot({
        flow: adaptorFlow,
        provider: adaptorProvider,
        database: adaptorDB,
    }).then(() => {
        console.log('Bot iniciado correctamente y conectado a WhatsApp');
    });

    QRPortalWeb();
    const provider = adaptorProvider;
    const fechaEnvio = new Date('2025-05-22T10:06:00');
    const ahora = new Date();
    const diferencia = fechaEnvio - ahora;
    console.log('⏳ Esperando conexión con WhatsApp...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    if (diferencia > 0) {
        console.log(`El mensaje se enviará en ${diferencia / 1000} segundos`);
    
        // Usamos setTimeout para ejecutar el código de envío después de la diferencia de tiempo calculada
        setTimeout(async () => {
            console.log('🚀 Enviando mensajes masivos...');
            
            for (const numero of contactos) {
                const jid = `${numero.numero}@s.whatsapp.net`;
                const mensaje = `¡Hola ${numero.nombre}!
¡Todo lo que te gusta en un solo lugar! 🧽✨ Descubre nuestros productos de limpieza 🧴🧼 y mantiene tu espacio libre de virus y bacterias 🦠🚫.
En este feriado, aprovecha para cuidar tu hogar como se merece 🏠💪. 

¡Compra fácil, rápido y seguro! ✅🛍️
`;
            
                // Verificar si quieres enviar una imagen o solo un mensaje de texto
                const enviarConImagen = false; // Cambiar a 'false' cuando no quieras enviar imagen
            
                try {
                    if (enviarConImagen) {
                        // Enviar mensaje con imagen
                        const imagePath = "c:/Users/Syslan/Downloads/WhatsApp Image 2025-05-15 at 09.43.26.jpeg";
                        await provider.sendMedia(jid, imagePath, mensaje);
                        console.log(`✅ Imagen enviada a: ${numero.nombre} (${numero.numero})`);
                    } else {
                        // Enviar solo mensaje de texto
                        await provider.sendText(jid, mensaje);
                        console.log(`✅ Mensaje enviado a: ${numero.nombre} (${numero.numero})`);
                    }
                } catch (error) {
                    console.error(`❌ Error al enviar a ${numero.numero}:`, error.message);
                }
            
                await new Promise(resolve => setTimeout(resolve, 60000)); // Esperar 60 segundos
            }
            
            console.log('📤 Mensajería masiva finalizada.');
 // Detener el proceso después de enviar los mensajes
        }, diferencia);
    } else {
        console.log("La fecha y hora ya ha pasado.");
    }
};



main();