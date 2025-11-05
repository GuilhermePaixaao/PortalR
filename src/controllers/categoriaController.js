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
export const criarCategoria = async (req, res) => {   
  try {
    // 1. Pega o objeto 'categoria' de dentro do req.body
    const { categoria } = req.body;

    // 2. Validação: Verifica se o nome foi enviado
    if (!categoria || !categoria.nome) {
      return res.status(400).json({ message: 'O nome da categoria é obrigatório.' });
    }
    
    // 3. O 'id' NÃO é pego do req.body, só o 'nome'
    const novaCategoria = { 
      nome: categoria.nome 
    };
    
    // 4. Envia para o Model criar no banco
    const categoriaSalva = await CategoriaModel.create(novaCategoria);
    
    // 5. Retorna o objeto que o banco salvou (agora com o ID)
    res.status(201).json({ message: 'Categoria criada com sucesso.', categoria: categoriaSalva });

  } catch (error) {   
    console.error("Erro ao criar categoria:", error); 
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

// --- 3. Rota de Atualizar (PUT) ---
// --- NOVO CÓDIGO ADICIONADO ---
export const atualizarCategoria = async (req, res) => {
  try {
    // 1. Pega o ID da URL (parâmetros da rota)
    const { id } = req.params;
    
    // 2. Pega os dados do corpo
    const { categoria } = req.body;

    // 3. Validação
    if (!categoria || !categoria.nome) {
      return res.status(400).json({ message: 'O nome da categoria é obrigatório.' });
    }

    const dadosCategoria = { nome: categoria.nome };
    
    // 4. Envia para o Model atualizar
    const affectedRows = await CategoriaModel.update(id, dadosCategoria);

    // 5. Verifica se o ID existia e foi atualizado
    if (affectedRows === 0) {
      return res.status(404).json({ message: 'Categoria não encontrada.' });
    }

    // 6. Retorna sucesso
    res.status(200).json({ message: 'Categoria atualizada com sucesso.', categoria: { id: id, nome: categoria.nome } });

  } catch (error) {
    console.error("Erro ao atualizar categoria:", error); 
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

// --- 4. Rota de Excluir (DELETE) ---
// --- NOVO CÓDIGO ADICIONADO ---
export const excluirCategoria = async (req, res) => {
  try {
    // 1. Pega o ID da URL
    const { id } = req.params;

    // 2. Envia para o Model remover
    const affectedRows = await CategoriaModel.remove(id);

    // 3. Verifica se o ID existia e foi deletado
    if (affectedRows === 0) {
      return res.status(404).json({ message: 'Categoria não encontrada.' });
    }

    // 4. Retorna sucesso
    res.status(200).json({ message: 'Categoria excluída com sucesso.' });

  } catch (error) {
    console.error("Erro ao excluir categoria:", error); 
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};