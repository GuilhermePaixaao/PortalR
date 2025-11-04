import * as ChamadoModel from '../models/chamadoModel.js';

// ====================================================
// ======== CRIAR CHAMADO (CORRIGIDO P/ MULTER) ========
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

        // O resto do seu código original
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
            nomeRequisitanteManual: nome_requisitante_manual,
            emailRequisitanteManual: email_requisitante_manual,
            telefoneRequisitanteManual: telefone_requisitante_manual
            // NOTA: Se precisar de salvar os ficheiros (const arquivos),
            // a lógica para tratar 'arquivos' seria adicionada aqui.
        };

        const novoId = await ChamadoModel.create(dadosParaCriar);
        
        // Usamos findById (com JOINs) para retornar o chamado completo
        const novoChamado = await ChamadoModel.findById(novoId);

        res.status(201).json({ success: true, data: novoChamado });
    } catch (error) {
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
// ======== LISTAR CHAMADOS ========
// ====================================================
export const listarChamados = async (req, res) => {
    try {
        const filtros = req.query;
        const chamados = await ChamadoModel.findAll(filtros);

        // Formata a resposta (O seu frontend espera esta formatação)
        const chamadosFormatados = chamados.map(chamado => {
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
// ====================================================
// Esta função é chamada pelo modal 👁️
export const buscarChamadoPorId = async (req, res) => {
    try {
        const idNum = parseInt(req.params.id);
        if (isNaN(idNum)) {
            return res.status(400).json({ success: false, message: 'ID de chamado inválido.' });
        }

        // Usa o findById (que corrigimos no Model)
        const chamado = await ChamadoModel.findById(idNum);
        
        if (!chamado) {
            return res.status(404).json({ success: false, message: 'Chamado não encontrado.' });
        }

        // Formata a resposta da mesma forma que o listarChamados
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

        res.status(200).json({ ...chamado, Funcionario, Categorias });

    } catch (error) {
        console.error('Erro ao buscar chamado por ID:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
};


// ====================================================
// ======== DELETAR CHAMADO ========
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
// ======== ATUALIZAR STATUS ========
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
// ====================================================
// Esta função é chamada pelo <select> de prioridade do modal
export const atualizarPrioridade = async (req, res) => {
    try {
        const idNum = parseInt(req.params.id);
        const { prioridade } = req.body;

        if (isNaN(idNum) || !prioridade) {
            return res.status(400).json({ success: false, message: 'ID e Prioridade são obrigatórios.' });
        }
        
        // (Lembre-se: crie esta função no seu chamadoModel.js)
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
