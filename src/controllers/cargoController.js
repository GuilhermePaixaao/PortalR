import * as CargoModel from '../models/cargoModel.js';

export const criarCargo = async (req, res) => {
  try {
    const { nome } = req.body;
    if (!nome) {
      return res.status(400).json({ message: "O campo 'nome' é obrigatório." });
    }
    const result = await CargoModel.create(nome);
    res.status(201).json({ idCargo: result.insertId, nome: nome });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: `O cargo '${nome}' já existe.` });
    }
    console.error("Erro ao criar cargo:", error);
    res.status(500).json({ message: "Erro interno no servidor." });
  }
};

export const listarCargos = async (req, res) => {
  try {
    const cargos = await CargoModel.findAll();
    res.status(200).json(cargos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const atualizarCargo = async (req, res) => {
  try {
    const idNum = parseInt(req.params.id);
    if (isNaN(idNum)) {
      return res.status(400).json({ success: false, message: 'ID de cargo inválido.' });
    }
    const { nome } = req.body;
    if (!nome) {
      return res.status(400).json({ success: false, message: "O campo 'nome' é obrigatório." });
    }

    const result = await CargoModel.update(idNum, nome);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Cargo não encontrado.' });
    }
    res.status(200).json({ success: true, data: { idCargo: idNum, nome: nome } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: `O cargo '${nome}' já existe.` });
    }
    console.error("Erro ao atualizar cargo:", error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
};

export const deletarCargo = async (req, res) => {
  try {
    const idNum = parseInt(req.params.id);
    if (isNaN(idNum)) {
      return res.status(400).json({ success: false, message: 'ID de cargo inválido.' });
    }
    const result = await CargoModel.deleteById(idNum);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Cargo não encontrado.' });
    }
    res.status(200).json({ success: true, message: 'Cargo deletado.' });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ success: false, message: 'Erro: Este cargo está em uso por um ou mais funcionários e não pode ser excluído.' });
    }
    console.error("Erro ao deletar cargo:", error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
};