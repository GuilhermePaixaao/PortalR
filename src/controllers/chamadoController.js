import * as ChamadoModel from '../models/chamadoModel.js';
import * as EmailService from '../services/emailService.js'; 
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ====================================================
// ======== FUNÇÕES AUXILIARES (DADOS) ========
// ====================================================

export const listarLojas = async (req, res) => {
    try {
        const lojas = await ChamadoModel.getTodasLojas();
        res.json(lojas);
    } catch (error) {
        console.error("Erro ao listar lojas:", error);
        res.status(500).json({ error: 'Erro ao buscar lojas' });
    }
};

export const listarDepartamentosDaLoja = async (req, res) => {
    try {
        const { lojaId } = req.params;
        if (!lojaId) return res.status(400).json({ error: 'ID da loja é obrigatório' });
        const departamentos = await ChamadoModel.getDepartamentosPorLoja(lojaId);
        res.json(departamentos);
    } catch (error) {
        console.error("Erro ao listar departamentos:", error);
        res.status(500).json({ error: 'Erro ao buscar departamentos' });
    }
};

// ====================================================
// ======== CRUD DE CHAMADOS ========
// ====================================================

export const criarChamado = async (req, res) => {
    try {
        if (!req.body.chamado) return res.status(400).json({ success: false, message: "Dados não encontrados." });

        const chamado = JSON.parse(req.body.chamado);
        const arquivos = req.files; 

        const {
            assunto, descricao, prioridade, requisitante_id, categoria_unificada_id, 
            nome_requisitante_manual, email_requisitante_manual, telefone_requisitante_manual,
            loja, departamento 
        } = chamado;

        if (!assunto || !descricao || !requisitante_id || !nome_requisitante_manual || !telefone_requisitante_manual) {
            return res.status(400).json({ success: false, message: 'Campos obrigatórios faltando.' });
        }

        const dadosParaCriar = {
            assunto, descricao, prioridade: prioridade || 'Média', status: 'Aberto',
            requisitanteIdNum: parseInt(requisitante_id),
            categoriaUnificadaIdNum: categoria_unificada_id ? parseInt(categoria_unificada_id) : null,
            nomeRequisitanteManual: nome_requisitante_manual,
            emailRequisitanteManual: email_requisitante_manual,
            telefoneRequisitanteManual: telefone_requisitante_manual,
            loja_id: loja ? parseInt(loja) : null,                 
            departamento_id: departamento ? parseInt(departamento) : null 
        };

        const novoId = await ChamadoModel.create(dadosParaCriar);
        const novoChamado = await ChamadoModel.findById(novoId);
        
        if (req.io) {
            req.io.emit('novoChamadoInterno', {
                id: novoChamado.id, assunto: novoChamado.assunto,
                requisitante: novoChamado.nomeRequisitante || "Alguém", prioridade: novoChamado.prioridade
            });
        }
        if (novoChamado.emailRequisitante) {
            EmailService.enviarNotificacaoCriacao(novoChamado.emailRequisitante, novoChamado).catch(console.error);
        }
        
        res.status(201).json({ success: true, data: novoChamado });
    } catch (error) {
        console.error('Erro criar chamado:', error);
        res.status(500).json({ success: false, message: 'Erro interno.' });
    }
};

export const listarChamados = async (req, res) => {
    try {
        const chamados = await ChamadoModel.findAll(req.query);
        // Formatação simples para o front
        const formatados = chamados.map(c => ({
            ...c,
            Funcionario: { nomeFuncionario: c.nomeRequisitante, email: c.emailRequisitante, telefone: c.telefoneRequisitante },
            Atendente: c.atendente_id ? { nomeFuncionario: c.nomeAtendente, email: c.emailAtendente } : null,
            Categorias: c.categoria_unificada_id ? { id: c.categoria_unificada_id, nome: c.nomeCategoria, nomePai: c.nomeCategoriaPai } : null
        }));
        res.status(200).json(formatados);
    } catch (error) {
        res.status(500).json({ message: 'Erro interno.' });
    }
};

export const buscarChamadoPorId = async (req, res) => {
    try {
        const chamado = await ChamadoModel.findById(parseInt(req.params.id));
        if (!chamado) return res.status(404).json({ success: false, message: 'Não encontrado.' });
        
        const resposta = {
            ...chamado,
            Funcionario: { nomeFuncionario: chamado.nomeRequisitante, email: chamado.emailRequisitante, telefone: chamado.telefoneRequisitante },
            Atendente: chamado.atendente_id ? { nomeFuncionario: chamado.nomeAtendente, email: chamado.emailAtendente } : null,
            Categorias: chamado.categoria_unificada_id ? { id: chamado.categoria_unificada_id, nome: chamado.nomeCategoria, nomePai: chamado.nomeCategoriaPai } : null
        };
        res.status(200).json(resposta);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro interno.' });
    }
};

export const deletarChamado = async (req, res) => {
    try {
        const result = await ChamadoModel.deleteById(parseInt(req.params.id));
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Não encontrado.' });
        res.status(200).json({ success: true, message: 'Deletado.' });
    } catch (e) { res.status(500).json({ success: false }); }
};

export const atualizarStatus = async (req, res) => {
    try {
        const { status, atendenteId } = req.body;
        const id = parseInt(req.params.id);
        const result = await ChamadoModel.updateStatus(id, status, atendenteId ? parseInt(atendenteId) : null);
        if (result.affectedRows === 0) return res.status(404).json({ success: false });

        const chamado = await ChamadoModel.findById(id);
        if (chamado?.emailRequisitante) EmailService.enviarNotificacaoStatus(chamado.emailRequisitante, chamado, status).catch(console.error);

        res.status(200).json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
};

export const atualizarPrioridade = async (req, res) => {
    try {
        const result = await ChamadoModel.updatePrioridade(parseInt(req.params.id), req.body.prioridade);
        if (result.affectedRows === 0) return res.status(404).json({ success: false });
        res.status(200).json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
};

export const atualizarAtendente = async (req, res) => {
    try {
        const atendenteId = req.body.atendenteId ? parseInt(req.body.atendenteId) : null;
        const result = await ChamadoModel.updateAtendente(parseInt(req.params.id), atendenteId);
        if (result.affectedRows === 0) return res.status(404).json({ success: false });
        res.status(200).json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
};

export const atualizarCategoria = async (req, res) => {
    try {
        const result = await ChamadoModel.updateCategoria(parseInt(req.params.id), parseInt(req.body.categoriaId));
        if (result.affectedRows === 0) return res.status(404).json({ success: false });
        res.status(200).json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
};

export const contarChamadosPorStatus = async (req, res) => {
    try {
        const counts = await ChamadoModel.countByStatus();
        const resultado = counts.reduce((acc, item) => { acc[item.status] = item.count; return acc; }, {});
        res.status(200).json({
            "Aberto": resultado["Aberto"] || 0,
            "Em Andamento": resultado["Em Andamento"] || 0,
            "Concluído": resultado["Concluído"] || 0,
            "Pausado": resultado["Pausado"] || 0,
        });
    } catch (e) { res.status(500).json({ success: false }); }
};

// ====================================================
// ======== RELATÓRIOS PDF (ESTRUTURA COMPLETA) ========
// ====================================================

// Função para desenhar Cartão de Chamado (usada na lista detalhada)
const desenharCardChamado = (doc, ch, yPos) => {
    // Fundo do título
    doc.save();
    doc.fillColor('#f0f0f0');
    doc.rect(30, yPos, 535, 20).fill();
    doc.restore();

    // Título
    doc.fillColor('#000000').fontSize(10).font('Helvetica-Bold');
    let assuntoTopo = ch.assunto || 'Sem assunto';
    if (assuntoTopo.length > 60) assuntoTopo = assuntoTopo.substring(0, 60) + '...';
    doc.text(`#${ch.id} - ${assuntoTopo}`, 35, yPos + 6);
    
    // Status
    doc.fontSize(9).text(ch.status.toUpperCase(), 400, yPos + 6, { align: 'right', width: 160 });

    yPos += 30;

    const col1X = 35;
    const col2X = 300;
    const lineHeight = 14;

    // Linha 1
    doc.fontSize(9).font('Helvetica-Bold').text('Loja:', col1X, yPos);
    doc.font('Helvetica').text(ch.loja || 'N/A', col1X + 35, yPos);

    doc.font('Helvetica-Bold').text('Prioridade:', col2X, yPos);
    let corPrio = 'black';
    if (ch.prioridade === 'Alta') corPrio = 'red';
    doc.fillColor(corPrio).font('Helvetica-Bold').text(ch.prioridade, col2X + 60, yPos);
    doc.fillColor('black');

    yPos += lineHeight;

    // Linha 2
    let catTexto = 'N/A';
    if (ch.nomeCategoria) catTexto = ch.nomeCategoriaPai ? `${ch.nomeCategoriaPai} > ${ch.nomeCategoria}` : ch.nomeCategoria;
    
    doc.font('Helvetica-Bold').text('Categoria:', col1X, yPos);
    doc.font('Helvetica').text(catTexto, col1X + 55, yPos, { width: 200, lineBreak: false, ellipsis: true });

    const solicitante = (ch.nomeRequisitante || ch.nomeRequisitanteManual || 'N/A').split(' ')[0];
    doc.font('Helvetica-Bold').text('Solicitante:', col2X, yPos);
    doc.font('Helvetica').text(solicitante, col2X + 60, yPos);

    yPos += lineHeight;

    // Linha 3
    const dataCriacao = ch.created_at ? new Date(ch.created_at).toLocaleString('pt-BR') : '-';
    doc.font('Helvetica-Bold').text('Data:', col1X, yPos);
    doc.font('Helvetica').text(dataCriacao, col1X + 55, yPos);

    if (ch.nomeAtendente) {
        doc.font('Helvetica-Bold').text('Técnico:', col2X, yPos);
        doc.font('Helvetica').text(ch.nomeAtendente.split(' ')[0], col2X + 60, yPos);
    }

    yPos += lineHeight + 5;

    // Descrição
    doc.font('Helvetica-Bold').text('Descrição:', col1X, yPos);
    yPos += 12;
    let descricao = ch.descricao || 'Sem descrição.';
    descricao = descricao.replace(/(\r\n|\n|\r)/gm, " "); 
    doc.font('Helvetica').fontSize(8).fillColor('#444444');
    doc.text(descricao, col1X, yPos, { width: 525, align: 'justify' });
    
    const heightDesc = doc.heightOfString(descricao, { width: 525, fontSize: 8 });
    return yPos + heightDesc + 15; 
};

// 1. Relatório Simples
export const gerarRelatorioChamados = async (req, res) => {
    try {
        const chamados = await ChamadoModel.findAll(req.query);
        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        const filename = `Relatorio_Simples_${Date.now()}.pdf`;
        const logoPath = path.resolve(__dirname, '..', 'views', 'logo.png');

        res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
        res.setHeader('Content-type', 'application/pdf');
        doc.pipe(res);

        if (fs.existsSync(logoPath)) doc.image(logoPath, 30, 30, { width: 80 });
        doc.fontSize(16).font('Helvetica-Bold').text('Relatório de Chamados', 120, 35);
        doc.fontSize(10).font('Helvetica').text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 120, 55);
        
        doc.moveDown(4);
        doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(30, doc.y).lineTo(565, doc.y).stroke();
        
        let yPos = doc.y + 20;
        chamados.forEach(ch => {
            if (yPos > 700) { doc.addPage(); yPos = 40; }
            yPos = desenharCardChamado(doc, ch, yPos);
            yPos += 10;
        });
        doc.end();
    } catch (e) { if (!res.headersSent) res.status(500).json({ error: "Erro PDF" }); }
};

// 2. Relatório Completo (Gráfico + Estrutura do Prompt)
// ====================================================
// 2. Relatório Completo (COM DOIS GRÁFICOS)
// ====================================================

export const gerarRelatorioCompleto = async (req, res) => {
    try {
        // MUDANÇA 1: Recebendo duas imagens distintas do front-end
        const { filtros, chartImageCategoria, chartImageTempo, resumoTexto } = req.body; 
        const chamados = await ChamadoModel.findAll(filtros || {});

        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        const filename = `Relatorio_Gestao_${Date.now()}.pdf`;
        const logoPath = path.resolve(__dirname, '..', 'views', 'logo.png');

        res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
        res.setHeader('Content-type', 'application/pdf');
        doc.pipe(res);

        // --- FUNÇÃO AUXILIAR INTERNA PARA DESENHAR GRÁFICOS ---
        // Isso evita repetir código e trata erros de imagem corrompida
        const adicionarGraficoAoPDF = (doc, base64String, posY, titulo) => {
            if (!base64String) return posY;

            doc.fontSize(12).font('Helvetica-Bold').fillColor('#0d6efd').text(titulo, 30, posY);
            posY += 20;

            try {
                // Remove prefixo se existir (data:image/png;base64,)
                const cleanBase64 = base64String.replace(/^data:image\/\w+;base64,/, "");
                const imgBuffer = Buffer.from(cleanBase64, 'base64');
                
                // Configurações de tamanho
                const chartWidth = 480; 
                const chartHeight = 220; 
                const xChart = (doc.page.width - chartWidth) / 2; // Centralizado

                doc.image(imgBuffer, xChart, posY, { width: chartWidth, height: chartHeight });
                return posY + chartHeight + 30; // Retorna nova posição Y
            } catch (e) {
                doc.fontSize(10).fillColor('red').text("[Erro ao renderizar gráfico]", 30, posY);
                return posY + 30;
            }
        };

        // ====================================================
        // 1. CABEÇALHO E DADOS GERAIS
        // ====================================================
        
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 30, 30, { width: 80 }); 
        }

        doc.fontSize(18).font('Helvetica-Bold').fillColor('black').text('Relatório de Gestão', 120, 35);
        doc.fontSize(11).font('Helvetica-Bold').text('Cliente: Supermercado Rosalina', 120, 58);
        
        // Período
        let periodoTexto = "N/A";
        if (chamados.length > 0) {
            const datas = chamados.map(c => new Date(c.created_at));
            const min = new Date(Math.min(...datas)).toLocaleDateString('pt-BR');
            const max = new Date(Math.max(...datas)).toLocaleDateString('pt-BR');
            periodoTexto = `${min} a ${max}`;
        }
        doc.font('Helvetica').fontSize(10).text(`Período: ${periodoTexto}`, 120, 72);

        // Box de Totais
        doc.fontSize(10).text(`Total de Tickets: ${chamados.length}`, 400, 58, { align: 'right' });
        doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 400, 72, { align: 'right' });

        doc.moveDown(4);
        let yPos = doc.y;
        doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(30, yPos).lineTo(565, yPos).stroke();
        yPos += 20;

        // ====================================================
        // 2. PRIMEIRO GRÁFICO: CATEGORIAS (BARRAS)
        // ====================================================
        
        // Se a posição estiver muito baixa, cria nova página
        if (yPos > 500) { doc.addPage(); yPos = 40; }

        yPos = adicionarGraficoAoPDF(
            doc, 
            chartImageCategoria, 
            yPos, 
            '2. Tickets por Categoria (Principais Ofensores)'
        );

        // ====================================================
        // 3. SEGUNDO GRÁFICO: TEMPORAL (LINHA)
        // ====================================================

        // Verifica quebra de página
        if (yPos > 500) { doc.addPage(); yPos = 40; }

        yPos = adicionarGraficoAoPDF(
            doc, 
            chartImageTempo, 
            yPos, 
            '3. Evolução Temporal (Volume Diário)'
        );

        // ====================================================
        // 4. RESUMO DOS CHAMADOS (TEXTO)
        // ====================================================
        
        if (yPos > 650) { doc.addPage(); yPos = 40; }

        doc.fontSize(14).font('Helvetica-Bold').fillColor('#0d6efd').text('4. Resumo Quantitativo', 30, yPos);
        yPos += 25;

        const categoriasCount = {};
        chamados.forEach(c => {
            const catNome = c.nomeCategoriaPai ? c.nomeCategoriaPai : (c.nomeCategoria || 'Outros');
            categoriasCount[catNome] = (categoriasCount[catNome] || 0) + 1;
        });

        doc.font('Helvetica').fontSize(10).fillColor('black');
        Object.entries(categoriasCount).forEach(([cat, count]) => {
            doc.font('Helvetica-Bold').text(`• ${cat}:`, 40, yPos, { continued: true });
            doc.font('Helvetica').text(` ${count} tickets.`);
            yPos += 15;
        });
        
        yPos += 20;

        // ====================================================
        // 5. DETALHAMENTO (LISTA DE TICKETS)
        // ====================================================
        
        doc.addPage(); 
        yPos = 40;

        doc.fontSize(14).font('Helvetica-Bold').fillColor('#0d6efd').text('5. Detalhamento dos Chamados', 30, yPos);
        yPos += 30;

        chamados.forEach((ch) => {
            if (yPos > 700) { doc.addPage(); yPos = 40; }
            yPos = desenharCardChamado(doc, ch, yPos);
            yPos += 10;
        });

        // Rodapé Final
        doc.fillColor('black').fontSize(8).text(`Relatório confidencial - Supermercado Rosalina`, 30, 780, { align: 'center' });

        doc.end();

    } catch (error) {
        console.error("Erro Relatório Completo:", error);
        if (!res.headersSent) res.status(500).json({ error: "Erro ao gerar PDF" });
    }
};