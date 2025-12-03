import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuração para caminhos no padrão ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const gerarPdf = async (req, res) => {
    try {
        const { titulo, conteudo, pasta } = req.body;
        const imagemPath = req.file ? req.file.path : null;

        // 1. Define onde salvar (Pasta public/pdfs)
        // Navega para fora de src/controllers (../../) até a raiz e entra em public/pdfs
        const publicDir = path.join(__dirname, '..', '..', 'public', 'pdfs', pasta);
        
        // Cria a pasta se não existir
        if (!fs.existsSync(publicDir)){
            fs.mkdirSync(publicDir, { recursive: true });
        }

        // 2. Configura o documento PDF
        const doc = new PDFDocument();
        const nomeArquivo = `${titulo.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
        const caminhoFinal = path.join(publicDir, nomeArquivo);
        
        const stream = fs.createWriteStream(caminhoFinal);
        doc.pipe(stream);

        // 3. Adiciona Conteúdo
        // Título
        doc.fontSize(20).text(titulo, { align: 'center' });
        doc.moveDown();

        // Imagem (se houver)
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

        // Texto
        doc.fontSize(12).text(conteudo, {
            align: 'justify'
        });

        doc.end();

        // 4. Finalização
        stream.on('finish', () => {
            // Remove a imagem temporária do upload
            if(imagemPath && fs.existsSync(imagemPath)) fs.unlinkSync(imagemPath);
            
            // Retorna a URL pública para acessar o PDF
            // No Railway/Local, isso será acessível via /pdfs/pasta/arquivo.pdf
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