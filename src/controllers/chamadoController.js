import * as ChamadoModel from '../models/chamadoModel.js';

// ====================================================
// ======== CRIAR CHAMADO ========
// ====================================================
export const criarChamado = async (req, res) => {
  try {
    const { chamado } = req.body;
    if (!chamado || !chamado.assunto || !chamado.descricao || !chamado.requisitante_id) {
      return res.status(400).json({ success: false, message: 'Assunto, Descrição e Requisitante são obrigatórios.' });
    }

    const dadosParaCriar = {
      assunto: chamado.assunto,
      descricao: chamado.descricao,
      prioridade: chamado.prioridade || 'Média',
      status: 'Aberto',
      requisitanteIdNum: parseInt(chamado.requisitante_id),
      categoriaIdNum: chamado.categoria_id ? parseInt(chamado.categoria_id) : null
    };

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
      const Funcionario = { nomeFuncionario: chamado.nomeRequisitante };
      const Categorias = chamado.categoria_id ? { nome: chamado.nomeCategoria } : null;
      delete chamado.nomeRequisitante;
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
