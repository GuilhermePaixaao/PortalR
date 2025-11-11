import * as CategoriaModel from '../models/categoriaModel.js';

// --- 1. Rota de Listar (GET) ---
// (Não precisa de mudanças, o Model já foi atualizado)
export const listarCategorias = async (req, res) => {
  try {
    const categorias = await CategoriaModel.findAll();
    res.status(200).json(categorias);
  } catch (error) {
    console.error("Erro ao buscar categorias:", error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};


// --- 2. Rota de Criar (POST) ---
// (ATUALIZADO para incluir parent_id)
export const criarCategoria = async (req, res) => {   
  try {
    const { categoria } = req.body;

    if (!categoria || !categoria.nome) {
      return res.status(400).json({ message: 'O nome da categoria é obrigatório.' });
    }
    
    // Agora pegamos o nome e o parent_id (que pode ser null)
    const novaCategoria = { 
      nome: categoria.nome,
      parent_id: categoria.parent_id || null 
    };
    
    const categoriaSalva = await CategoriaModel.create(novaCategoria);
    
    res.status(201).json({ message: 'Categoria criada com sucesso.', categoria: categoriaSalva });

  } catch (error) {   
    console.error("Erro ao criar categoria:", error); 
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

// --- 3. Rota de Atualizar (PUT) ---
// (ATUALIZADO para incluir parent_id)
export const atualizarCategoria = async (req, res) => {
  try {
    const { id } = req.params;
    const { categoria } = req.body;

    if (!categoria || !categoria.nome) {
      return res.status(400).json({ message: 'O nome da categoria é obrigatório.' });
    }

    // Agora atualizamos o nome e o parent_id
    const dadosCategoria = { 
      nome: categoria.nome,
      parent_id: categoria.parent_id || null
    };
    
    const affectedRows = await CategoriaModel.update(id, dadosCategoria);

    if (affectedRows === 0) {
      return res.status(404).json({ message: 'Categoria não encontrada.' });
    }

    res.status(200).json({ 
        message: 'Categoria atualizada com sucesso.', 
        categoria: {id: parseInt(id), ...dadosCategoria} 
    });

  } catch (error) {
    console.error("Erro ao atualizar categoria:", error); 
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

// --- 4. Rota de Excluir (DELETE) ---
// (Não precisa de mudanças)
export const excluirCategoria = async (req, res) => {
  try {
    const { id } = req.params;
    const affectedRows = await CategoriaModel.remove(id);

    if (affectedRows === 0) {
      return res.status(404).json({ message: 'Categoria não encontrada.' });
    }

    res.status(200).json({ message: 'Categoria excluída com sucesso.' });

  } catch (error) {
    // (NOVO) Tratamento de erro se tentar excluir uma categoria-pai
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED') {
       return res.status(409).json({ message: 'Erro: Esta categoria é "pai" de outras e não pode ser excluída.' });
    }
    console.error("Erro ao excluir categoria:", error); 
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};