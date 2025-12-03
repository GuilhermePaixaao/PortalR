import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public', 'pdfs');

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

// --- GERAR PDF COM MÚLTIPLAS FOTOS ---
export const gerarPdf = async (req, res) => {
    try {
        const { titulo, conteudo, pasta, posicao } = req.body;
        
        // Agora recebemos um ARRAY de arquivos (req.files)
        const imagens = req.files || [];

        const pastaDestino = path.join(PUBLIC_DIR, pasta);
        if (!fs.existsSync(pastaDestino)) fs.mkdirSync(pastaDestino, { recursive: true });

        const doc = new PDFDocument();
        const nomeArquivo = `${titulo.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
        const caminhoFinal = path.join(pastaDestino, nomeArquivo);
        const stream = fs.createWriteStream(caminhoFinal);

        doc.pipe(stream);

        // Título
        doc.fontSize(20).text(titulo, { align: 'center' });
        doc.moveDown();

        // Função auxiliar para desenhar imagem
        const colocarImagem = (file) => {
            if (file) {
                try {
                    // Verifica se a imagem cabe na página atual, senão cria nova
                    if (doc.y > 650) doc.addPage();
                    
                    doc.image(file.path, {
                        fit: [450, 350], 
                        align: 'center',
                        valign: 'center'
                    });
                    doc.moveDown();
                } catch (err) {
                    console.error("Erro imagem:", err);
                }
            }
        };

        doc.fontSize(12);

        // --- LÓGICA MULTI-FOTOS ---
        
        // Expressão Regular para encontrar [FOTO1], [FOTO2], etc.
        // O split vai dividir o texto mantendo as tags.
        // Ex: "Texto [FOTO1] Fim" vira ["Texto ", "[FOTO1]", " Fim"]
        const partes = conteudo.split(/(\[FOTO\d+\])/g);

        let usouAlgumaTag = false;

        partes.forEach(parte => {
            // Verifica se a parte atual é uma tag [FOTON]
            const match = parte.match(/^\[FOTO(\d+)\]$/);

            if (match) {
                usouAlgumaTag = true;
                const indice = parseInt(match[1]) - 1; // [FOTO1] é indice 0
                
                if (imagens[indice]) {
                    colocarImagem(imagens[indice]);
                } else {
                    // Se pediu foto X mas não enviou arquivo, ignora ou põe aviso
                    // doc.text(`(Imagem ${indice + 1} não encontrada)`, { align: 'center', color: 'red' });
                }
            } else {
                // Se não é tag, é texto normal
                if (parte.trim() !== "") {
                    doc.text(parte, { align: 'justify' });
                    doc.moveDown(0.5);
                }
            }
        });

        // --- FALLBACK (PLANO B) ---
        // Se o usuário mandou imagens mas NÃO escreveu nenhuma tag [FOTO...], 
        // usamos a lógica antiga de Posição (Topo ou Final) para todas as imagens.
        if (!usouAlgumaTag && imagens.length > 0) {
            
            // Limpa o documento (reset não é possível fácil no pdfkit stream, então vamos continuar)
            // Na verdade, como o loop acima já imprimiu o texto (porque não achou tags), 
            // só precisamos desenhar as imagens se a posição for TOPO (ops, tarde demais pro topo) ou FINAL.
            
            // Correção: Se não usou tags, o loop acima apenas imprimiu o texto corrido.
            // Se a pessoa queria no TOPO, já passou.
            // Para simplificar: Se usar múltiplas fotos, RECOMENDA-SE usar as tags.
            // Mas se sobrar fotos, vamos colocá-las no final.
            
            if (posicao === 'topo') {
                // Infelizmente com stream não dá pra voltar atrás e pôr no topo depois de escrever texto.
                // Mas podemos adicionar uma nova página no final com as fotos.
                doc.addPage();
                doc.text("Anexos:", { underline: true });
                doc.moveDown();
                imagens.forEach(img => colocarImagem(img));
            } else {
                // Padrão ou Final: coloca tudo no fim
                doc.moveDown();
                imagens.forEach(img => colocarImagem(img));
            }
        }

        doc.end();

        stream.on('finish', () => {
            // Limpa todos os arquivos temporários
            imagens.forEach(file => {
                if(file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
            });
            
            res.json({ success: true, url: `/pdfs/${pasta}/${nomeArquivo}`, filename: nomeArquivo });
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Erro ao gerar PDF" });
    }
};

// ... (Mantenha as funções listarPastas, criarPasta, listarArquivosDaPasta iguais ao anterior) ...
export const listarPastas = (req, res) => {
    try {
        const itens = fs.readdirSync(PUBLIC_DIR, { withFileTypes: true });
        const pastas = itens.filter(i => i.isDirectory()).map(i => i.name);
        res.json(pastas);
    } catch (e) { res.status(500).json({ error: "Erro pastas" }); }
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
    } catch (e) { res.status(500).json({ error: "Erro criar" }); }
};

export const listarArquivosDaPasta = (req, res) => {
    try {
        const { pastaName } = req.params;
        const p = path.join(PUBLIC_DIR, pastaName);
        if (!fs.existsSync(p)) return res.json([]);
        const arqs = fs.readdirSync(p).filter(f => f.toLowerCase().endsWith('.pdf')).map(f => ({ nome: f, url: `/pdfs/${pastaName}/${f}` }));
        res.json(arqs);
    } catch (e) { res.status(500).json({ error: "Erro arquivos" }); }
};