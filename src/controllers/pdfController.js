import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho base para salvar os PDFs: raiz/public/pdfs
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public', 'pdfs');

// Garante que a pasta base existe ao iniciar
if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

// --- SEED: Cria as pastas padrões se não existirem ---
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

// --- 1. GERAR PDF (Com escolha de Posição da Foto) ---
export const gerarPdf = async (req, res) => {
    try {
        const { titulo, conteudo, pasta, posicao } = req.body;
        const imagemPath = req.file ? req.file.path : null;

        // Garante que a pasta de destino existe
        const pastaDestino = path.join(PUBLIC_DIR, pasta);
        if (!fs.existsSync(pastaDestino)) {
            fs.mkdirSync(pastaDestino, { recursive: true });
        }

        const doc = new PDFDocument();
        // Cria nome de arquivo seguro (sem caracteres especiais)
        const nomeArquivo = `${titulo.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
        const caminhoFinal = path.join(pastaDestino, nomeArquivo);
        
        const stream = fs.createWriteStream(caminhoFinal);
        doc.pipe(stream);

        // -- TÍTULO (Sempre no topo) --
        doc.fontSize(20).text(titulo, { align: 'center' });
        doc.moveDown();

        // Função auxiliar para desenhar a imagem
        const colocarImagem = () => {
            if (imagemPath) {
                try {
                    doc.image(imagemPath, {
                        fit: [400, 300],
                        align: 'center',
                        valign: 'center'
                    });
                    doc.moveDown();
                } catch (err) {
                    console.error("Erro ao processar imagem:", err);
                }
            }
        };

        // Lógica de Posição: Se NÃO for 'final', põe no topo
        if (posicao !== 'final') {
            colocarImagem();
        }

        // -- TEXTO --
        doc.fontSize(12).text(conteudo, { align: 'justify' });
        doc.moveDown();

        // Lógica de Posição: Se FOR 'final', põe embaixo do texto
        if (posicao === 'final') {
            colocarImagem();
        }

        doc.end();

        stream.on('finish', () => {
            // Limpa arquivo temporário
            if(imagemPath && fs.existsSync(imagemPath)) fs.unlinkSync(imagemPath);
            
            res.json({ 
                success: true, 
                url: `/pdfs/${pasta}/${nomeArquivo}`,
                filename: nomeArquivo
            });
        });

    } catch (error) {
        console.error("Erro ao gerar PDF:", error);
        res.status(500).json({ success: false, message: "Erro interno ao gerar PDF." });
    }
};

// --- 2. LISTAR PASTAS (Para o menu lateral) ---
export const listarPastas = (req, res) => {
    try {
        const itens = fs.readdirSync(PUBLIC_DIR, { withFileTypes: true });
        const pastas = itens
            .filter(item => item.isDirectory())
            .map(item => item.name);
        res.json(pastas);
    } catch (error) {
        res.status(500).json({ error: "Erro ao listar pastas" });
    }
};

// --- 3. CRIAR NOVA PASTA ---
export const criarPasta = (req, res) => {
    try {
        const { nome } = req.body;
        if (!nome) return res.status(400).json({ error: "Nome é obrigatório" });

        // Sanitiza o nome (Maiúsculo e sem caracteres estranhos)
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

// --- 4. LISTAR ARQUIVOS DENTRO DA PASTA ---
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