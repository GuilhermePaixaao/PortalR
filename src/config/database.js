import 'dotenv/config'; // Garante que o .env seja lido
import mysql from 'mysql2/promise';

let pool;
try {
  pool = mysql.createPool({
    uri: process.env.DATABASE_URL, // Lê a string de conexão do .env
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
  console.log("Pool de conexões MySQL criado.");
} catch (error) {
  console.error("ERRO CRÍTICO AO CRIAR POOL DO MYSQL:", error);
  process.exit(1); // Encerra a aplicação se não puder criar o pool
}

// Exporta o pool para que os Models possam usá-lo
export default pool;