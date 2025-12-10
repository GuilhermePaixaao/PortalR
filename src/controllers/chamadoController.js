import * as ChamadoModel from '../models/chamadoModel.js';
import * as EmailService from '../services/emailService.js'; 
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuração para caminhos de arquivo (necessário para pegar a logo)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ====================================================
// ======== NOVAS FUNÇÕES PARA DADOS DINÂMICOS ========
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
// ======== CRIAR CHAMADO (COM ENVIO DE E-MAIL) ========
// ====================================================
export const criarChamado = async (req, res) => {
    try {
        if (!req.body.chamado) {
            return res.status(400).json({
                success: false,
                message: "Dados do 'chamado' não encontrados. Verifique se está a enviar FormData."
            });
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
            return res.status(400).json({
                success: false,
                message: 'Assunto, Descrição, ID do Requisitante, Nome e Telefone são obrigatórios.'
            });
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
            console.log(`Salvando ${arquivos.length} anexos para o chamado ${novoId}`);
        }
        
        const novoChamado = await ChamadoModel.findById(novoId);
        
        if (req.io) {
            req.io.emit('novoChamadoInterno', {
                id: novoChamado.id,
                assunto: novoChamado.assunto,
                requisitante: novoChamado.nomeRequisitante || "Alguém",
                prioridade: novoChamado.prioridade
            });
        }

        if (novoChamado.emailRequisitante) {
            EmailService.enviarNotificacaoCriacao(novoChamado.emailRequisitante, novoChamado)
                .catch(err => console.error("Falha silenciosa ao enviar e-mail de criação:", err));
        }
        
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

        delete novoChamado.nomeRequisitante;
        delete novoChamado.emailRequisitante;
        delete novoChamado.telefoneRequisitante;
        delete novoChamado.nomeCategoria;
        delete novoChamado.nomeCategoriaPai;

        const chamadoFormatado = { ...novoChamado, Funcionario, Categorias };

        res.status(201).json({ success: true, data: chamadoFormatado });

    } catch (error) {
        if (error instanceof SyntaxError) {
            return res.status(400).json({ success: false, message: 'Erro ao processar dados: JSON do chamado mal formatado.' });
        }
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            let msg = 'Erro de integridade: Registro referenciado não encontrado.';
            if (error.message.includes('fk_Chamados_Loja')) msg = 'Erro: A Loja selecionada é inválida.';
            else if (error.message.includes('fk_Chamados_Departamento')) msg = 'Erro: O Departamento selecionado é inválido.';
            else if (error.message.includes('fk_Chamados_Funcionario')) msg = 'Erro: Requisitante não encontrado.';
            else if (error.message.includes('categoria_unificada_id')) msg = 'Erro: Categoria inválida.';
            
            return res.status(400).json({ success: false, message: msg });
        }
        console.error('Erro ao criar chamado:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
};

// ====================================================
// ======== LISTAR CHAMADOS ========
// ====================================================
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
            
            delete chamado.nomeRequisitante;
            delete chamado.emailRequisitante;
            delete chamado.telefoneRequisitante;
            delete chamado.nomeCategoria;
            delete chamado.nomeCategoriaPai; 
            delete chamado.nomeAtendente;
            delete chamado.emailAtendente;

            return { ...chamado, Funcionario, Categorias, Atendente };
        });

        res.status(200).json(chamadosFormatados);
    } catch (error) {
        console.error('Erro ao buscar chamados:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};

// ====================================================
// ======== BUSCAR CHAMADO POR ID ========
// ====================================================
export const buscarChamadoPorId = async (req, res) => {
    try {
        const idNum = parseInt(req.params.id);
        if (isNaN(idNum)) {
            return res.status(400).json({ success: false, message: 'ID de chamado inválido.' });
        }

        const chamado = await ChamadoModel.findById(idNum);
        
        if (!chamado) {
            return res.status(404).json({ success: false, message: 'Chamado não encontrado.' });
        }

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

        delete chamado.nomeRequisitante;
        delete chamado.emailRequisitante;
        delete chamado.telefoneRequisitante;
        delete chamado.nomeCategoria;
        delete chamado.nomeCategoriaPai;
        delete chamado.nomeAtendente;
        delete chamado.emailAtendente;

        res.status(200).json({ ...chamado, Funcionario, Categorias, Atendente });

    } catch (error) {
        console.error('Erro ao buscar chamado por ID:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
};

// ====================================================
// ======== DELETAR CHAMADO ========
// ====================================================
export const deletarChamado = async (req, res) => {
    try {
        const idNum = parseInt(req.params.id);
        if (isNaN(idNum)) {
            return res.status(400).json({ success: false, message: 'ID de chamado inválido.' });
        }
        const result = await ChamadoModel.deleteById(idNum);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Erro: Chamado não encontrado.' });
        }
        res.status(200).json({ success: true, message: 'Chamado deletado com sucesso.' });
    } catch (error) {
        console.error('Erro ao deletar chamado:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
};

// ====================================================
// ======== ATUALIZAR STATUS (COM ENVIO DE E-MAIL) ========
// ====================================================
export const atualizarStatus = async (req, res) => {
    console.log("[BACKEND] Corpo da requisição recebido:", req.body);
    try {
        const idNum = parseInt(req.params.id);
        const { status, atendenteId } = req.body; 
        if (isNaN(idNum) || !status) {
            return res.status(400).json({ success: false, message: 'ID e Status são obrigatórios.' });
        }
        
        console.log(`[BACKEND] Tentando salvar: ID=${idNum}, Status=${status}, AtendenteID=${atendenteId}`);
        const result = await ChamadoModel.updateStatus(idNum, status, atendenteId ? parseInt(atendenteId) : null);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Erro: Chamado não encontrado.' });
        }

        const chamadoAtualizado = await ChamadoModel.findById(idNum);
        
        if (chamadoAtualizado && chamadoAtualizado.emailRequisitante) {
            EmailService.enviarNotificacaoStatus(
                chamadoAtualizado.emailRequisitante, 
                chamadoAtualizado, 
                status
            ).catch(err => console.error("Falha silenciosa ao enviar e-mail de status:", err));
        }

        res.status(200).json({ success: true, message: 'Status atualizado com sucesso.' });
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
};

// ====================================================
// ======== ATUALIZAR PRIORIDADE ========
// ====================================================
export const atualizarPrioridade = async (req, res) => {
    try {
        const idNum = parseInt(req.params.id);
        const { prioridade } = req.body;
        if (isNaN(idNum) || !prioridade) {
            return res.status(400).json({ success: false, message: 'ID e Prioridade são obrigatórios.' });
        }
        const result = await ChamadoModel.updatePrioridade(idNum, prioridade);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Erro: Chamado não encontrado.' });
        }
        res.status(200).json({ success: true, message: 'Prioridade atualizada com sucesso.' });
    } catch (error) {
        console.error('Erro ao atualizar prioridade:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
};

// ====================================================
// ======== ATUALIZAR ATENDENTE ========
// ====================================================
export const atualizarAtendente = async (req, res) => {
    try {
        const idNum = parseInt(req.params.id);
        const { atendenteId } = req.body; 
        const novoAtendenteId = (atendenteId && parseInt(atendenteId) > 0) ? parseInt(atendenteId) : null;
        console.log(`[BACKEND] Trocando atendente: ID=${idNum}, Novo AtendenteID=${novoAtendenteId}`);
        const result = await ChamadoModel.updateAtendente(idNum, novoAtendenteId);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Erro: Chamado não encontrado.' });
        }
        res.status(200).json({ success: true, message: 'Atendente atualizado com sucesso.' });
    } catch (error) {
        console.error('Erro ao atualizar atendente:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
};

// ====================================================
// ======== (NOVO) ATUALIZAR CATEGORIA ========
// ====================================================
export const atualizarCategoria = async (req, res) => {
    try {
        const idNum = parseInt(req.params.id);
        const { categoriaId } = req.body;

        if (isNaN(idNum) || !categoriaId) {
            return res.status(400).json({ success: false, message: 'ID e Nova Categoria são obrigatórios.' });
        }

        const result = await ChamadoModel.updateCategoria(idNum, parseInt(categoriaId));

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Erro: Chamado não encontrado.' });
        }

        res.status(200).json({ success: true, message: 'Categoria atualizada com sucesso.' });
    } catch (error) {
        console.error('Erro ao atualizar categoria:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
};

// ====================================================
// ======== CONTAR CHAMADOS POR STATUS ========
// ====================================================
export const contarChamadosPorStatus = async (req, res) => {
    try {
        const counts = await ChamadoModel.countByStatus();
        const resultadoFormatado = counts.reduce((acc, item) => {
            acc[item.status] = item.count;
            return acc;
        }, {});
        const finalData = {
            "Aberto": resultadoFormatado["Aberto"] || 0,
            "Em Andamento": resultadoFormatado["Em Andamento"] || 0,
            "Concluído": resultadoFormatado["Concluído"] || 0,
            "Pausado": resultadoFormatado["Pausado"] || 0,
        };
        res.status(200).json(finalData);
    } catch (error) {
        console.error('Erro ao contar chamados por status:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao buscar contagens.' });
    }
};

// ====================================================
// ======== GERAR RELATÓRIO PDF (LAYOUT PROFISSIONAL) ========
// ====================================================
// ====================================================
// ======== RELATÓRIO COMPLETO (GRÁFICO + LAYOUT PROFISSIONAL) ========
// ====================================================
export const gerarRelatorioCompleto = async (req, res) => {
    try {
        const { filtros, chartImage } = req.body; 
        const chamados = await ChamadoModel.findAll(filtros || {});

        const doc = new PDFDocument({ margin: 30, size: 'A4' }); // Margens menores para aproveitar espaço
        const filename = `Relatorio_Gestao_${Date.now()}.pdf`;
        const logoPath = path.resolve(__dirname, '..', 'views', 'logo.png');

        res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
        res.setHeader('Content-type', 'application/pdf');

        doc.pipe(res);

        // --- 1. CABEÇALHO ---
        // Logo
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 30, 30, { width: 80 }); 
        }

        // Título e Empresa
        doc.fontSize(16).font('Helvetica-Bold').text('Relatório de Gestão', 120, 35);
        doc.fontSize(10).font('Helvetica-Bold').text('Supermercado Rosalina', 120, 55);
        doc.font('Helvetica').text('Relatório Analítico com Gráficos', 120, 68);

        // Data e Filtros (Direita)
        doc.fontSize(9).text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 400, 35, { align: 'right' });
        
        // --- 2. ÁREA DO GRÁFICO ---
        let yPos = 100; // Posição inicial segura

        if (chartImage) {
            try {
                const base64Data = chartImage.replace(/^data:image\/\w+;base64,/, "");
                const imgBuffer = Buffer.from(base64Data, 'base64');

                // Título da Seção
                doc.fontSize(12).font('Helvetica-Bold').text("Análise Gráfica", 30, yPos);
                doc.moveDown(0.5);
                yPos += 20;

                // Centraliza o gráfico
                // A4 width ~595pts. Margem 30. Largura útil ~535.
                // Vamos usar largura 450 pro gráfico.
                const chartWidth = 450;
                const chartHeight = 250;
                const xChart = (doc.page.width - chartWidth) / 2;

                doc.image(imgBuffer, xChart, yPos, { width: chartWidth, height: chartHeight });
                
                yPos += chartHeight + 30; // Espaço após o gráfico
            } catch (e) {
                console.error("Erro gráfico:", e);
                doc.text("[Erro ao renderizar gráfico]", 30, yPos, { color: 'red' });
                yPos += 40;
            }
        } else {
            yPos += 20;
        }

        // Linha Divisória
        doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(30, yPos).lineTo(565, yPos).stroke();
        yPos += 20;

        // --- 3. LISTA DE CHAMADOS (LAYOUT ORGANIZADO) ---
        doc.fontSize(12).font('Helvetica-Bold').fillColor('black').text("Detalhamento dos Tickets", 30, yPos - 15);

        chamados.forEach((ch) => {
            // Verifica se cabe na página (considerando um bloco de ~100px)
            if (yPos > 700) {
                doc.addPage();
                yPos = 40;
            }

            // --- BARRA DE TÍTULO DO CARD (Fundo Cinza) ---
            // Desenha um retângulo cinza
            doc.save(); // Salva estado para não afetar o resto
            doc.fillColor('#f0f0f0');
            doc.rect(30, yPos, 535, 20).fill();
            doc.restore();

            // Texto do Título (ID e Assunto)
            doc.fillColor('#000000').fontSize(10).font('Helvetica-Bold');
            // Corta assunto se for muito longo
            let assuntoTopo = ch.assunto || 'Sem assunto';
            if (assuntoTopo.length > 60) assuntoTopo = assuntoTopo.substring(0, 60) + '...';

            doc.text(`#${ch.id} - ${assuntoTopo}`, 35, yPos + 6);
            
            // Status na direita da barra
            doc.fontSize(9).text(ch.status.toUpperCase(), 400, yPos + 6, { align: 'right', width: 160 });

            yPos += 30; // Desce para o conteúdo do card

            // --- COLUNAS DE DADOS ---
            const col1X = 35;
            const col2X = 300;
            const lineHeight = 14;

            // Linha 1: Loja vs Prioridade
            doc.fontSize(9).font('Helvetica-Bold').text('Loja:', col1X, yPos);
            doc.font('Helvetica').text(ch.loja || 'N/A', col1X + 35, yPos);

            doc.font('Helvetica-Bold').text('Prioridade:', col2X, yPos);
            
            // Cor da prioridade (Visual)
            let corPrio = 'black';
            if (ch.prioridade === 'Alta') corPrio = 'red';
            if (ch.prioridade === 'Baixa') corPrio = 'green';
            
            doc.fillColor(corPrio).font('Helvetica-Bold').text(ch.prioridade, col2X + 60, yPos);
            doc.fillColor('black'); // Reset

            yPos += lineHeight;

            // Linha 2: Categoria vs Solicitante
            let catTexto = 'N/A';
            if (ch.nomeCategoria) catTexto = ch.nomeCategoriaPai ? `${ch.nomeCategoriaPai} > ${ch.nomeCategoria}` : ch.nomeCategoria;
            
            doc.font('Helvetica-Bold').text('Categoria:', col1X, yPos);
            doc.font('Helvetica').text(catTexto, col1X + 55, yPos, { width: 200, lineBreak: false, ellipsis: true });

            const solicitante = (ch.nomeRequisitante || ch.nomeRequisitanteManual || 'N/A').split(' ')[0];
            doc.font('Helvetica-Bold').text('Solicitante:', col2X, yPos);
            doc.font('Helvetica').text(solicitante, col2X + 60, yPos);

            yPos += lineHeight;

            // Linha 3: Data vs Técnico
            const dataCriacao = ch.created_at ? new Date(ch.created_at).toLocaleString('pt-BR') : '-';
            doc.font('Helvetica-Bold').text('Aberto em:', col1X, yPos);
            doc.font('Helvetica').text(dataCriacao, col1X + 55, yPos);

            if (ch.nomeAtendente) {
                doc.font('Helvetica-Bold').text('Técnico:', col2X, yPos);
                doc.font('Helvetica').text(ch.nomeAtendente.split(' ')[0], col2X + 60, yPos);
            }

            yPos += lineHeight + 5;

            // --- DESCRIÇÃO (Bloco separado) ---
            doc.font('Helvetica-Bold').text('Descrição:', col1X, yPos);
            yPos += 12;
            
            let descricao = ch.descricao || 'Sem descrição.';
            // Remove quebras de linha excessivas para economizar espaço
            descricao = descricao.replace(/(\r\n|\n|\r)/gm, " ");
            
            doc.font('Helvetica').fontSize(8).fillColor('#444444');
            doc.text(descricao, col1X, yPos, { width: 525, align: 'justify' });
            
            // Calcula o quanto o texto ocupou para pular proximo item
            const heightDesc = doc.heightOfString(descricao, { width: 525, fontSize: 8 });
            yPos += heightDesc + 15;

            // Linha fina separadora (opcional, já que temos a barra cinza)
            // doc.strokeColor('#eeeeee').lineWidth(1).moveTo(30, yPos - 5).lineTo(565, yPos - 5).stroke();
            
            yPos += 10; // Margem extra para o próximo card
        });

        // Rodapé Final
        doc.fillColor('black').fontSize(8).text(`Fim do relatório - Total: ${chamados.length} registros.`, 30, 780, { align: 'center' });

        doc.end();

    } catch (error) {
        console.error("Erro Relatório Completo:", error);
        if (!res.headersSent) res.status(500).json({ error: "Erro ao gerar PDF" });
    }
};