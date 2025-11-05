// /controllers/subCategoriaController.js
// Linha 1 (Corrigida)
import * as SubcategoriaModel from '../models/subCategoriaModel.js';// GET /subcategorias
export const listarSubcategorias = async (req, res) => {
  try {
    const subcategorias = await SubcategoriaModel.findAll();
    res.status(200).json(subcategorias);
  } catch (error) {
    console.error("Erro ao buscar subcategorias:", error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

// POST /subcategorias
export const criarSubcategoria = async (req, res) => {   
  try {
    const { subcategoria } = req.body; 
    if (!subcategoria || !subcategoria.nome) {
      return res.status(400).json({ message: 'O nome é obrigatório.' });
    }
    if (!subcategoria.id_categoria) {
      return res.status(400).json({ message: 'A categoria pai é obrigatória.' });
    }
    
    const novaSubcategoria = { 
      nome: subcategoria.nome,
      id_categoria: subcategoria.id_categoria
    };
    
    const subcategoriaSalva = await SubcategoriaModel.create(novaSubcategoria);
    res.status(201).json(subcategoriaSalva); // Retorna o objeto salvo

  } catch (error) {   
    console.error("Erro ao criar subcategoria:", error); 
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

// PUT /subcategorias/:id
export const atualizarSubcategoria = async (req, res) => {
  try {
    const { id } = req.params;
    const { subcategoria } = req.body;

    if (!subcategoria || !subcategoria.nome || !subcategoria.id_categoria) {
      return res.status(400).json({ message: 'Nome e Categoria Pai são obrigatórios.' });
    }
    
    const dados = { nome: subcategoria.nome, id_categoria: subcategoria.id_categoria };
    const affectedRows = await SubcategoriaModel.update(id, dados);

    if (affectedRows === 0) {
      return res.status(404).json({ message: 'Subcategoria não encontrada.' });
    }
    res.status(200).json({ message: 'Subcategoria atualizada com sucesso.' });
  } catch (error) {
    console.error("Erro ao atualizar subcategoria:", error); 
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

// DELETE /subcategorias/:id
export const excluirSubcategoria = async (req, res) => {
  try {
    const { id } = req.params;
    const affectedRows = await SubcategoriaModel.remove(id);

    if (affectedRows === 0) {
      return res.status(404).json({ message: 'Subcategoria não encontrada.' });
    }
    res.status(200).json({ message: 'Subcategoria excluída com sucesso.' });
  } catch (error) {
    console.error("Erro ao excluir subcategoria:", error); 
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};