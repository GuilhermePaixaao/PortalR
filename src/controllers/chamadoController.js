import * as ChamadoModel from '../models/chamadoModel.js';

// ====================================================
// ======== CRIAR CHAMADO ========
// ====================================================
// Arquivo: chamadoController.js (apenas a função criarChamado)

import * as ChamadoModel from '../models/chamadoModel.js';

// ====================================================
// ======== CRIAR CHAMADO ========
// ====================================================
export const criarChamado = async (req, res) => {
    try {
        // --- CORREÇÃO AQUI ---
        // 'req.body.chamado' agora é o STRING que o FormData enviou.
        // Nós o transformamos de volta em um objeto JavaScript.
        const chamado = JSON.parse(req.body.chamado);
        
        // O restante do seu código agora funciona, pois 'chamado' é um objeto
        const { 
            assunto, descricao, prioridade, requisitante_id, categoria_id, 
            nome_requisitante_manual, email_requisitante_manual, telefone_requisitante_manual 
        } = chamado;

        // Validação (seu código original)
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
            categoriaIdNum: categoria_id ? parseInt(categoria_id) : null,
            
            nomeRequisitanteManual: nome_requisitante_manual,
            emailRequisitanteManual: email_requisitante_manual,
            telefoneRequisitanteManual: telefone_requisitante_manual
        };
        
        // NOTA: Os arquivos agora estão em req.files.anexos
        // console.log('Arquivos recebidos:', req.files.anexos);
        // (Você precisará adicionar a lógica para salvar esses arquivos no futuro)

        const novoId = await ChamadoModel.create(dadosParaCriar);
        const novoChamado = await ChamadoModel.findById(novoId);

        res.status(201).json({ success: true, data: novoChamado });
    } catch (error) {
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            const field = error.message.includes('fk_Chamados_Funcionario') ? 'Requisitante' : 'Categoria';
            return res.status(400).json({ success: false, message: `Erro: ${field} não encontrado.` });
        }
        console.error('Erro ao criar chamado:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
};

// ... (O restante do seu controller 'listarChamados', 'deletarChamado', etc. permanece igual)s

// ====================================================
// ======== LISTAR CHAMADOS ========
// ====================================================
export const listarChamados = async (req, res) => {
    try {
        // Captura os query params (filtros)
        const filtros = req.query;

        // Passa os filtros para o Model
        const chamados = await ChamadoModel.findAll(filtros);

        // Formata a resposta
        const chamadosFormatados = chamados.map(chamado => {
            // O Model já retornou os campos certos
            const Funcionario = { 
                nomeFuncionario: chamado.nomeRequisitante,
                email: chamado.emailRequisitante,
                telefone: chamado.telefoneRequisitante
            };
            const Categorias = chamado.categoria_id ? { nome: chamado.nomeCategoria } : null;
            
            // Remove as propriedades redundantes do objeto raiz para a resposta JSON
            delete chamado.nomeRequisitante;
            delete chamado.emailRequisitante;
            delete chamado.telefoneRequisitante;
            delete chamado.nomeCategoria;
            
            return { ...chamado, Funcionario, Categorias };
        });

        res.status(200).json(chamadosFormatados);
    } catch (error) {
        console.error('Erro ao buscar chamados:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
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
// ======== ATUALIZAR STATUS ========
// ====================================================
export const atualizarStatus = async (req, res) => {
    try {
        const idNum = parseInt(req.params.id);
        const { status } = req.body;

        if (isNaN(idNum) || !status) {
            return res.status(400).json({ success: false, message: 'ID e Status são obrigatórios.' });
        }

        const result = await ChamadoModel.updateStatus(idNum, status);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Erro: Chamado não encontrado.' });
        }

        res.status(200).json({ success: true, message: 'Status atualizado com sucesso.' });
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
};