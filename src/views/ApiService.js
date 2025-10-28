/**
 * Classe ApiService para facilitar chamadas HTTP (GET, POST, PUT, DELETE) a APIs RESTful.
 * Suporta autenticação via token Bearer e fornece métodos reutilizáveis para diferentes tipos de requisições.
 */
export default class ApiService {
    #baseUrl; // Atributo privado para a URL base
    #token;   // Atributo privado para armazenar o token de autenticação

    /**
     * Construtor da classe ApiService.
     * @param {string} baseUrl - A URL base da API (ex: "http://localhost:3000" ou "")
     */
    constructor(baseUrl = "") {
        this.#baseUrl = baseUrl; // Armazena a URL base
        this.#token = null;      // Inicializa o token como nulo
    }

    /**
     * Método interno para construir a URL completa.
     * @param {string} endpoint - O endpoint da rota (ex: "/login" ou "/usuarios")
     * @returns {string} A URL completa.
     */
    #buildUrl(endpoint) {
        // Junta a base URL com o endpoint
        // Ex: "" + "/login" = "/login"
        // Ex: "http://api.com" + "/login" = "http://api.com/login"
        return `${this.#baseUrl}${endpoint}`;
    }

    /**
     * Define o token de autenticação para ser usado em requisições futuras.
     * @param {string|null} token - O token Bearer.
     */
    setToken(token) {
        this.#token = token;
    }

    /**
     * Getter para o token privado.
     * @returns {string|null} Retorna o token atual.
     */
    get token() {
        return this.#token;
    }

    /**
     * Método para requisição GET com headers, incluindo token se presente.
     * @param {string} endpoint - O endpoint do recurso (ex: "/usuarios").
     * @returns {Promise<Object|Array>} Retorna JSON da resposta ou array vazio em caso de erro.
     */
    async get(endpoint) {
        const uri = this.#buildUrl(endpoint); // Constrói a URL completa
        try {
            const headers = { "Content-Type": "application/json" };
            if (this.#token) {
                headers["Authorization"] = `Bearer ${this.#token}`;
            }

            const response = await fetch(uri, {
                method: "GET",
                headers: headers
            });
            
            // Lança um erro se a resposta não for OK (ex: 404, 500)
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(errorData.message || `Erro HTTP: ${response.status}`);
            }

            const jsonObj = await response.json();
            console.log("GET:", uri, jsonObj);
            return jsonObj;

        } catch (error) {
            console.error(`Erro ao buscar dados de ${uri}:`, error.message);
            // Propaga o erro para que a página possa tratá-lo (ex: exibir na divResposta)
            throw error; 
        }
    }

    /**
     * Método para buscar um recurso específico pelo ID via GET.
     * @param {string} endpoint - URL base do recurso (ex: "/usuarios").
     * @param {string|number} id - Identificador do recurso.
     * @returns {Promise<Object|null>} Retorna JSON do recurso ou propaga o erro.
     */
    async getById(endpoint, id) {
        // Concatena endpoint com ID (ex: /usuarios/1)
        const fullEndpoint = `${endpoint}/${id}`;
        return this.get(fullEndpoint); // Reutiliza o método GET
    }

    /**
     * Método para enviar dados via POST para criar um novo recurso.
     * @param {string} endpoint - URL do endpoint para POST (ex: "/usuarios").
     * @param {Object} jsonObject - Objeto a ser enviado como corpo JSON.
     * @returns {Promise<Object|Array>} Retorna JSON da resposta ou propaga o erro.
     */
    async post(endpoint, jsonObject) {
        const uri = this.#buildUrl(endpoint);
        try {
            const headers = { "Content-Type": "application/json" };
            if (this.#token) {
                headers["Authorization"] = `Bearer ${this.#token}`;
            }

            const response = await fetch(uri, {
                method: "POST",
                headers: headers,
                body: JSON.stringify(jsonObject)
            });

            const jsonObj = await response.json(); // Lê a resposta (mesmo se for erro)

            // Lança um erro se a resposta não for OK (ex: 400, 409)
            if (!response.ok) {
                throw new Error(jsonObj.message || `Erro HTTP: ${response.status}`);
            }

            console.log("POST:", uri, jsonObj);
            return jsonObj;

        } catch (error) {
            console.error(`Erro ao enviar dados para ${uri}:`, error.message);
            // Propaga o erro
            throw error; 
        }
    }

    /**
     * Método para atualizar um recurso via PUT.
     * @param {string} endpoint - URL base do recurso (ex: "/usuarios").
     * @param {string|number} id - ID do recurso a ser atualizado.
     * @param {Object} jsonObject - Dados atualizados.
     * @returns {Promise<Object|null>} Retorna JSON da resposta ou propaga o erro.
     */
    async put(endpoint, id, jsonObject) {
        const uri = this.#buildUrl(`${endpoint}/${id}`); // Ex: /usuarios/1
        try {
            const headers = { "Content-Type": "application/json" };
            if (this.#token) {
                headers["Authorization"] = `Bearer ${this.#token}`;
            }

            const response = await fetch(uri, {
                method: "PUT",
                headers: headers,
                body: JSON.stringify(jsonObject)
            });

            const jsonObj = await response.json();
            if (!response.ok) {
                throw new Error(jsonObj.message || `Erro HTTP: ${response.status}`);
            }

            console.log("PUT:", uri, jsonObj);
            return jsonObj;

        } catch (error) {
            console.error(`Erro ao atualizar dados em ${uri}:`, error.message);
            throw error;
        }
    }

    /**
     * Método para deletar um recurso via DELETE.
     * @param {string} endpoint - URL base do recurso (ex: "/usuarios").
     * @param {string|number} id - ID do recurso a ser deletado.
     * @returns {Promise<Object|null>} Retorna JSON da resposta ou propaga o erro.
     */
    async delete(endpoint, id) {
        const uri = this.#buildUrl(`${endpoint}/${id}`); // Ex: /usuarios/1
        try {
            const headers = { "Content-Type": "application/json" };
            if (this.#token) {
                headers["Authorization"] = `Bearer ${this.#token}`;
            }

            const response = await fetch(uri, {
                method: "DELETE",
                headers: headers
            });

            const jsonObj = await response.json();
            if (!response.ok) {
                throw new Error(jsonObj.message || `Erro HTTP: ${response.status}`);
            }

            console.log("DELETE:", uri, jsonObj);
            return jsonObj;

        } catch (error) {
            console.error(`Erro ao deletar dados em ${uri}:`, error.message);
            throw error;
        }
    }
}