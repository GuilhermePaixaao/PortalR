// Arquivo: chamadoController.js (apenas a função criarChamado)

import * as ChamadoModel from '../models/chamadoModel.js';

// ====================================================
// ======== CRIAR CHAMADO ========
// ====================================================
export const criarChamado = async (req, res) => {
    try {
        const { chamado } = req.body;
        
        // Validação estendida: nome, email e telefone são obrigatórios, além dos campos originais
        if (!chamado || !chamado.assunto || !chamado.descricao || !chamado.requisitante_id || 
            !chamado.nome_requisitante_manual || !chamado.email_requisitante_manual || !chamado.telefone_requisitante_manual) {
            return res.status(400).json({ 
                success: false, 
                message: 'Assunto, Descrição e todos os dados do Requisitante são obrigatórios.' 
            });
        }

        const dadosParaCriar = {
            assunto: chamado.assunto,
            descricao: chamado.descricao,
            prioridade: chamado.prioridade || 'Média',
            status: 'Aberto',
            requisitanteIdNum: parseInt(chamado.requisitante_id),
            categoriaIdNum: chamado.categoria_id ? parseInt(chamado.categoria_id) : null,
            
            // Novos campos a serem salvos
            nomeRequisitanteManual: chamado.nome_requisitante_manual,
            emailRequisitanteManual: chamado.email_requisitante_manual,
            telefoneRequisitanteManual: chamado.telefone_requisitante_manual
        };

        const novoId = await ChamadoModel.create(dadosParaCriar);
        const novoChamado = await ChamadoModel.findById(novoId);

        res.status(201).json({ success: true, data: novoChamado });
    } catch (error) {
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            const field = error.message.includes('fk_Chamados_Funcionario') ? 'Requisitante' : 'Categoria';
            return res.status(400).json({ success: false, message: `Erro: ${field} não encontrado ou inválido.` });
        }
        console.error('Erro ao criar chamado:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
};

// ... restante do controller (listarChamados, deletarChamado, etc.)