-- CreateTable
CREATE TABLE "Cargo" (
    "idCargo" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "Cargo_pkey" PRIMARY KEY ("idCargo")
);

-- CreateTable
CREATE TABLE "Funcionario" (
    "id" SERIAL NOT NULL,
    "nomeFuncionario" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "cargoId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Funcionario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cargo_nome_key" ON "Cargo"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Funcionario_email_key" ON "Funcionario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Funcionario_usuario_key" ON "Funcionario"("usuario");

-- AddForeignKey
ALTER TABLE "Funcionario" ADD CONSTRAINT "Funcionario_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("idCargo") ON DELETE RESTRICT ON UPDATE CASCADE;
