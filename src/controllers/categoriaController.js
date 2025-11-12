import * as CategoriaModel from '../models/categoriaModel.js';

// --- 1. Rota de Listar (GET) ---
// (Não precisa de alteração. Nosso Model (Passo 1) já faz o trabalho de buscar o nome_pai)
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
// (CORRIGIDO: O 'parent_id' agora é lido e salvo corretamente)
export const criarCategoria = async (req, res) => {   
  // A variável 'categoria' é lida do corpo da requisição
  const { categoria } = req.body;
  
  try {
    if (!categoria || !categoria.nome) {
      return res.status(400).json({ message: 'O nome da categoria é obrigatório.' });
    }
    
    // Prepara os dados para o Model, incluindo o parent_id
    const novaCategoria = { 
      nome: categoria.nome,
      // Se parent_id for enviado e não for vazio, usa. Senão, salva como NULL.
      parent_id: categoria.parent_id ? parseInt(categoria.parent_id) : null 
    };
    
    const categoriaSalva = await CategoriaModel.create(novaCategoria);
    
    res.status(201).json({ message: 'Categoria criada com sucesso.', categoria: categoriaSalva });

  } catch (error) {   
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: `O nome '${categoria.nome}' já está em uso.` });
    }
    
    console.error("Erro ao criar categoria:", error); 
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

// --- 3. Rota de Atualizar (PUT) ---
// (CORRIGIDO: O 'parent_id' agora é lido e salvo corretamente)
export const atualizarCategoria = async (req, res) => {
  const { categoria } = req.body;
  const { id } = req.params;

  try {
    if (!categoria || !categoria.nome) {
      return res.status(400).json({ message: 'O nome da categoria é obrigatório.' });
    }

    // Prepara os dados para o Model
    const dadosCategoria = { 
      nome: categoria.nome,
      parent_id: categoria.parent_id ? parseInt(categoria.parent_id) : null
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
      return res.status(409).json({ message: `O nome '${categoria.nome}' já está em uso.` });
    }
    
    console.error("Erro ao atualizar categoria:", error); 
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

// --- 4. Rota de Excluir (DELETE) ---
// (CORRIGIDO: Adiciona tratamento de erro para FK de chamados)
export const excluirCategoria = async (req, res) => {
  try {
    const { id } = req.params;
    const affectedRows = await CategoriaModel.remove(id);

    if (affectedRows === 0) {
      return res.status(404).json({ message: 'Categoria não encontrada.' });
    }

    res.status(200).json({ message: 'Categoria excluída com sucesso.' });

  } catch (error) {
    // ERRO NOVO: Se a categoria estiver sendo usada por um chamado
    if (error.code === 'ER_ROW_IS_REFERENCED_2' && error.message.includes('fk_Chamados_Categorias')) {
       return res.status(409).json({ message: 'Erro: Esta categoria está em uso por chamados e não pode ser excluída.' });
    }
    
    // ERRO ANTIGO: Se a categoria for pai de outras
    if (error.code === 'ER_ROW_IS_REFERENCED_2' && error.message.includes('fk_Categorias_Parent')) {
       return res.status(409).json({ message: 'Erro: Esta categoria é "pai" de outras e não pode ser excluída.' });
    }
    
    console.error("Erro ao excluir categoria:", error); 
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};