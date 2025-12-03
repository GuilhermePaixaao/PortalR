import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho base para salvar os PDFs: raiz/public/pdfs
const PUBLIC_DIR = path.resolve(__dirname, '..', '..', 'public', 'pdfs');

if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

export const inicializarPastasPadrao = () => {
    const pastasIniciais = [
        "ARIUS ( PDV )", "BLUESOFT", "BUSCA PREÇO ( LOJA )", "FORMATAÇÃO ( WINDOWS )",
        "FORMATAÇÃO - PDV ARIUS DO ZERO", "IMPRESSORAS ( MAQUIM )",
        "MILVUS ( CHAMADO PARA T.I ROSALINA )", "MOB ROSALINA ( APP INTERNO )",
        "SEFAZ ( SECRETARIA DA FAZENDA )", "ZEBRA"
    ];
    pastasIniciais.forEach(pasta => {
        const p = path.join(PUBLIC_DIR, pasta);
        if (!fs.existsSync(p)) fs.mkdirSync(p);
    });
};

// --- 1. GERAR PDF (COM MAPA POR NOME DE ARQUIVO) ---
export const gerarPdf = async (req, res) => {
    // Array para rastrear arquivos temporários que devem ser limpos
    const arquivosTemporarios = req.files || [];
    
    try {
        const { titulo, conteudo, pasta, posicao } = req.body;
        const imagens = arquivosTemporarios;

        if (!titulo || !pasta) {
            return res.status(400).json({ success: false, message: "Título e Pasta são obrigatórios." });
        }

        const pastaDestino = path.join(PUBLIC_DIR, pasta);
        if (!fs.existsSync(pastaDestino)) {
            fs.mkdirSync(pastaDestino, { recursive: true });
        }

        const doc = new PDFDocument();
        const nomeArquivo = `${titulo.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
        const caminhoFinal = path.join(pastaDestino, nomeArquivo);
        
        const stream = fs.createWriteStream(caminhoFinal);
        doc.pipe(stream);

        // ====================================================
        // === NOVO: CRIAR MAPA BASEADO NO NOME DO ARQUIVO ===
        // ====================================================
        const imagemMap = {};
        imagens.forEach(file => {
            // Exemplo: file.originalname = 'FOTO1.png'
            // O regex busca 'FOTO' seguido de números
            const matchName = file.originalname.match(/FOTO(\d+)\./i); 

            if (matchName) {
                const numeroTag = matchName[1]; // Ex: '1', '2'
                const tagCompleta = `[FOTO${numeroTag}]`; // Ex: '[FOTO1]'
                
                // Mapeia a tag (ex: '[FOTO1]') para o objeto do arquivo
                imagemMap[tagCompleta] = file;
            }
        });
        // ====================================================

        // Título
        doc.fontSize(20).text(titulo, { align: 'center' });
        doc.moveDown();

        // Função auxiliar para desenhar imagem
        const colocarImagem = (file) => {
            if (file && file.path && fs.existsSync(file.path)) {
                try {
                    if (doc.y > 650) doc.addPage();
                    doc.image(file.path, {
                        fit: [450, 350],
                        align: 'center',
                        valign: 'center'
                    });
                    doc.moveDown();
                } catch (err) {
                    console.error("Erro ao inserir imagem:", err.message);
                    doc.fontSize(10).fillColor('red').text(`[Erro ao carregar imagem: ${file.originalname}]`);
                    doc.fillColor('black').fontSize(12);
                }
            }
        };

        doc.fontSize(12);

        // --- LÓGICA DE TAGS [FOTO1], [FOTO2] NO CONTEÚDO ---
        // Procura por tags [FOTON]
        const tagsUsadas = [];
        const partes = conteudo.split(/(\[FOTO\d+\])/g);
        let usouAlgumaTag = false;

        partes.forEach(parte => {
            const match = parte.match(/^(\[FOTO\d+\])$/);
            
            if (match) {
                const tagCompleta = match[1]; // Ex: [FOTO1]
                usouAlgumaTag = true;
                tagsUsadas.push(tagCompleta);
                
                const fileToPlace = imagemMap[tagCompleta]; // Busca no mapa pelo nome do arquivo

                if (fileToPlace) {
                    colocarImagem(fileToPlace);
                } else {
                     // Adiciona um placeholder se a tag foi usada mas o arquivo correspondente não foi enviado
                     doc.fontSize(10).fillColor('gray').text(`[IMAGEM ${tagCompleta} NÃO ENCONTRADA]`, { align: 'center' });
                     doc.fillColor('black').fontSize(12);
                     doc.moveDown(0.5);
                }
            } else {
                if (parte.trim() !== "") {
                    doc.text(parte, { align: 'justify' });
                    doc.moveDown(0.5);
                }
            }
        });

        // --- FALLBACK (Se não usou NENHUMA tag, mas enviou fotos) ---
        if (!usouAlgumaTag && imagens.length > 0) {
            doc.addPage();
            doc.text("Anexos:", { underline: true });
            doc.moveDown();
            
            // Coloca todas as imagens (usando a ordem de upload como fallback)
            imagens.forEach(img => colocarImagem(img));
        }

        doc.end();

        stream.on('finish', () => {
            // Limpa arquivos temporários
            imagens.forEach(file => {
                if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
            });

            res.json({ 
                success: true, 
                url: `/pdfs/${pasta}/${nomeArquivo}`,
                filename: nomeArquivo
            });
        });

        stream.on('error', (err) => {
            console.error("Erro na stream:", err);
            imagens.forEach(file => { if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path); });
            res.status(500).json({ success: false, message: "Erro ao salvar arquivo PDF." });
        });

    } catch (error) {
        console.error("Erro CRÍTICO no controller:", error);
        // Garante que os temporários sejam limpos mesmo em erro de controller
        arquivosTemporarios.forEach(file => {
             if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
        });
        res.status(500).json({ success: false, message: "Erro interno: " + error.message });
    }
};

// --- OUTRAS FUNÇÕES (Mantenha iguais) ---
export const listarPastas = (req, res) => {
    try {
        const itens = fs.readdirSync(PUBLIC_DIR, { withFileTypes: true });
        const pastas = itens.filter(i => i.isDirectory()).map(i => i.name);
        res.json(pastas);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

export const criarPasta = (req, res) => {
    try {
        const { nome } = req.body;
        if (!nome) return res.status(400).json({ error: "Nome obrigatório" });
        const nomeSeguro = nome.replace(/[^a-zA-Z0-9 \-\(\)\.]/g, '').trim().toUpperCase();
        const nova = path.join(PUBLIC_DIR, nomeSeguro);
        if (fs.existsSync(nova)) return res.status(400).json({ error: "Pasta já existe" });
        fs.mkdirSync(nova);
        res.json({ success: true, nome: nomeSeguro });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

export const listarArquivosDaPasta = (req, res) => {
    try {
        const { pastaName } = req.params;
        const p = path.join(PUBLIC_DIR, pastaName);
        if (!fs.existsSync(p)) return res.json([]);
        const arqs = fs.readdirSync(p).filter(f => f.toLowerCase().endsWith('.pdf')).map(f => ({ nome: f, url: `/pdfs/${pastaName}/${f}` }));
        res.json(arqs);
    } catch (e) { res.status(500).json({ error: e.message }); }
};