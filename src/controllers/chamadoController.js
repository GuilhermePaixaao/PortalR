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
export const gerarRelatorioChamados = async (req, res) => {
    try {
        const chamados = await ChamadoModel.findAll(req.query);
        
        // Define margens e tamanho
        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        const filename = `Relatorio_Atendimentos_${Date.now()}.pdf`;

        // Tenta encontrar a logo em pasta views ou public
        const logoPath = path.resolve(__dirname, '..', 'views', 'logo.png'); 

        res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
        res.setHeader('Content-type', 'application/pdf');

        doc.pipe(res);

        // --- CABEÇALHO ---
        // Desenha a logo se existir
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 30, 30, { width: 80 }); 
        }

        // Título e Dados da Empresa (Alinhado a direita/centro)
        // Posição X aproximada 120 para não sobrepor a logo
        doc.fontSize(16).font('Helvetica-Bold').text('Relatório de Atendimentos', 120, 35, { align: 'left' });
        
        doc.fontSize(10).font('Helvetica-Bold').text('Supermercado Rosalina', 120, 55);
        doc.font('Helvetica').text('Avenida Nicanor Reis, Jardim Torrão de Ouro', 120, 68);
        doc.text('São José dos Campos - SP', 120, 81);

        // Data de Geração no canto direito
        doc.fontSize(9).text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 400, 35, { align: 'right' });

        // Exibir Filtros Aplicados
        let filtrosTexto = [];
        if (req.query.loja_id) filtrosTexto.push(`Loja ID: ${req.query.loja_id}`);
        if (req.query.status) filtrosTexto.push(`Status: ${req.query.status}`);
        if (req.query.categoria_id) filtrosTexto.push(`Categoria ID: ${req.query.categoria_id}`);
        
        if (filtrosTexto.length > 0) {
            doc.text(`Filtros: ${filtrosTexto.join(' | ')}`, 400, 50, { align: 'right', color: 'gray' });
        }

        // Linha divisória do cabeçalho
        doc.moveDown(4);
        let yPos = doc.y;
        doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(30, yPos).lineTo(565, yPos).stroke();
        
        yPos += 15; // Espaço após linha

        // --- LISTA DE CHAMADOS (Estilo "Card") ---
        doc.fillColor('black');

        chamados.forEach((ch) => {
            // Verifica quebra de página
            if (yPos > 700) {
                doc.addPage();
                yPos = 40; // Margem topo nova página
            }

            // --- BLOCO DO CHAMADO ---
            // ID grande na esquerda
            doc.fontSize(14).font('Helvetica-Bold').text(`#${ch.id}`, 30, yPos);
            
            // Coluna Central (Detalhes) - X = 80
            let xContent = 90;
            
            // Linha 1: Loja e Requisitante
            const nomeLoja = ch.loja || 'Loja não identificada';
            const solicitante = (ch.nomeRequisitante || ch.nomeRequisitanteManual || 'N/A').split(' ')[0];
            doc.fontSize(10).font('Helvetica-Bold').text(nomeLoja.toUpperCase(), xContent, yPos);
            doc.font('Helvetica').fontSize(9).text(`Solicitante: ${solicitante}`, xContent + 200, yPos); // Na mesma linha, mais à direita

            // Linha 2: Assunto
            const line2Y = yPos + 15;
            doc.font('Helvetica-Bold').fontSize(9).text('Assunto:', xContent, line2Y);
            doc.font('Helvetica').text(ch.assunto || 'Sem assunto', xContent + 45, line2Y);

            // Linha 3: Categoria e Status
            const line3Y = line2Y + 15;
            let catTexto = 'N/A';
            if (ch.nomeCategoria) {
                 catTexto = ch.nomeCategoriaPai ? `${ch.nomeCategoriaPai} > ${ch.nomeCategoria}` : ch.nomeCategoria;
            }
            doc.font('Helvetica-Bold').text('Categoria:', xContent, line3Y);
            doc.font('Helvetica').text(catTexto, xContent + 50, line3Y);
            
            // Status alinhado à direita
            doc.font('Helvetica-Bold').text('Status:', 400, line3Y);
            doc.font('Helvetica').text(ch.status, 440, line3Y);

            // Linha 4: Datas e Técnico
            const line4Y = line3Y + 15;
            const dataCriacao = ch.created_at ? new Date(ch.created_at).toLocaleString('pt-BR') : 'N/A';
            doc.font('Helvetica-Bold').text('Criado em:', xContent, line4Y);
            doc.font('Helvetica').text(dataCriacao, xContent + 50, line4Y);

            if (ch.nomeAtendente) {
                doc.font('Helvetica-Bold').text('Técnico:', 400, line4Y);
                doc.font('Helvetica').text(ch.nomeAtendente.split(' ')[0], 440, line4Y);
            }

            // Linha 5: Descrição (Texto corrido)
            const line5Y = line4Y + 18;
            doc.font('Helvetica-Bold').text('Descrição:', xContent, line5Y);
            
            let descricao = ch.descricao || '';
            // Limita descrição para não quebrar layout drasticamente
            if (descricao.length > 250) descricao = descricao.substring(0, 250) + '...';
            
            doc.font('Helvetica').fontSize(8).fillColor('#444444')
               .text(descricao, xContent, line5Y + 10, { width: 450, align: 'justify' });

            // Linha Separadora Final do Item
            doc.fillColor('black'); // Reset cor
            const endY = doc.y + 10;
            doc.strokeColor('#e0e0e0').lineWidth(1).moveTo(30, endY).lineTo(565, endY).stroke();
            
            // Atualiza yPos para o próximo item
            yPos = endY + 15;
        });

        // Rodapé
        doc.fontSize(8).fillColor('#777777').text(`Total de registros: ${chamados.length}`, 30, 780, { align: 'left' });
        doc.text('Portal Supermercado Rosalina', 30, 780, { align: 'right' });

        doc.end();

    } catch (error) {
        console.error("Erro ao gerar relatório:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: "Erro ao gerar PDF" });
        }
    }
};