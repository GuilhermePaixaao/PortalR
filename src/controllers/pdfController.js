import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Defina o caminho base PÚBLICO onde os PDFs ficarão
// Subimos níveis (..) para sair de src/controllers e chegar na raiz
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public', 'pdfs');

// Garante que a pasta base existe
if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

// --- (Seu código existente de gerarPdf aqui...) ---
export const gerarPdf = async (req, res) => {
    // ... (Mantenha sua lógica de gerar PDF aqui, usando PUBLIC_DIR) ...
    // Apenas certifique-se de usar path.join(PUBLIC_DIR, pasta)
    try {
        const { titulo, conteudo, pasta } = req.body;
        const imagemPath = req.file ? req.file.path : null;

        const pastaDestino = path.join(PUBLIC_DIR, pasta);
        if (!fs.existsSync(pastaDestino)) fs.mkdirSync(pastaDestino, { recursive: true });

        const doc = new PDFDocument();
        const nomeArquivo = `${titulo.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
        const caminhoFinal = path.join(pastaDestino, nomeArquivo);
        const stream = fs.createWriteStream(caminhoFinal);

        doc.pipe(stream);
        doc.fontSize(20).text(titulo, { align: 'center' });
        doc.moveDown();
        if (imagemPath) {
             doc.image(imagemPath, { fit: [400, 300], align: 'center', valign: 'center' });
             doc.moveDown();
        }
        doc.fontSize(12).text(conteudo, { align: 'justify' });
        doc.end();

        stream.on('finish', () => {
            if(imagemPath && fs.existsSync(imagemPath)) fs.unlinkSync(imagemPath);
            res.json({ success: true, url: `/pdfs/${pasta}/${nomeArquivo}`, filename: nomeArquivo });
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Erro ao gerar PDF" });
    }
};

// --- NOVAS FUNÇÕES PARA PASTAS ---

// 1. Listar Pastas
export const listarPastas = (req, res) => {
    try {
        // Lê o diretório e retorna apenas o que for pasta
        const itens = fs.readdirSync(PUBLIC_DIR, { withFileTypes: true });
        const pastas = itens
            .filter(item => item.isDirectory())
            .map(item => item.name);
        res.json(pastas);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao listar pastas" });
    }
};

// 2. Criar Nova Pasta
export const criarPasta = (req, res) => {
    try {
        const { nome } = req.body;
        if (!nome) return res.status(400).json({ error: "Nome obrigatório" });

        // Sanitiza o nome (remove caracteres perigosos)
        const nomeSeguro = nome.replace(/[^a-zA-Z0-9 \-\(\)\.]/g, '').trim().toUpperCase();
        const novaPastaPath = path.join(PUBLIC_DIR, nomeSeguro);

        if (fs.existsSync(novaPastaPath)) {
            return res.status(400).json({ error: "Pasta já existe" });
        }

        fs.mkdirSync(novaPastaPath);
        res.json({ success: true, nome: nomeSeguro });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao criar pasta" });
    }
};

// 3. Listar Arquivos de uma Pasta (Para o menu funcionar dinamicamente)
export const listarArquivosDaPasta = (req, res) => {
    try {
        const { pastaName } = req.params;
        const pastaPath = path.join(PUBLIC_DIR, pastaName);

        if (!fs.existsSync(pastaPath)) return res.json([]);

        const arquivos = fs.readdirSync(pastaPath)
            .filter(file => file.toLowerCase().endsWith('.pdf'))
            .map(file => ({
                nome: file,
                url: `/pdfs/${pastaName}/${file}`
            }));
        
        res.json(arquivos);
    } catch (error) {
        res.status(500).json({ error: "Erro ao ler arquivos" });
    }
};

// 4. (SEED) Inicializar Pastas Padrão (Da sua imagem)
// Chame essa função uma vez no início do server.js se quiser, ou deixe aqui para uso manual
export const inicializarPastasPadrao = () => {
    const pastasIniciais = [
        "ARIUS ( PDV )",
        "BLUESOFT",
        "BUSCA PREÇO ( LOJA )",
        "FORMATAÇÃO ( WINDOWS )",
        "FORMATAÇÃO - PDV ARIUS DO ZERO",
        "IMPRESSORAS ( MAQUIM )",
        "MILVUS ( CHAMADO PARA T.I ROSALINA )",
        "MOB ROSALINA ( APP INTERNO )",
        "SEFAZ ( SECRETARIA DA FAZENDA )",
        "ZEBRA"
    ];

    pastasIniciais.forEach(pasta => {
        const p = path.join(PUBLIC_DIR, pasta);
        if (!fs.existsSync(p)) {
            fs.mkdirSync(p);
            console.log(`[SEED] Pasta criada: ${pasta}`);
        }
    });
};