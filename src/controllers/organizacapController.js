import * as OrgModel from '../models/organizacaoModel.js';

// --- LOJAS ---
export const listarLojas = async (req, res) => {
    try { res.json(await OrgModel.getLojas()); } 
    catch (e) { res.status(500).json({ error: e.message }); }
};

export const criarLoja = async (req, res) => {
    try {
        const { nome } = req.body;
        if(!nome) return res.status(400).json({message: "Nome obrigatório"});
        const nova = await OrgModel.createLoja(nome);
        res.json(nova);
    } catch (e) { 
        if(e.code === 'ER_DUP_ENTRY') return res.status(409).json({message: "Loja já existe."});
        res.status(500).json({ error: e.message }); 
    }
};

export const atualizarLoja = async (req, res) => {
    try {
        const { id } = req.params;
        const { nome } = req.body;
        await OrgModel.updateLoja(id, nome);
        res.json({ message: "Atualizado" });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

export const deletarLoja = async (req, res) => {
    try {
        await OrgModel.deleteLoja(req.params.id);
        res.json({ message: "Deletado" });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// --- DEPARTAMENTOS ---
export const listarDepartamentos = async (req, res) => {
    try { res.json(await OrgModel.getDepartamentos()); } 
    catch (e) { res.status(500).json({ error: e.message }); }
};

export const criarDepartamento = async (req, res) => {
    try {
        const { nome } = req.body;
        if(!nome) return res.status(400).json({message: "Nome obrigatório"});
        const novo = await OrgModel.createDepartamento(nome);
        res.json(novo);
    } catch (e) { 
        if(e.code === 'ER_DUP_ENTRY') return res.status(409).json({message: "Departamento já existe."});
        res.status(500).json({ error: e.message }); 
    }
};

export const atualizarDepartamento = async (req, res) => {
    try {
        const { id } = req.params;
        const { nome } = req.body;
        await OrgModel.updateDepartamento(id, nome);
        res.json({ message: "Atualizado" });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

export const deletarDepartamento = async (req, res) => {
    try {
        await OrgModel.deleteDepartamento(req.params.id);
        res.json({ message: "Deletado" });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// --- VÍNCULOS ---
export const listarVinculos = async (req, res) => {
    try {
        const { id } = req.params; // ID da Loja
        const lista = await OrgModel.getVinculosPorLoja(id);
        res.json(lista);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

export const salvarVinculos = async (req, res) => {
    try {
        const { id } = req.params; // ID da Loja
        const { departamentos } = req.body; // Array de IDs [1, 2, 5]
        await OrgModel.salvarVinculos(id, departamentos);
        res.json({ message: "Vínculos salvos com sucesso!" });
    } catch (e) { res.status(500).json({ error: e.message }); }
};