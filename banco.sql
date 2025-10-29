-- 1. Cria o banco de dados se ele não existir
CREATE DATABASE IF NOT EXISTS `portalrosalina` DEFAULT CHARACTER SET utf8mb4;

-- 2. Seleciona o banco para usar
USE `portalrosalina`;

-- 3. Cria a tabela 'Cargo'
CREATE TABLE IF NOT EXISTS `Cargo` (
  `idCargo` INT NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(255) NOT NULL UNIQUE,
  PRIMARY KEY (`idCargo`)
);

-- 4. Cria a tabela 'Categorias'
CREATE TABLE IF NOT EXISTS `Categorias` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(255) NOT NULL UNIQUE,
  PRIMARY KEY (`id`)
);

-- 5. Cria a tabela 'Funcionario'
CREATE TABLE IF NOT EXISTS `Funcionario` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nomeFuncionario` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `usuario` VARCHAR(100) NOT NULL UNIQUE,
  `senha` VARCHAR(255) NOT NULL,
  `cargoId` INT NOT NULL,
  `createdAt` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_Funcionario_Cargo`
    FOREIGN KEY (`cargoId`)
    REFERENCES `Cargo` (`idCargo`)
);

-- 6. Cria a tabela 'Chamados'
CREATE TABLE IF NOT EXISTS `Chamados` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `prioridade` VARCHAR(50) NOT NULL DEFAULT 'Média',
  `assunto` VARCHAR(255) NOT NULL,
  `descricao` TEXT NULL,
  `requisitante_id` INT NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Aberto',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `categoria_id` BIGINT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_Chamados_Funcionario`
    FOREIGN KEY (`requisitante_id`)
    REFERENCES `Funcionario` (`id`),
  CONSTRAINT `fk_Chamados_Categorias`
    FOREIGN KEY (`categoria_id`)
    REFERENCES `Categorias` (`id`)
);