import * as ChamadoModel from '../models/chamadoModel.js';
// (Importe seus outros models, como de Anexos, se necessário)

// ====================================================
// ======== CRIAR CHAMADO (ATUALIZADO) ========
// ====================================================
export const criarChamado = async (req, res) => {
    try {
        if (!req.body.chamado) {
            return res.status(400).json({
                success: false,
                message: "Dados do 'chamado' não encontrados. Verifique se está a enviar FormData."
            });
        }

        // O 'req.body.chamado' vem como STRING do FormData.
        const chamado = JSON.parse(req.body.chamado);
        const arquivos = req.files; // Arquivos do Multer

        const {
            assunto, descricao, prioridade, requisitante_id, categoria_id,
            subcategoria_id, // <-- CAMPO NOVO
            nome_requisitante_manual, email_requisitante_manual, telefone_requisitante_manual
        } = chamado;

        if (!assunto || !descricao || !requisitante_id ||
            !nome_requisitante_manual || !email_requisitante_manual || !telefone_requisitante_manual) {
            return res.status(400).json({
                success: false,
                message: 'Assunto, Descrição, ID do Requisitante e todos os dados de Contato são obrigatórios.'
            });
        }

        // Os nomes das chaves (ex: categoriaIdNum)
        // devem ser os mesmos que o Model espera.
        const dadosParaCriar = {
            assunto: assunto,
            descricao: descricao,
            prioridade: prioridade || 'Média',
            status: 'Aberto',
            requisitanteIdNum: parseInt(requisitante_id),
            categoriaIdNum: categoria_id ? parseInt(categoria_id) : null,
            subcategoriaIdNum: subcategoria_id ? parseInt(subcategoria_id) : null, // <-- VALOR NOVO
            nomeRequisitanteManual: nome_requisitante_manual,
            emailRequisitanteManual: email_requisitante_manual,
            telefoneRequisitanteManual: telefone_requisitante_manual
        };

        const novoId = await ChamadoModel.create(dadosParaCriar);
        
        // Lógica para salvar anexos (se houver)
        if (arquivos && arquivos.length > 0) {
            // ... (Sua lógica para salvar 'arquivos' associados ao 'novoId' iria aqui)
            console.log(`Salvando ${arquivos.length} anexos para o chamado ${novoId}`);
        }
        
        // Retorna o chamado completo que acabou de ser criado
        const novoChamado = await ChamadoModel.findById(novoId);
        
        // Formata o novo chamado antes de enviar
        const Funcionario = {
            nomeFuncionario: novoChamado.nomeRequisitante,
            email: novoChamado.emailRequisitante,
            telefone: novoChamado.telefoneRequisitante
        };
        const Categorias = novoChamado.categoria_id ? { id: novoChamado.categoria_id, nome: novoChamado.nomeCategoria } : null;
        const Subcategoria = novoChamado.subcategoria_id ? { id: novoChamado.subcategoria_id, nome: novoChamado.nomeSubcategoria } : null;

        delete novoChamado.nomeRequisitante;
        delete novoChamado.emailRequisitante;
        delete novoChamado.telefoneRequisitante;
        delete novoChamado.nomeCategoria;
        delete novoChamado.nomeSubcategoria;

        const chamadoFormatado = { ...novoChamado, Funcionario, Categorias, Subcategoria };

        res.status(201).json({ success: true, data: chamadoFormatado }); // Envia o chamado formatado

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
// ======== LISTAR CHAMADOS (ATUALIZADO) ========
// ====================================================
export const listarChamados = async (req, res) => {
    try {
        const filtros = req.query;
        const chamados = await ChamadoModel.findAll(filtros);

        // Formata a resposta para o frontend (com Subcategoria)
        const chamadosFormatados = chamados.map(chamado => {
            const Funcionario = {
                nomeFuncionario: chamado.nomeRequisitante,
                email: chamado.emailRequisitante,
                telefone: chamado.telefoneRequisitante
            };
            const Categorias = chamado.categoria_id ? { id: chamado.categoria_id, nome: chamado.nomeCategoria } : null;
            const Subcategoria = chamado.subcategoria_id ? { id: chamado.subcategoria_id, nome: chamado.nomeSubcategoria } : null;
            
            delete chamado.nomeRequisitante;
            delete chamado.emailRequisitante;
            delete chamado.telefoneRequisitante;
            delete chamado.nomeCategoria;
            delete chamado.nomeSubcategoria; 

            return { ...chamado, Funcionario, Categorias, Subcategoria };
        });

        res.status(200).json(chamadosFormatados);
    } catch (error) {
        console.error('Erro ao buscar chamados:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};

// ====================================================
// ======== BUSCAR CHAMADO POR ID (ATUALIZADO) ========
// ====================================================
export const buscarChamadoPorId = async (req, res) => {
    try {
        const idNum = parseInt(req.params.id);
        if (isNaN(idNum)) {
            return res.status(400).json({ success: false, message: 'ID de chamado inválido.' });
        }

        const chamado = await ChamadoModel.findById(idNum);
        
        if (!chamado) {
            return res.status(404).json({ success: false, message: 'Chamado não encontrado.' });
        }

        // Formata a resposta (com Subcategoria)
        const Funcionario = {
            nomeFuncionario: chamado.nomeRequisitante,
            email: chamado.emailRequisitante,
            telefone: chamado.telefoneRequisitante
        };
        const Categorias = chamado.categoria_id ? { id: chamado.categoria_id, nome: chamado.nomeCategoria } : null;
        const Subcategoria = chamado.subcategoria_id ? { id: chamado.subcategoria_id, nome: chamado.nomeSubcategoria } : null;

        delete chamado.nomeRequisitante;
        delete chamado.emailRequisitante;
        delete chamado.telefoneRequisitante;
        delete chamado.nomeCategoria;
        delete chamado.nomeSubcategoria;

        res.status(200).json({ ...chamado, Funcionario, Categorias, Subcategoria });

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
// ======== ATUALIZAR PRIORIDADE ========
// ====================================================
export const atualizarPrioridade = async (req, res) => {
    try {
        const idNum = parseInt(req.params.id);
        const { prioridade } = req.body;

        if (isNaN(idNum) || !prioridade) {
            return res.status(400).json({ success: false, message: 'ID e Prioridade são obrigatórios.' });
        }
        
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