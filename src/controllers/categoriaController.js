import * as CategoriaModel from '../models/categoriaModel.js';

// --- 1. Rota de Listar (GET) ---
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
// (CORRIGIDO com variável 'categoria' no escopo correto)
export const criarCategoria = async (req, res) => {   
  // --- (INÍCIO DA CORREÇÃO) ---
  // A variável 'categoria' é declarada aqui fora...
  const { categoria } = req.body;
  // --- (FIM DA CORREÇÃO) ---
  
  try {
    if (!categoria || !categoria.nome) {
      return res.status(400).json({ message: 'O nome da categoria é obrigatório.' });
    }
    
    const novaCategoria = { 
      nome: categoria.nome,
      parent_id: categoria.parent_id || null 
    };
    
    const categoriaSalva = await CategoriaModel.create(novaCategoria);
    
    res.status(201).json({ message: 'Categoria criada com sucesso.', categoria: categoriaSalva });

  } catch (error) {   
    if (error.code === 'ER_DUP_ENTRY') {
      // --- (CORREÇÃO) ---
      // ...para que possa ser acessada aqui no 'catch' sem erro.
      return res.status(409).json({ message: `O nome '${categoria.nome}' já está em uso.` });
    }
    
    console.error("Erro ao criar categoria:", error); 
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

// --- 3. Rota de Atualizar (PUT) ---
// (CORRIGIDO com variável 'categoria' no escopo correto)
export const atualizarCategoria = async (req, res) => {
  // --- (INÍCIO DA CORREÇÃO) ---
  // A variável 'categoria' é declarada aqui fora...
  const { categoria } = req.body;
  const { id } = req.params;
  // --- (FIM DA CORREÇÃO) ---

  try {
    if (!categoria || !categoria.nome) {
      return res.status(400).json({ message: 'O nome da categoria é obrigatório.' });
    }

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
    if (error.code === 'ER_DUP_ENTRY') {
      // --- (CORREÇÃO) ---
      // ...para que possa ser acessada aqui no 'catch' sem erro.
      return res.status(409).json({ message: `O nome '${categoria.nome}' já está em uso.` });
    }
    
    console.error("Erro ao atualizar categoria:", error); 
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

// --- 4. Rota de Excluir (DELETE) ---
export const excluirCategoria = async (req, res) => {
  try {
    const { id } = req.params;
    const affectedRows = await CategoriaModel.remove(id);

    if (affectedRows === 0) {
      return res.status(404).json({ message: 'Categoria não encontrada.' });
    }

    res.status(200).json({ message: 'Categoria excluída com sucesso.' });

  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED') {
       return res.status(409).json({ message: 'Erro: Esta categoria é "pai" de outras e não pode ser excluída.' });
    }
    console.error("Erro ao excluir categoria:", error); 
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};