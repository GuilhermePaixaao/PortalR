import * as ChamadoModel from '../models/chamadoModel.js';
import * as EmailService from '../services/emailService.js'; 

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
            departamento_id: departamento ? parseInt(departamento) : null,
            atendenteId: 4
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
        const id = parseInt(req.params.id);
        const chamado = await ChamadoModel.findById(id);
        
        if (!chamado) return res.status(404).json({ success: false, message: 'Não encontrado.' });
        
        // --- [NOVO] Busca os tempos calculados ---
        const tempos = await ChamadoModel.getTemposChamado(id);
        // ----------------------------------------

        const resposta = {
            ...chamado,
            Tempos: tempos, // Adiciona o objeto com os tempos na resposta
            Funcionario: { nomeFuncionario: chamado.nomeRequisitante, email: chamado.emailRequisitante, telefone: chamado.telefoneRequisitante },
            Atendente: chamado.atendente_id ? { nomeFuncionario: chamado.nomeAtendente, email: chamado.emailAtendente } : null,
            Categorias: chamado.categoria_unificada_id ? { id: chamado.categoria_unificada_id, nome: chamado.nomeCategoria, nomePai: chamado.nomeCategoriaPai } : null
        };
        res.status(200).json(resposta);
    } catch (error) {
        console.error(error);
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
        
        // ChamadoModel.updateStatus agora já salva no histórico automaticamente
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
// --- NOVOS CONTROLADORES ---

export const atualizarAssunto = async (req, res) => {
    try {
        const result = await ChamadoModel.updateAssunto(parseInt(req.params.id), req.body.assunto);
        if (result.affectedRows === 0) return res.status(404).json({ success: false });
        res.status(200).json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const atualizarDescricao = async (req, res) => {
    try {
        const result = await ChamadoModel.updateDescricao(parseInt(req.params.id), req.body.descricao);
        if (result.affectedRows === 0) return res.status(404).json({ success: false });
        res.status(200).json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const atualizarRequisitante = async (req, res) => {
    try {
        const result = await ChamadoModel.updateRequisitante(parseInt(req.params.id), parseInt(req.body.requisitanteId));
        if (result.affectedRows === 0) return res.status(404).json({ success: false });
        res.status(200).json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const atualizarLojaDepartamento = async (req, res) => {
    try {
        const { lojaId, departamentoId } = req.body;
        const result = await ChamadoModel.updateLojaDepartamento(parseInt(req.params.id), parseInt(lojaId), parseInt(departamentoId));
        if (result.affectedRows === 0) return res.status(404).json({ success: false });
        res.status(200).json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};