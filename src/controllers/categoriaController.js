import * as CategoriaModel from '../models/categoriaModel.js';

// --- 1. Rota de Listar (GET) ---
// (O seu código de listar já estava correto)
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
// (Corrigido para ler o objeto aninhado "categoria")
export const criarCategoria = async (req, res) => {   
  try {
    // 1. Pega o objeto 'categoria' de dentro do req.body
    const { categoria } = req.body;

    // 2. Validação: Verifica se o nome foi enviado
    if (!categoria || !categoria.nome) {
      return res.status(400).json({ message: 'O nome da categoria é obrigatório.' });
    }
    
    // 3. O 'id' NÃO é pego do req.body, só o 'nome'
    // O nome 'novaCategoria' aqui é só para passar ao Model
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