// controllers/subcategoriaController.js
import * as SubcategoriaModel from '../models/subcategoriaModel.js';

// (listarSubcategorias, atualizar e excluir serão muito parecidos)

// NOVO CRIAR
export const criarSubcategoria = async (req, res) => {   
  try {
    // O frontend enviará: { "subcategoria": { "nome": "...", "id_categoria": 1 } }
    const { subcategoria } = req.body; 

    // Validação
    if (!subcategoria || !subcategoria.nome) {
      return res.status(400).json({ message: 'O nome da subcategoria é obrigatório.' });
    }
    // Nova validação
    if (!subcategoria.id_categoria) {
      return res.status(400).json({ message: 'A categoria (pai) é obrigatória.' });
    }
    
    // Monta o objeto para o Model
    const novaSubcategoria = { 
      nome: subcategoria.nome,
      id_categoria: subcategoria.id_categoria // Adiciona o novo campo
    };
    
    const subcategoriaSalva = await SubcategoriaModel.create(novaSubcategoria);
    res.status(201).json({ message: 'Subcategoria criada com sucesso.', subcategoria: subcategoriaSalva });

  } catch (error) {   
    console.error("Erro ao criar subcategoria:", error); 
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};