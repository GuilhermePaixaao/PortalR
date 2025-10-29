import * as CategoriaModel from '../models/categoriaModel.js';

export const listarCategorias = async (req, res) => {
  try {
    const categorias = await CategoriaModel.findAll();
    res.status(200).json(categorias);
  } catch (error) {
    console.error("Erro ao buscar categorias:", error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};