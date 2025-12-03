import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define o caminho absoluto para a pasta public/pdfs
// Ajuste os '..' conforme a profundidade da sua estrutura de pastas
const PUBLIC_DIR = path.resolve(__dirname, '..', '..', 'public', 'pdfs');

// Garante que a pasta base existe
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

export const gerarPdf = async (req, res) => {
    try {
        console.log("Iniciando geração de PDF..."); // Log para debug
        
        const { titulo, conteudo, pasta, posicao } = req.body;
        
        // Garante que é um array, mesmo que venha vazio
        const imagens = req.files || [];
        console.log(`Arquivos recebidos: ${imagens.length}`);

        // Validação básica
        if (!titulo || !conteudo || !pasta) {
            return res.status(400).json({ success: false, message: "Título, conteúdo e pasta são obrigatórios." });
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

        // --- TÍTULO ---
        doc.fontSize(20).text(titulo, { align: 'center' });
        doc.moveDown();

        // Função segura para desenhar imagem
        const colocarImagem = (file) => {
            if (file && file.path && fs.existsSync(file.path)) {
                try {
                    // Verifica se cabe na página, senão cria nova
                    if (doc.y > 650) doc.addPage();
                    
                    doc.image(file.path, {
                        fit: [450, 350],
                        align: 'center',
                        valign: 'center'
                    });
                    doc.moveDown();
                } catch (err) {
                    console.error("Erro ao inserir imagem no PDF:", err.message);
                    doc.text(`[Erro ao carregar imagem: ${file.originalname}]`, { color: 'red' });
                }
            }
        };

        doc.fontSize(12);

        // --- LÓGICA DE SUBSTITUIÇÃO [FOTO1], [FOTO2] ---
        // Se houver imagens e tags no texto
        const partes = conteudo.split(/(\[FOTO\d+\])/g);
        let usouAlgumaTag = false;

        partes.forEach(parte => {
            const match = parte.match(/^\[FOTO(\d+)\]$/);
            if (match) {
                usouAlgumaTag = true;
                const indice = parseInt(match[1]) - 1; // [FOTO1] é índice 0
                
                if (imagens[indice]) {
                    colocarImagem(imagens[indice]);
                } else {
                    // Se a tag existe mas a foto não
                    // doc.text(`[FOTO${indice+1} não encontrada]`, { color: 'gray' });
                }
            } else {
                if (parte.trim() !== "") {
                    doc.text(parte, { align: 'justify' });
                    doc.moveDown(0.5);
                }
            }
        });

        // --- FALLBACK (Se não usou tags ou sobraram fotos) ---
        // Se o usuário não usou [FOTOx], colocamos todas as imagens com base na posição escolhida
        if (!usouAlgumaTag && imagens.length > 0) {
            
            // Se for 'topo', não temos como voltar o cursor para o início facilmente em stream.
            // O padrão será colocar no FINAL se não usar tags.
            
            doc.moveDown();
            doc.text("Anexos:", { underline: true });
            doc.moveDown();
            
            imagens.forEach(img => colocarImagem(img));
        }

        doc.end();

        stream.on('finish', () => {
            console.log("PDF Gerado com sucesso:", nomeArquivo);
            
            // Limpa arquivos temporários (importante para não lotar o servidor)
            imagens.forEach(file => {
                try {
                    if(file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
                } catch(e) { console.error("Erro ao deletar temp:", e); }
            });
            
            res.json({ 
                success: true, 
                url: `/pdfs/${pasta}/${nomeArquivo}`,
                filename: nomeArquivo
            });
        });

        stream.on('error', (err) => {
            console.error("Erro na stream do PDF:", err);
            res.status(500).json({ success: false, message: "Erro ao salvar arquivo PDF." });
        });

    } catch (error) {
        console.error("Erro CRÍTICO no controller:", error);
        res.status(500).json({ success: false, message: "Erro interno no servidor: " + error.message });
    }
};

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
        if (fs.existsSync(nova)) return res.status(400).json({ error: "Já existe" });
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