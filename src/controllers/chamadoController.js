import * as ChamadoModel from '../models/chamadoModel.js';
// Importa o serviço de e-mail que criamos
import * as EmailService from '../services/emailService.js'; 

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
            nome_requisitante_manual, email_requisitante_manual, telefone_requisitante_manual
        } = chamado;

        if (!assunto || !descricao || !requisitante_id ||
            !nome_requisitante_manual || !email_requisitante_manual || !telefone_requisitante_manual) {
            return res.status(400).json({
                success: false,
                message: 'Assunto, Descrição, ID do Requisitante e todos os dados de Contato são obrigatórios.'
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
            telefoneRequisitanteManual: telefone_requisitante_manual
        };

        const novoId = await ChamadoModel.create(dadosParaCriar);
        
        // (Lógica para salvar anexos no banco de dados iria aqui)
        if (arquivos && arquivos.length > 0) {
            console.log(`Salvando ${arquivos.length} anexos para o chamado ${novoId}`);
        }
        
        // Busca o chamado completo recém-criado
        const novoChamado = await ChamadoModel.findById(novoId);
        
        // =================================================
        // NOTIFICAÇÃO EM TEMPO REAL VIA SOCKET
        // =================================================
        if (req.io) {
            req.io.emit('novoChamadoInterno', {
                id: novoChamado.id,
                assunto: novoChamado.assunto,
                requisitante: novoChamado.nomeRequisitante || "Alguém",
                prioridade: novoChamado.prioridade
            });
        }

        // =================================================
        // [NOVO] ENVIO DE E-MAIL DE CRIAÇÃO
        // =================================================
        if (novoChamado.emailRequisitante) {
            // Envia o e-mail sem 'await' para não travar a resposta da API
            EmailService.enviarNotificacaoCriacao(novoChamado.emailRequisitante, novoChamado)
                .catch(err => console.error("Falha silenciosa ao enviar e-mail de criação:", err));
        }
        
        // Formata a resposta
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

        // Limpa campos duplicados
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
            const field = error.message.includes('fk_Chamados_Funcionario') ? 'Requisitante' : 'Categoria';
            return res.status(400).json({ success: false, message: `Erro: ${field} não encontrado.` });
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

        // =================================================
        // [NOVO] ENVIO DE E-MAIL DE ATUALIZAÇÃO
        // =================================================
        // Precisamos buscar o chamado atualizado para pegar o e-mail do requisitante e o assunto
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