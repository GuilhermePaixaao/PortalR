import * as ChamadoModel from '../models/chamadoModel.js';
import * as EmailService from '../services/emailService.js'; 
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuração para caminhos de arquivo
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
        if (!req.body.chamado) {
            return res.status(400).json({ success: false, message: "Dados não encontrados." });
        }

        const chamado = JSON.parse(req.body.chamado);
        const arquivos = req.files; 

        const {
            assunto, descricao, prioridade, requisitante_id,
            categoria_unificada_id, 
            nome_requisitante_manual, email_requisitante_manual, telefone_requisitante_manual,
            loja, departamento 
        } = chamado;

        if (!assunto || !descricao || !requisitante_id ||
            !nome_requisitante_manual || !telefone_requisitante_manual) {
            return res.status(400).json({ success: false, message: 'Campos obrigatórios faltando.' });
        }

        const dadosParaCriar = {
            assunto: assunto,
            descricao: descricao,
            prioridade: prioridade || 'Média',
            status: 'Aberto',
            requisitanteIdNum: parseInt(requisitante_id),
            categoriaUnificadaIdNum: categoria_unificada_id ? parseInt(categoria_unificada_id) : null,
            nomeRequisitanteManual: nome_requisitante_manual,
            emailRequisitanteManual: email_requisitante_manual,
            telefoneRequisitanteManual: telefone_requisitante_manual,
            loja_id: loja ? parseInt(loja) : null,                 
            departamento_id: departamento ? parseInt(departamento) : null 
        };

        const novoId = await ChamadoModel.create(dadosParaCriar);
        
        if (arquivos && arquivos.length > 0) {
            console.log(`Anexos salvos para o chamado ${novoId}`);
        }
        
        const novoChamado = await ChamadoModel.findById(novoId);
        
        // Notificação Socket
        if (req.io) {
            req.io.emit('novoChamadoInterno', {
                id: novoChamado.id,
                assunto: novoChamado.assunto,
                requisitante: novoChamado.nomeRequisitante || "Alguém",
                prioridade: novoChamado.prioridade
            });
        }

        // Envio de E-mail
        if (novoChamado.emailRequisitante) {
            EmailService.enviarNotificacaoCriacao(novoChamado.emailRequisitante, novoChamado)
                .catch(err => console.error("Falha envio email:", err));
        }
        
        // Formata Resposta
        const Funcionario = {
            nomeFuncionario: novoChamado.nomeRequisitante,
            email: novoChamado.emailRequisitante,
            telefone: novoChamado.telefoneRequisitante
        };
        const Categorias = novoChamado.categoria_unificada_id ? { 
            id: novoChamado.categoria_unificada_id, 
            nome: novoChamado.nomeCategoria,
            nomePai: novoChamado.nomeCategoriaPai
        } : null;

        delete novoChamado.nomeRequisitante; delete novoChamado.emailRequisitante; delete novoChamado.telefoneRequisitante;
        delete novoChamado.nomeCategoria; delete novoChamado.nomeCategoriaPai;

        const chamadoFormatado = { ...novoChamado, Funcionario, Categorias };
        res.status(201).json({ success: true, data: chamadoFormatado });

    } catch (error) {
        console.error('Erro ao criar chamado:', error);
        res.status(500).json({ success: false, message: 'Erro interno.' });
    }
};

export const listarChamados = async (req, res) => {
    try {
        const filtros = req.query;
        const chamados = await ChamadoModel.findAll(filtros);

        const chamadosFormatados = chamados.map(chamado => {
            const Funcionario = {
                nomeFuncionario: chamado.nomeRequisitante,
                email: chamado.emailRequisitante,
                telefone: chamado.telefoneRequisitante
            };
            const Atendente = chamado.atendente_id ? {
                nomeFuncionario: chamado.nomeAtendente, 
                email: chamado.emailAtendente     
            } : null; 
            const Categorias = chamado.categoria_unificada_id ? { 
                id: chamado.categoria_unificada_id, 
                nome: chamado.nomeCategoria,
                nomePai: chamado.nomeCategoriaPai 
            } : null;
            
            delete chamado.nomeRequisitante; delete chamado.emailRequisitante; delete chamado.telefoneRequisitante;
            delete chamado.nomeCategoria; delete chamado.nomeCategoriaPai; 
            delete chamado.nomeAtendente; delete chamado.emailAtendente;

            return { ...chamado, Funcionario, Categorias, Atendente };
        });

        res.status(200).json(chamadosFormatados);
    } catch (error) {
        console.error('Erro listar chamados:', error);
        res.status(500).json({ message: 'Erro interno.' });
    }
};

export const buscarChamadoPorId = async (req, res) => {
    try {
        const idNum = parseInt(req.params.id);
        const chamado = await ChamadoModel.findById(idNum);
        if (!chamado) return res.status(404).json({ success: false, message: 'Não encontrado.' });

        const Funcionario = { 
            nomeFuncionario: chamado.nomeRequisitante,
            email: chamado.emailRequisitante,
            telefone: chamado.telefoneRequisitante
        };
        const Atendente = chamado.atendente_id ? {
            nomeFuncionario: chamado.nomeAtendente,
            email: chamado.emailAtendente
        } : null;
        const Categorias = chamado.categoria_unificada_id ? { 
            id: chamado.categoria_unificada_id, 
            nome: chamado.nomeCategoria,
            nomePai: chamado.nomeCategoriaPai
        } : null;

        delete chamado.nomeRequisitante; delete chamado.emailRequisitante; delete chamado.telefoneRequisitante;
        delete chamado.nomeCategoria; delete chamado.nomeCategoriaPai; delete chamado.nomeAtendente; delete chamado.emailAtendente;

        res.status(200).json({ ...chamado, Funcionario, Categorias, Atendente });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro interno.' });
    }
};

export const deletarChamado = async (req, res) => {
    try {
        const result = await ChamadoModel.deleteById(parseInt(req.params.id));
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Não encontrado.' });
        res.status(200).json({ success: true });
    } catch (error) { res.status(500).json({ success: false }); }
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
// ======== RELATÓRIOS PDF (LAYOUT PROFISSIONAL) ========
// ====================================================

// Função auxiliar para desenhar o "Cartão" do chamado
const desenharCardChamado = (doc, ch, yPos) => {
    // Barra de Título (Fundo Cinza)
    doc.save();
    doc.fillColor('#f0f0f0');
    doc.rect(30, yPos, 535, 20).fill();
    doc.restore();

    // Texto Título (ID e Assunto)
    doc.fillColor('#000000').fontSize(10).font('Helvetica-Bold');
    let assuntoTopo = ch.assunto || 'Sem assunto';
    if (assuntoTopo.length > 60) assuntoTopo = assuntoTopo.substring(0, 60) + '...';
    
    doc.text(`#${ch.id} - ${assuntoTopo}`, 35, yPos + 6);
    
    // Status no canto direito
    doc.fontSize(9).text(ch.status.toUpperCase(), 400, yPos + 6, { align: 'right', width: 160 });

    yPos += 30; // Desce para o conteúdo

    const col1X = 35;
    const col2X = 300;
    const lineHeight = 14;

    // Linha 1: Loja e Prioridade
    doc.fontSize(9).font('Helvetica-Bold').text('Loja:', col1X, yPos);
    doc.font('Helvetica').text(ch.loja || 'N/A', col1X + 35, yPos);

    doc.font('Helvetica-Bold').text('Prioridade:', col2X, yPos);
    let corPrio = 'black';
    if (ch.prioridade === 'Alta') corPrio = 'red';
    if (ch.prioridade === 'Baixa') corPrio = 'green';
    doc.fillColor(corPrio).font('Helvetica-Bold').text(ch.prioridade, col2X + 60, yPos);
    doc.fillColor('black');

    yPos += lineHeight;

    // Linha 2: Categoria e Solicitante
    let catTexto = 'N/A';
    if (ch.nomeCategoria) catTexto = ch.nomeCategoriaPai ? `${ch.nomeCategoriaPai} > ${ch.nomeCategoria}` : ch.nomeCategoria;
    
    doc.font('Helvetica-Bold').text('Categoria:', col1X, yPos);
    doc.font('Helvetica').text(catTexto, col1X + 55, yPos, { width: 200, lineBreak: false, ellipsis: true });

    const solicitante = (ch.nomeRequisitante || ch.nomeRequisitanteManual || 'N/A').split(' ')[0];
    doc.font('Helvetica-Bold').text('Solicitante:', col2X, yPos);
    doc.font('Helvetica').text(solicitante, col2X + 60, yPos);

    yPos += lineHeight;

    // Linha 3: Data e Técnico
    const dataCriacao = ch.created_at ? new Date(ch.created_at).toLocaleString('pt-BR') : '-';
    doc.font('Helvetica-Bold').text('Aberto em:', col1X, yPos);
    doc.font('Helvetica').text(dataCriacao, col1X + 55, yPos);

    if (ch.nomeAtendente) {
        doc.font('Helvetica-Bold').text('Técnico:', col2X, yPos);
        doc.font('Helvetica').text(ch.nomeAtendente.split(' ')[0], col2X + 60, yPos);
    }

    yPos += lineHeight + 5;

    // Descrição (Texto justificado)
    doc.font('Helvetica-Bold').text('Descrição:', col1X, yPos);
    yPos += 12;
    let descricao = ch.descricao || 'Sem descrição.';
    descricao = descricao.replace(/(\r\n|\n|\r)/gm, " "); 
    
    doc.font('Helvetica').fontSize(8).fillColor('#444444');
    doc.text(descricao, col1X, yPos, { width: 525, align: 'justify' });
    
    const heightDesc = doc.heightOfString(descricao, { width: 525, fontSize: 8 });
    
    return yPos + heightDesc + 15; // Retorna nova posição Y
};

// 1. Relatório Simples (Lista)
export const gerarRelatorioChamados = async (req, res) => {
    try {
        const chamados = await ChamadoModel.findAll(req.query);
        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        const filename = `Relatorio_Chamados_${Date.now()}.pdf`;
        const logoPath = path.resolve(__dirname, '..', 'views', 'logo.png');

        res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
        res.setHeader('Content-type', 'application/pdf');
        doc.pipe(res);

        if (fs.existsSync(logoPath)) doc.image(logoPath, 30, 30, { width: 80 });
        doc.fontSize(16).font('Helvetica-Bold').text('Relatório de Chamados', 120, 35);
        doc.fontSize(10).font('Helvetica-Bold').text('Supermercado Rosalina', 120, 55);
        doc.fontSize(9).text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 400, 35, { align: 'right' });
        
        doc.moveDown(4);
        doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(30, doc.y).lineTo(565, doc.y).stroke();
        
        let yPos = doc.y + 20;

        chamados.forEach(ch => {
            if (yPos > 700) { doc.addPage(); yPos = 40; }
            yPos = desenharCardChamado(doc, ch, yPos);
            yPos += 10;
        });

        doc.end();
    } catch (error) {
        if (!res.headersSent) res.status(500).json({ error: "Erro PDF" });
    }
};

// 2. Relatório Completo (Gráfico + Estatísticas + Lista Detalhada)
export const gerarRelatorioCompleto = async (req, res) => {
    try {
        const { filtros, chartImage } = req.body; 
        const chamados = await ChamadoModel.findAll(filtros || {});

        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        const filename = `Relatorio_Gestao_${Date.now()}.pdf`;
        const logoPath = path.resolve(__dirname, '..', 'views', 'logo.png');

        res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
        res.setHeader('Content-type', 'application/pdf');
        doc.pipe(res);

        // --- CÁLCULO DE ESTATÍSTICAS ---
        const totalTickets = chamados.length;
        
        // Calcula período (Menor Data -> Maior Data)
        let periodoTexto = "Período: N/A";
        if (chamados.length > 0) {
            const datas = chamados.map(c => new Date(c.created_at));
            const minDate = new Date(Math.min.apply(null, datas));
            const maxDate = new Date(Math.max.apply(null, datas));
            periodoTexto = `Período: ${minDate.toLocaleDateString('pt-BR')} a ${maxDate.toLocaleDateString('pt-BR')}`;
        }

        // --- 1. CABEÇALHO GERAL ---
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 30, 30, { width: 80 }); 
        }

        doc.fontSize(16).font('Helvetica-Bold').text('Relatório de Gestão', 120, 35);
        doc.fontSize(10).font('Helvetica-Bold').text('Cliente: Supermercado Rosalina', 120, 55);
        doc.font('Helvetica').text(periodoTexto, 120, 68);
        
        // Box de Totais no topo direito
        doc.fontSize(9).text(`Total de Tickets: ${totalTickets}`, 400, 50, { align: 'right' });
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 400, 65, { align: 'right' });
        
        let yPos = 100;

        // --- 2. ESTATÍSTICAS E GRÁFICOS ---
        if (chartImage) {
            try {
                const base64Data = chartImage.replace(/^data:image\/\w+;base64,/, "");
                const imgBuffer = Buffer.from(base64Data, 'base64');

                doc.fontSize(12).font('Helvetica-Bold').text("Estatísticas e Métricas", 30, yPos);
                yPos += 20;

                // Centraliza o gráfico
                const chartWidth = 450;
                const chartHeight = 250;
                const xChart = (doc.page.width - chartWidth) / 2;

                doc.image(imgBuffer, xChart, yPos, { width: chartWidth, height: chartHeight });
                yPos += chartHeight + 30;
            } catch (e) {
                doc.text("[Erro ao renderizar gráfico]", 30, yPos, { color: 'red' });
                yPos += 40;
            }
        } else {
            yPos += 20;
        }

        doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(30, yPos).lineTo(565, yPos).stroke();
        yPos += 20;

        // --- 3. LISTA DE TICKETS (Estrutura Detalhada) ---
        doc.fontSize(12).font('Helvetica-Bold').fillColor('black').text("Estrutura dos Tickets", 30, yPos - 15);

        chamados.forEach((ch) => {
            if (yPos > 700) { doc.addPage(); yPos = 40; }
            yPos = desenharCardChamado(doc, ch, yPos);
            yPos += 10;
        });

        // Rodapé
        doc.fillColor('black').fontSize(8).text(`Fim do relatório - ${totalTickets} tickets processados.`, 30, 780, { align: 'center' });
        doc.end();

    } catch (error) {
        console.error("Erro Relatório Completo:", error);
        if (!res.headersSent) res.status(500).json({ error: "Erro ao gerar PDF" });
    }
};