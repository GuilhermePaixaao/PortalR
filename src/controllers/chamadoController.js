import * as ChamadoModel from '../models/chamadoModel.js';
import * as EmailService from '../services/emailService.js'; 
import PDFDocument from 'pdfkit';

// ====================================================
// ======== NOVAS FUNÇÕES PARA DADOS DINÂMICOS ========
// ====================================================

export const listarLojas = async (req, res) => {
    try {
        const lojas = await ChamadoModel.getTodasLojas();
        res.json(lojas);
    } catch (error) {
        console.error("Erro ao listar lojas:", error);
        res.status(500).json({ error: 'Erro ao buscar lojas' });
    }
};

export const listarDepartamentosDaLoja = async (req, res) => {
    try {
        const { lojaId } = req.params;
        if (!lojaId) return res.status(400).json({ error: 'ID da loja é obrigatório' });
        
        const departamentos = await ChamadoModel.getDepartamentosPorLoja(lojaId);
        res.json(departamentos);
    } catch (error) {
        console.error("Erro ao listar departamentos:", error);
        res.status(500).json({ error: 'Erro ao buscar departamentos' });
    }
};

// ====================================================
// ======== CRIAR CHAMADO (COM ENVIO DE E-MAIL) ========
// ====================================================
export const criarChamado = async (req, res) => {
    try {
        if (!req.body.chamado) {
            return res.status(400).json({
                success: false,
                message: "Dados do 'chamado' não encontrados. Verifique se está a enviar FormData."
            });
        }

        const chamado = JSON.parse(req.body.chamado);
        const arquivos = req.files; 

        // [ALTERAÇÃO] Extraindo 'loja' e 'departamento' do corpo da requisição
        const {
            assunto, descricao, prioridade, requisitante_id,
            categoria_unificada_id, 
            nome_requisitante_manual, email_requisitante_manual, telefone_requisitante_manual,
            loja, departamento 
        } = chamado;

        // [CORREÇÃO] Removida a verificação de !email_requisitante_manual para torná-lo opcional
        if (!assunto || !descricao || !requisitante_id ||
            !nome_requisitante_manual || !telefone_requisitante_manual) {
            return res.status(400).json({
                success: false,
                message: 'Assunto, Descrição, ID do Requisitante, Nome e Telefone são obrigatórios.'
            });
        }

        // [ALTERAÇÃO] Convertendo para ID (Inteiro) antes de salvar
        const dadosParaCriar = {
            assunto: assunto,
            descricao: descricao,
            prioridade: prioridade || 'Média',
            status: 'Aberto',
            requisitanteIdNum: parseInt(requisitante_id),
            categoriaUnificadaIdNum: categoria_unificada_id ? parseInt(categoria_unificada_id) : null,
            nomeRequisitanteManual: nome_requisitante_manual,
            emailRequisitanteManual: email_requisitante_manual, // Passa o valor (pode ser vazio)
            telefoneRequisitanteManual: telefone_requisitante_manual,
            
            // Salva o ID. Se vier vazio, salva null.
            loja_id: loja ? parseInt(loja) : null,                 
            departamento_id: departamento ? parseInt(departamento) : null 
        };

        const novoId = await ChamadoModel.create(dadosParaCriar);
        
        // (Lógica para salvar anexos no banco de dados iria aqui)
        if (arquivos && arquivos.length > 0) {
            console.log(`Salvando ${arquivos.length} anexos para o chamado ${novoId}`);
        }
        
        // Busca o chamado completo recém-criado
        const novoChamado = await ChamadoModel.findById(novoId);
        
        // =================================================
        // NOTIFICAÇÃO EM TEMPO REAL VIA SOCKET
        // =================================================
        if (req.io) {
            req.io.emit('novoChamadoInterno', {
                id: novoChamado.id,
                assunto: novoChamado.assunto,
                requisitante: novoChamado.nomeRequisitante || "Alguém",
                prioridade: novoChamado.prioridade
            });
        }

        // =================================================
        // [NOVO] ENVIO DE E-MAIL DE CRIAÇÃO
        // =================================================
        // Só tenta enviar e-mail se o campo emailRequisitante tiver valor
        if (novoChamado.emailRequisitante) {
            EmailService.enviarNotificacaoCriacao(novoChamado.emailRequisitante, novoChamado)
                .catch(err => console.error("Falha silenciosa ao enviar e-mail de criação:", err));
        }
        
        // Formata a resposta
        const Funcionario = {
            nomeFuncionario: novoChamado.nomeRequisitante,
            email: novoChamado.emailRequisitante,
            telefone: novoChamado.telefoneRequisitante
        };
        
        const Categorias = novoChamado.categoria_unificada_id ? { 
            id: novoChamado.categoria_unificada_id, 
            nome: novoChamado.nomeCategoria,
            nomePai: novoChamado.nomeCategoriaPai
        } : null;

        // Limpa campos duplicados
        delete novoChamado.nomeRequisitante;
        delete novoChamado.emailRequisitante;
        delete novoChamado.telefoneRequisitante;
        delete novoChamado.nomeCategoria;
        delete novoChamado.nomeCategoriaPai;

        // O objeto 'novoChamado' já contém 'loja' e 'departamento' (nomes) retornados pelo Model via JOIN
        const chamadoFormatado = { ...novoChamado, Funcionario, Categorias };

        res.status(201).json({ success: true, data: chamadoFormatado });

    } catch (error) {
        if (error instanceof SyntaxError) {
            return res.status(400).json({ success: false, message: 'Erro ao processar dados: JSON do chamado mal formatado.' });
        }
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            // Verifica qual chave estrangeira falhou
            let msg = 'Erro de integridade: Registro referenciado não encontrado.';
            if (error.message.includes('fk_Chamados_Loja')) msg = 'Erro: A Loja selecionada é inválida.';
            else if (error.message.includes('fk_Chamados_Departamento')) msg = 'Erro: O Departamento selecionado é inválido.';
            else if (error.message.includes('fk_Chamados_Funcionario')) msg = 'Erro: Requisitante não encontrado.';
            else if (error.message.includes('categoria_unificada_id')) msg = 'Erro: Categoria inválida.';
            
            return res.status(400).json({ success: false, message: msg });
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

        const chamadosFormatados = chamados.map(chamado => {
            const Funcionario = {
                nomeFuncionario: chamado.nomeRequisitante,
                email: chamado.emailRequisitante,
                telefone: chamado.telefoneRequisitante
            };
            
            const Atendente = chamado.atendente_id ? {
                nomeFuncionario: chamado.nomeAtendente, 
                email: chamado.emailAtendente     
            } : null; 

            const Categorias = chamado.categoria_unificada_id ? { 
                id: chamado.categoria_unificada_id, 
                nome: chamado.nomeCategoria,
                nomePai: chamado.nomeCategoriaPai 
            } : null;
            
            delete chamado.nomeRequisitante;
            delete chamado.emailRequisitante;
            delete chamado.telefoneRequisitante;
            delete chamado.nomeCategoria;
            delete chamado.nomeCategoriaPai; 
            delete chamado.nomeAtendente;
            delete chamado.emailAtendente;

            // Campos 'loja' e 'departamento' são passados automaticamente
            return { ...chamado, Funcionario, Categorias, Atendente };
        });

        res.status(200).json(chamadosFormatados);
    } catch (error) {
        console.error('Erro ao buscar chamados:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};

// ====================================================
// ======== BUSCAR CHAMADO POR ID ========
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

        const Funcionario = { 
            nomeFuncionario: chamado.nomeRequisitante,
            email: chamado.emailRequisitante,
            telefone: chamado.telefoneRequisitante
        };
        
        const Atendente = chamado.atendente_id ? {
            nomeFuncionario: chamado.nomeAtendente,
            email: chamado.emailAtendente
        } : null;

        const Categorias = chamado.categoria_unificada_id ? { 
            id: chamado.categoria_unificada_id, 
            nome: chamado.nomeCategoria,
            nomePai: chamado.nomeCategoriaPai
        } : null;

        delete chamado.nomeRequisitante;
        delete chamado.emailRequisitante;
        delete chamado.telefoneRequisitante;
        delete chamado.nomeCategoria;
        delete chamado.nomeCategoriaPai;
        delete chamado.nomeAtendente;
        delete chamado.emailAtendente;

        res.status(200).json({ ...chamado, Funcionario, Categorias, Atendente });

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
// ======== ATUALIZAR STATUS (COM ENVIO DE E-MAIL) ========
// ====================================================
export const atualizarStatus = async (req, res) => {
    console.log("[BACKEND] Corpo da requisição recebido:", req.body);
    try {
        const idNum = parseInt(req.params.id);
        const { status, atendenteId } = req.body; 
        if (isNaN(idNum) || !status) {
            return res.status(400).json({ success: false, message: 'ID e Status são obrigatórios.' });
        }
        
        console.log(`[BACKEND] Tentando salvar: ID=${idNum}, Status=${status}, AtendenteID=${atendenteId}`);
        const result = await ChamadoModel.updateStatus(idNum, status, atendenteId ? parseInt(atendenteId) : null);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Erro: Chamado não encontrado.' });
        }

        // =================================================
        // [NOVO] ENVIO DE E-MAIL DE ATUALIZAÇÃO
        // =================================================
        const chamadoAtualizado = await ChamadoModel.findById(idNum);
        
        if (chamadoAtualizado && chamadoAtualizado.emailRequisitante) {
            EmailService.enviarNotificacaoStatus(
                chamadoAtualizado.emailRequisitante, 
                chamadoAtualizado, 
                status
            ).catch(err => console.error("Falha silenciosa ao enviar e-mail de status:", err));
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

// ====================================================
// ======== ATUALIZAR ATENDENTE ========
// ====================================================
export const atualizarAtendente = async (req, res) => {
    try {
        const idNum = parseInt(req.params.id);
        const { atendenteId } = req.body; 
        const novoAtendenteId = (atendenteId && parseInt(atendenteId) > 0) ? parseInt(atendenteId) : null;
        console.log(`[BACKEND] Trocando atendente: ID=${idNum}, Novo AtendenteID=${novoAtendenteId}`);
        const result = await ChamadoModel.updateAtendente(idNum, novoAtendenteId);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Erro: Chamado não encontrado.' });
        }
        res.status(200).json({ success: true, message: 'Atendente atualizado com sucesso.' });
    } catch (error) {
        console.error('Erro ao atualizar atendente:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
};

// ====================================================
// ======== (NOVO) ATUALIZAR CATEGORIA ========
// ====================================================
export const atualizarCategoria = async (req, res) => {
    try {
        const idNum = parseInt(req.params.id);
        const { categoriaId } = req.body;

        if (isNaN(idNum) || !categoriaId) {
            return res.status(400).json({ success: false, message: 'ID e Nova Categoria são obrigatórios.' });
        }

        // Chama a função no Model (que deve ter sido adicionada no chamadoModel.js)
        const result = await ChamadoModel.updateCategoria(idNum, parseInt(categoriaId));

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Erro: Chamado não encontrado.' });
        }

        res.status(200).json({ success: true, message: 'Categoria atualizada com sucesso.' });
    } catch (error) {
        console.error('Erro ao atualizar categoria:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
};

// ====================================================
// ======== CONTAR CHAMADOS POR STATUS ========
// ====================================================
export const contarChamadosPorStatus = async (req, res) => {
    try {
        const counts = await ChamadoModel.countByStatus();
        const resultadoFormatado = counts.reduce((acc, item) => {
            acc[item.status] = item.count;
            return acc;
        }, {});
        const finalData = {
            "Aberto": resultadoFormatado["Aberto"] || 0,
            "Em Andamento": resultadoFormatado["Em Andamento"] || 0,
            "Concluído": resultadoFormatado["Concluído"] || 0,
            "Pausado": resultadoFormatado["Pausado"] || 0,
        };
        res.status(200).json(finalData);
    } catch (error) {
        console.error('Erro ao contar chamados por status:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao buscar contagens.' });
    }
};
// ====================================================
// ======== GERAR RELATÓRIO PDF (ATUALIZADO) ========
// ====================================================
export const gerarRelatorioChamados = async (req, res) => {
    try {
        // Busca os chamados com os filtros atuais
        const chamados = await ChamadoModel.findAll(req.query);

        const doc = new PDFDocument();
        const filename = `Relatorio_Chamados_${Date.now()}.pdf`;

        // Configura o download
        res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
        res.setHeader('Content-type', 'application/pdf');

        doc.pipe(res);

        // --- CABEÇALHO ---
        doc.fontSize(20).text('Relatório de Chamados', { align: 'center' });
        doc.moveDown();
        
        doc.fontSize(10).text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'right' });
        
        // Exibe no topo se houve filtro de Loja ou Status
        if (req.query.loja_id) doc.text(`Filtro por Loja (ID): ${req.query.loja_id}`, { align: 'right' });
        if (req.query.status) doc.text(`Filtro Status: ${req.query.status}`, { align: 'right' });
        
        doc.moveDown();
        doc.moveTo(doc.x, doc.y).lineTo(500, doc.y).stroke(); // Linha inicial
        doc.moveDown();

        // --- LISTA DE CHAMADOS ---
        chamados.forEach(ch => {
            if (!ch) return; // Segurança

            // Título: ID e Assunto
            doc.fontSize(12).font('Helvetica-Bold').text(`Ticket #${ch.id} - ${ch.assunto || 'Sem assunto'}`);
            
            // Linha 1: Status, Prioridade e Loja
            const nomeLoja = ch.loja || 'N/A'; // Pega o nome da loja vindo do JOIN no Model
            const departamento = ch.departamento ? `(${ch.departamento})` : '';
            
            doc.fontSize(10).font('Helvetica').text(
                `Status: ${ch.status} | Prioridade: ${ch.prioridade} | Loja: ${nomeLoja} ${departamento}`
            );
            
            // Linha 2: Solicitante e Data
            const solicitante = ch.nomeRequisitante || ch.nomeRequisitanteManual || 'N/A';
            const dataCriacao = ch.created_at ? new Date(ch.created_at).toLocaleString('pt-BR') : 'N/A';
            
            doc.text(`Solicitante: ${solicitante} | Aberto em: ${dataCriacao}`);
            
            // Linha 3: Categoria (Se houver)
            if (ch.nomeCategoria) {
                const cat = ch.nomeCategoriaPai ? `${ch.nomeCategoriaPai} > ${ch.nomeCategoria}` : ch.nomeCategoria;
                doc.text(`Categoria: ${cat}`);
            }
            
            // Espaçamento e Linha Divisória
            doc.moveDown(0.5);
            doc.moveTo(doc.x, doc.y).lineTo(500, doc.y).stroke(); 
            doc.moveDown(0.5);
        });

        doc.end();

    } catch (error) {
        console.error("Erro ao gerar relatório:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: "Erro ao gerar PDF" });
        }
    }
};