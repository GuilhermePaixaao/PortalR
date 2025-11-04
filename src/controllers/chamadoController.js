import * as ChamadoModel from '../models/chamadoModel.js';

// ====================================================
// ======== CRIAR CHAMADO (O seu código, 100% mantido) ========
// ====================================================
export const criarChamado = async (req, res) => {
    try {
        // --- INÍCIO DA CORREÇÃO ---
        // 1. Logs para depuração (pode apagar depois)
        console.log('Dados de texto (req.body):', req.body);
        console.log('Ficheiros recebidos (req.files):', req.files);

        // 2. Verifique se 'req.body.chamado' existe
        if (!req.body.chamado) {
            return res.status(400).json({
                success: false,
                message: "Dados do 'chamado' não encontrados. Verifique se está a enviar FormData."
            });
        }

        // 3. A MUDANÇA PRINCIPAL:
        // O 'req.body.chamado' vem como STRING do FormData.
        // Precisamos de o "parsear" para o transformar num objeto.
        const chamado = JSON.parse(req.body.chamado);

        // 4. Os seus ficheiros estão agora em req.files
        const arquivos = req.files;
        // --- FIM DA CORREÇÃO ---

        // O resto do seu código original funciona perfeitamente agora,
        // porque a variável 'chamado' é um objeto válido.
        const {
            assunto, descricao, prioridade, requisitante_id, categoria_id,
            nome_requisitante_manual, email_requisitante_manual, telefone_requisitante_manual
        } = chamado;

        // Validação estendida
        if (!assunto || !descricao || !requisitante_id ||
            !nome_requisitante_manual || !email_requisitante_manual || !telefone_requisitante_manual) {

            return res.status(400).json({
                success: false,
                message: 'Assunto, Descrição, ID do Requisitante e todos os dados de Contato são obrigatórios.'
            });
        }

        const dadosParaCriar = {
            assunto: assunto,
            descricao: descricao,
            prioridade: prioridade || 'Média',
            status: 'Aberto',
            requisitanteIdNum: parseInt(requisitante_id),
            categoriaIdNum: categoria_id ? parseInt(categoria_id) : null,

            // Campos manuais para o Model
            nomeRequisitanteManual: nome_requisitante_manual,
            emailRequisitanteManual: email_requisitante_manual,
            telefoneRequisitanteManual: telefone_requisitante_manual
            // NOTA: Se precisar de salvar os ficheiros (const arquivos),
            // a lógica seria adicionada aqui.
        };

        const novoId = await ChamadoModel.create(dadosParaCriar);
        const novoChamado = await ChamadoModel.findById(novoId);

        res.status(201).json({ success: true, data: novoChamado });
    } catch (error) {
        // Adicione esta verificação para o erro de JSON.parse
        if (error instanceof SyntaxError) {
            return res.status(400).json({ success: false, message: 'Erro ao processar dados: JSON do chamado mal formatado.' });
        }
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            const field = error.message.includes('fk_Chamados_Funcionario') ? 'Requisitante' : 'Categoria';
            return res.status(400).json({ success: false, message: `Erro: ${field} não encontrado.` });
        }
        console.error('Erro ao criar chamado:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
};

// ====================================================
// ======== LISTAR CHAMADOS (O seu código original) ========
// ====================================================
export const listarChamados = async (req, res) => {
    try {
        // Captura os query params (filtros)
        const filtros = req.query;

        // Passa os filtros para o Model
        const chamados = await ChamadoModel.findAll(filtros);

        // Formata a resposta
        const chamadosFormatados = chamados.map(chamado => {
            // O Model já retornou os campos certos
            const Funcionario = {
                nomeFuncionario: chamado.nomeRequisitante,
                email: chamado.emailRequisitante,
                telefone: chamado.telefoneRequisitante
            };
            const Categorias = chamado.categoria_id ? { nome: chamado.nomeCategoria } : null;

            // Remove as propriedades redundantes do objeto raiz para a resposta JSON
            delete chamado.nomeRequisitante;
            delete chamado.emailRequisitante;
            delete chamado.telefoneRequisitante;
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
// ======== (NOVO) BUSCAR CHAMADO POR ID ========
// Esta função é necessária para o modal "Visualizar" (👁️)
// ====================================================
export const buscarChamadoPorId = async (req, res) => {
    try {
        const idNum = parseInt(req.params.id);
        if (isNaN(idNum)) {
            return res.status(400).json({ success: false, message: 'ID de chamado inválido.' });
        }

        // Usa a função findById que o seu 'criarChamado' já usa
        const chamado = await ChamadoModel.findById(idNum); 

        if (!chamado) {
            return res.status(404).json({ success: false, message: 'Chamado não encontrado.' });
        }

        // Formata a resposta da *mesma forma* que 'listarChamados'
        // para que o frontend (chamado.Funcionario.nomeFuncionario) funcione.
        const Funcionario = { 
            nomeFuncionario: chamado.nomeRequisitante,
            email: chamado.emailRequisitante,
            telefone: chamado.telefoneRequisitante
        };
        const Categorias = chamado.categoria_id ? { nome: chamado.nomeCategoria } : null;
        
        delete chamado.nomeRequisitante;
        delete chamado.emailRequisitante;
        delete chamado.telefoneRequisitante;
        delete chamado.nomeCategoria;
        
        const chamadoFormatado = { ...chamado, Funcionario, Categorias };

        res.status(200).json(chamadoFormatado); // Envia o chamado único formatado

    } catch (error) {
        console.error('Erro ao buscar chamado por ID:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
};

// ====================================================
// ======== DELETAR CHAMADO (O seu código original) ========
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
// ======== ATUALIZAR STATUS (O seu código original) ========
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

// ====================================================
// ======== (NOVO) ATUALIZAR PRIORIDADE ========
// Esta função é necessária para o modal "Visualizar"
// ====================================================
export const atualizarPrioridade = async (req, res) => {
    try {
        const idNum = parseInt(req.params.id);
        const { prioridade } = req.body; // Espera um body { "prioridade": "Alta" }

        if (isNaN(idNum) || !prioridade) {
            return res.status(400).json({ success: false, message: 'ID e Prioridade são obrigatórios.' });
        }

        // IMPORTANTE: Tem de criar esta função no seu 'chamadoModel.js'
        // (Será igual à 'updateStatus', mas para o campo 'prioridade')
        const result = await ChamadoModel.updatePrioridade(idNum, prioridade);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Erro: Chamado não encontrado.' });
        }

        res.status(200).json({ success: true, message: 'Prioridade atualizada com sucesso.' });
    } catch (error) {
        console.error('Erro ao atualizar prioridade:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
};