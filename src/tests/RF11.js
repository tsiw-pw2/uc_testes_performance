/**
 * RF11: Registar quantidades de residuos recolhidos — validar e guardar quantidade na recolha.
 *
 * Resultado esperado: o sistema valida o número e guarda a quantidade na lista de recolhas.
 *
 * Pré-requisitos:
 * - API Mariva a correr (http://127.0.0.1:3000)
 * - Frontend a correr (http://localhost:5173)
 * - Base de dados com seed: pnpm run db:seed (password Demo2026!)
 *
 * Executar: node "tests/RF11.js"
 */

const fs = require("fs");
const path = require("path");
const { By, until } = require("selenium-webdriver");
const { criarDriver } = require("../criar-driver");
const SEED = require("../test-seed");

const BASE_URL = process.env.APP_URL || "http://localhost:5173";
const EMAIL = process.env.TEST_EMAIL || SEED.EMAIL;
const PASSWORD = process.env.TEST_PASSWORD || "Demo2026!";
/** Campanha aberta do seed (Limpeza da Apúlia e Ofir) */
const CAMPAIGN_ID =
  process.env.CAMPAIGN_ID || SEED.CAMPAIGNS.inProgress.id;
const QUANTIDADE_KG = process.env.WASTE_QUANTITY || "50";
const PRAIA_NOME = process.env.WASTE_BEACH_NAME || SEED.BEACHES.azurara;
const RESIDUO_NOME = process.env.WASTE_ITEM_NAME || SEED.WASTE.garrafaPet;

const EVIDENCIAS_DIR = path.join(__dirname, "..", "..", "evidencias");
const TESTE_ID = "RF11";
const { createEvidencias } = require("../tc-evidencias");
const { executarPasso, screenshotErro } = createEvidencias(TESTE_ID);
const DELAY_ENTRE_PASSOS_MS = Number(process.env.TEST_DELAY_MS) || 1200;
const DELAY_DIGITACAO_MS = Number(process.env.TEST_TYPING_MS) || 50;

async function pausa(driver, ms = DELAY_ENTRE_PASSOS_MS) {
  await driver.sleep(ms);
}

async function escreverLentamente(elemento, texto, msPorCaracter = DELAY_DIGITACAO_MS) {
  await elemento.clear();
  for (const char of texto) {
    await elemento.sendKeys(char);
    await new Promise((resolve) => setTimeout(resolve, msPorCaracter));
  }
}

async function guardarScreenshot(driver, nomeFicheiro) {
  if (!fs.existsSync(EVIDENCIAS_DIR)) {
    fs.mkdirSync(EVIDENCIAS_DIR, { recursive: true });
  }
  const caminho = path.join(EVIDENCIAS_DIR, nomeFicheiro);
  const pngBase64 = await driver.takeScreenshot();
  fs.writeFileSync(caminho, pngBase64, "base64");
  console.log(`Screenshot guardado: ${caminho}`);
  return caminho;
}

async function fazerLogin(driver) {
  await driver.get(`${BASE_URL}/entrar`);
  await driver.manage().window().maximize();

  const email = await driver.wait(
    until.elementLocated(By.id("login-email")),
    15000,
  );
  const password = await driver.findElement(By.id("login-password"));
  const entrar = await driver.findElement(
    By.xpath("//button[@type='submit' and contains(., 'Entrar')]"),
  );

  await pausa(driver);
  await escreverLentamente(email, EMAIL);
  await pausa(driver, 600);
  await escreverLentamente(password, PASSWORD);
  await pausa(driver, 600);
  await entrar.click();

  await driver.wait(
    until.urlMatches(/\/(dashboard|campanhas)/),
    20000,
  );
  await pausa(driver);
  console.log("Sessão iniciada com sucesso.");
}

async function abrirRecolhasCampanha(driver) {
  const url = `${BASE_URL}/campanhas/${CAMPAIGN_ID}/recolhas`;
  await driver.get(url);

  await driver.wait(
    until.elementLocated(By.id("campaign-panel-recolhas")),
    20000,
  );
  await pausa(driver);
  console.log(`Painel de recolhas aberto: ${url}`);
}

function modalRecolha() {
  return By.xpath(
    "//div[@role='dialog'][.//*[@id='create-waste-collection-title']]",
  );
}

async function escolherOpcaoSelect(driver, indiceNoModal, textoOpcao) {
  const modal = await driver.findElement(modalRecolha());
  const comboboxes = await modal.findElements(By.css('[role="combobox"]'));
  const trigger = comboboxes[indiceNoModal];
  await trigger.click();
  await pausa(driver, 400);

  const opcao = await driver.wait(
    until.elementLocated(
      By.xpath(
        `//div[@role='option'][.//span[normalize-space()=${JSON.stringify(textoOpcao)}]]`,
      ),
    ),
    10000,
  );
  await opcao.click();
  await pausa(driver, 450);
}

async function abrirFormularioRecolha(driver) {
  const botao = await driver.wait(
    until.elementLocated(
      By.xpath(
        "//div[@id='campaign-panel-recolhas']//button[contains(normalize-space(),'Registar recolha')]",
      ),
    ),
    10000,
  );
  await pausa(driver, 600);
  await botao.click();

  await driver.wait(
    until.elementLocated(By.id("create-waste-collection-title")),
    10000,
  );
  await pausa(driver);
  console.log("Formulário «Registar recolha» aberto.");
}

async function obterBotaoGuardar(driver) {
  const modal = await driver.findElement(modalRecolha());
  return modal.findElement(
    By.xpath(".//button[@type='submit' and normalize-space()='Guardar']"),
  );
}

async function verificarValidacaoQuantidade(driver) {
  const guardar = await obterBotaoGuardar(driver);
  const desativadoInicial = !(await guardar.isEnabled());
  if (!desativadoInicial) {
    throw new Error(
      "Validação: o botão Guardar devia estar desativado sem quantidade válida.",
    );
  }
  console.log("Validação: Guardar desativado até indicar quantidade ≥ 1.");

  const qty = await driver.findElement(By.id("create-waste-collection-qty"));
  await qty.clear();
  await qty.sendKeys("0");
  await pausa(driver, 400);

  const desativadoComZero = !(await guardar.isEnabled());
  if (!desativadoComZero) {
    throw new Error(
      "Validação: quantidade 0 não deve permitir guardar (mínimo 1).",
    );
  }
  console.log("Validação: quantidade 0 rejeitada (botão Guardar desativado).");

  await qty.clear();
}

async function preencherERegistarRecolha(driver) {
  await escolherOpcaoSelect(driver, 0, PRAIA_NOME);
  await escolherOpcaoSelect(driver, 1, RESIDUO_NOME);

  const qty = await driver.findElement(By.id("create-waste-collection-qty"));
  await verificarValidacaoQuantidade(driver);

  await escreverLentamente(qty, QUANTIDADE_KG);
  await pausa(driver, 600);

  const guardar = await obterBotaoGuardar(driver);
  const ativo = await guardar.isEnabled();
  if (!ativo) {
    throw new Error(
      `Validação: quantidade ${QUANTIDADE_KG} com praia e resíduo devia activar Guardar.`,
    );
  }
  console.log(`Validação: quantidade ${QUANTIDADE_KG} aceite.`);

  await guardar.click();
  await pausa(driver);

  await driver.wait(async () => {
    const modais = await driver.findElements(
      By.id("create-waste-collection-title"),
    );
    return modais.length === 0;
  }, 15000);

  console.log("Recolha submetida; modal fechado.");
}

async function verificarQuantidadeGuardada(driver) {
  const linha = await driver.wait(
    until.elementLocated(
      By.xpath(
        `//div[@id='campaign-panel-recolhas']//table//tr[.//td[normalize-space()=${JSON.stringify(RESIDUO_NOME)}] and .//td[normalize-space()=${JSON.stringify(QUANTIDADE_KG)}]]`,
      ),
    ),
    20000,
  );

  const celulas = await linha.findElements(By.css("td"));
  const quantidade = (await celulas[1].getText()).trim();
  if (quantidade !== QUANTIDADE_KG) {
    throw new Error(
      `Quantidade guardada incorrecta: esperado ${QUANTIDADE_KG}, obtido ${quantidade}.`,
    );
  }

  const pesoGramas = (await celulas[2].getText()).trim();
  console.log(
    `Recolha visível na tabela: ${RESIDUO_NOME} · ${quantidade} un. · Peso (g): ${pesoGramas}`,
  );
}

async function apagarRecolhaTeste(driver) {
  const botaoApagar = await driver.wait(
    until.elementLocated(
      By.xpath(
        `//div[@id='campaign-panel-recolhas']//tr[.//td[normalize-space()=${JSON.stringify(RESIDUO_NOME)}] and .//td[normalize-space()=${JSON.stringify(QUANTIDADE_KG)}]]//button[@aria-label='Apagar recolha']`,
      ),
    ),
    10000,
  );
  await pausa(driver, 600);
  await botaoApagar.click();
  await pausa(driver, 600);

  const confirmar = await driver.wait(
    until.elementLocated(
      By.xpath(
        "//div[@role='dialog'][.//*[@id='delete-waste-collection-title']]//button[normalize-space()='Apagar']",
      ),
    ),
    10000,
  );
  await confirmar.click();
  await pausa(driver);

  await driver.wait(async () => {
    const linhas = await driver.findElements(
      By.xpath(
        `//div[@id='campaign-panel-recolhas']//tr[.//td[normalize-space()=${JSON.stringify(RESIDUO_NOME)}] and .//td[normalize-space()=${JSON.stringify(QUANTIDADE_KG)}]]`,
      ),
    );
    return linhas.length === 0;
  }, 15000);

  console.log("Recolha de teste apagada (base de dados reposta para nova execução).");
}

async function main() {
  const driver = await criarDriver();

  try {
    console.log("=== RF11 ===");
    await executarPasso(driver, 1, "Login como administrador", "login", () => fazerLogin(driver));
    await executarPasso(driver, 2, "Abrir separador de recolhas", "recolhas_abertas", () => abrirRecolhasCampanha(driver));
    await executarPasso(driver, 3, "Abrir formulário de recolha", "formulario_aberto", () => abrirFormularioRecolha(driver));
    await executarPasso(driver, 4, "Preencher e registar 50 kg", "recolha_registada", () => preencherERegistarRecolha(driver));
    await executarPasso(driver, 5, "Confirmar quantidade guardada", "quantidade_confirmada", () => verificarQuantidadeGuardada(driver));
    await apagarRecolhaTeste(driver);

    console.log("=== Teste concluído com sucesso ===");
  } catch (erro) {
    console.error("=== Teste falhou ===");
    console.error(erro);
    try {
      await screenshotErro(driver);
    } catch (e) {
      console.error("Não foi possível guardar screenshot de erro:", e.message);
    }
    process.exitCode = 1;
  } finally {
    console.log(`Evidências em: evidencias/${TESTE_ID}/`);
    await pausa(driver, 2000);
    // await driver.quit();
  }
}

main().catch((erro) => {
  console.error("Erro ao executar o script:", erro);
  process.exit(1);
});
