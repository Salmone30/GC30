const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

const app = express();

// Configura Multer per salvare le immagini
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        try {
            await fs.mkdir('./uploads', { recursive: true });
            cb(null, './uploads/');
        } catch (error) {
            console.error('Errore creazione cartella uploads:', error.message);
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Limite 5MB per file
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Solo immagini JPEG/PNG sono accettate!'));
        }
    }
}).array('autographs', 10); // Max 10 immagini

// Serve file statici dalla cartella public
app.use(express.static('public'));
app.use('/uploads', express.static('uploads')); // Serve le immagini dalla cartella uploads

// File JSON per memorizzare le richieste
const REQUESTS_FILE = 'requests.json';

// Inizializza requests.json se non esiste
async function initializeRequestsFile() {
    try {
        await fs.access(REQUESTS_FILE);
        const data = await fs.readFile(REQUESTS_FILE, 'utf8');
        JSON.parse(data); // Verifica JSON valido
        console.log('File requests.json esistente e valido');
    } catch (error) {
        console.log('Creazione file requests.json');
        await fs.writeFile(REQUESTS_FILE, JSON.stringify([]));
    }
}

// Esegui inizializzazione all'avvio
initializeRequestsFile().catch(err => {
    console.error('Errore inizializzazione requests.json:', err.message);
});

// Genera codice univoco (es. GC30-20250719-4721)
function generateRequestId() {
    const prefix = 'GC30';
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // es. 20250719
    const randomNum = Math.floor(1000 + Math.random() * 9000); // Numero casuale a 4 cifre
    return `${prefix}-${date}-${randomNum}`;
}

// Configura Nodemailer con debug
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    logger: true,
    debug: true
});

// Verifica la connessione SMTP
transporter.verify((error, success) => {
    if (error) {
        console.error('Errore nella verifica SMTP:', error.message);
    } else {
        console.log('Connessione SMTP riuscita:', success);
    }
});

// Endpoint per gestire il caricamento
app.post('/upload', (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            console.error('Errore Multer:', err.message);
            return res.status(400).json({ error: err.message });
        }

        const email = req.body.email;
        const files = req.files;

        if (!files || files.length < 3) {
            return res.status(400).json({ error: 'Carica almeno 3 immagini.' });
        }

        const requestId = generateRequestId();
        const imagePaths = files.map(file => file.filename);

        // Leggi il file requests.json
        let requests = [];
        try {
            const data = await fs.readFile(REQUESTS_FILE, 'utf8');
            requests = JSON.parse(data || '[]');
        } catch (error) {
            console.error('Errore lettura requests.json:', error.message);
            return res.status(500).json({ error: 'Errore salvataggio richiesta.' });
        }

        // Aggiungi la nuova richiesta
        requests.push({ requestId, email, images: imagePaths });

        // Scrivi nel file requests.json
        try {
            await fs.writeFile(REQUESTS_FILE, JSON.stringify(requests, null, 2));
            console.log('Richiesta salvata in requests.json:', requestId);
        } catch (error) {
            console.error('Errore scrittura requests.json:', error.message);
            return res.status(500).json({ error: 'Errore salvataggio richiesta.' });
        }

        // Configura l'email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: 'gc30test@gmail.com',
            subject: `Nuova richiesta di certificazione - ${requestId}`,
            text: `Nuova richiesta di certificazione autografi:\n\nEmail del cliente: ${email}\nCodice richiesta: ${requestId}\nNumero di immagini: ${files.length}`,
            attachments: files.map(file => ({
                filename: file.originalname,
                path: file.path
            }))
        };

        // Invia l'email
        try {
            await transporter.sendMail(mailOptions);
            res.json({ requestId });
        } catch (error) {
            console.error('Errore dettagliato invio email:', error.message);
            res.status(500).json({ error: 'Errore durante l\'invio dell\'email.' });
        }
    });
});

// Endpoint per la ricerca (POST, per il form)
app.post('/search', express.json(), async (req, res) => {
    const { requestId } = req.body;

    if (!requestId) {
        console.error('Errore: requestId non fornito');
        return res.status(400).json({ error: 'Codice univoco non fornito.' });
    }

    try {
        const data = await fs.readFile(REQUESTS_FILE, 'utf8');
        if (!data) {
            console.error('File requests.json vuoto');
            return res.status(500).json({ error: 'Nessun dato disponibile.' });
        }
        const requests = JSON.parse(data);

        const request = requests.find(r => r.requestId === requestId);

        if (request) {
            console.log('Richiesta trovata:', request);
            const existingImages = await Promise.all(
                request.images.map(async img => {
                    try {
                        await fs.access(path.join('uploads', img));
                        return img;
                    } catch {
                        console.warn(`Immagine non trovata: ${img}`);
                        return null;
                    }
                })
            );
            res.json({ request: { email: request.email, images: existingImages.filter(img => img) } });
        } else {
            console.log('Nessuna richiesta trovata per requestId:', requestId);
            res.json({ request: null });
        }
    } catch (error) {
        console.error('Errore lettura requests.json:', error.message);
        res.status(500).json({ error: `Errore durante la ricerca: ${error.message}` });
    }
});

// Endpoint per la ricerca tramite URL (GET)
app.get('/search/:requestId', async (req, res) => {
    const { requestId } = req.params;

    try {
        const data = await fs.readFile(REQUESTS_FILE, 'utf8');
        if (!data) {
            console.error('File requests.json vuoto');
            return res.status(500).json({ error: 'Nessun dato disponibile.' });
        }
        const requests = JSON.parse(data);

        const request = requests.find(r => r.requestId === requestId);

        if (request) {
            console.log('Richiesta trovata:', request);
            const existingImages = await Promise.all(
                request.images.map(async img => {
                    try {
                        await fs.access(path.join('uploads', img));
                        return img;
                    } catch {
                        console.warn(`Immagine non trovata: ${img}`);
                        return null;
                    }
                })
            );
            res.json({ request: { email: request.email, images: existingImages.filter(img => img) } });
        } else {
            console.log('Nessuna richiesta trovata per requestId:', requestId);
            res.json({ request: null });
        }
    } catch (error) {
        console.error('Errore lettura requests.json:', error.message);
        res.status(500).json({ error: `Errore durante la ricerca: ${error.message}` });
    }
});

// Gestione errori globali per prevenire crash
app.use((err, req, res, next) => {
    console.error('Errore server:', err.message);
    res.status(500).json({ error: 'Errore interno del server.' });
});

// Avvia il server su localhost:8081
app.listen(8081, () => {
    console.log('Server avviato su http://localhost:8081');
});