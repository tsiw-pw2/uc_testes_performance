/**
 * RF07: Check-in do voluntário — marcar presença manualmente numa campanha.
 *
 * Resultado esperado: a presença passa a «Sim» na tabela de voluntários.
 *
 * Pré-requisitos:
 * - API Mariva a correr (http://127.0.0.1:3000)
 * - Frontend a correr (http://localhost:5173)
 * - Base de dados com seed: pnpm run db:seed (password Demo2026!)
 *
 * Executar: node "tests/RF07.js"
 */

const fs = require("fs");
const path = require("path");
const { By, until } = require("selenium-webdriver");
const { criarDriver } = require("../criar-driver");
const SEED = require("../test-seed");
const {
  abrirSeparadorVoluntarios,
  encontrarLinhaVoluntario,
  xpathLinhaPorEmail,
  aguardarListaVoluntarios,
  escolherOpcaoSelectModal,
  fecharDriver,
} = require("../test-campaign-voluntarios");

const BASE_URL = process.env.APP_URL || "http://localhost:5173";
const EMAIL = process.env.TEST_EMAIL || SEED.EMAIL;
const PASSWORD = process.env.TEST_PASSWORD || SEED.PASSWORD;

const CAMPAIGN_ID =
  process.env.CAMPAIGN_ID || SEED.CAMPAIGNS.inProgress.id;
const CAMPANHA_TITULO =
  process.env.CAMPAIGN_TITLE || SEED.CAMPAIGNS.inProgress.title;
const VOLUNTARIO_NOME =
  process.env.VOLUNTEER_NAME || SEED.USERS.volunteer2.name;
const VOLUNTARIO_EMAIL =
  process.env.VOLUNTEER_EMAIL || SEED.USERS.volunteer2.email;

const EVIDENCIAS_DIR = path.join(__dirname, "..", "..", "evidencias");
const TESTE_ID = "RF07";
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
  await driver.manage().deleteAllCookies();
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
    until.urlMatches(/\/(dashboard|campanhas|definicoes)/),
    20000,
  );
  await pausa(driver);
  console.log("Sessão iniciada com sucesso.");
}

async function aguardarCarregamento(driver) {
  await driver.wait(async () => {
    const loading = await driver.findElements(
      By.xpath("//*[contains(normalize-space(),'A carregar')]"),
    );
    return loading.length === 0;
  }, 20000);
}

function xpathLinhaVoluntarioAtual() {
  return xpathLinhaPorEmail(VOLUNTARIO_EMAIL);
}

async function abrirVoluntariosCampanha(driver) {
  await abrirSeparadorVoluntarios(driver, BASE_URL, CAMPAIGN_ID);

  await driver.wait(
    until.elementLocated(
      By.xpath(
        `//h2[contains(normalize-space(), ${JSON.stringify(CAMPANHA_TITULO.slice(0, 20))})]`,
      ),
    ),
    20000,
  );

  await encontrarLinhaVoluntario(driver, {
    email: VOLUNTARIO_EMAIL,
    nome: VOLUNTARIO_NOME,
  });
  await pausa(driver);
  console.log(`Voluntários da campanha abertos: ${CAMPAIGN_ID}`);
}

async function lerPresencaNaTabela(driver) {
  const { linha } = await encontrarLinhaVoluntario(driver, {
    email: VOLUNTARIO_EMAIL,
    nome: VOLUNTARIO_NOME,
  });
  const celulas = await linha.findElements(By.css("td"));
  return (await celulas[5].getText()).trim();
}

async function marcarPresencaManual(driver) {
  const presencaAntes = await lerPresencaNaTabela(driver);
  console.log(`Presença antes: ${presencaAntes || "(vazio)"}`);

  if (presencaAntes === "Sim") {
    console.log("Presença já estava confirmada; a saltar edição.");
    return;
  }

  const botaoGerir = await driver.wait(
    until.elementLocated(
      By.xpath(
        `${xpathLinhaVoluntarioAtual()}//button[@aria-label='Gerir inscrição']`,
      ),
    ),
    10000,
  );
  await pausa(driver, 600);
  await botaoGerir.click();

  await driver.wait(
    until.elementLocated(By.id("edit-registration-title")),
    10000,
  );
  await pausa(driver);

  await escolherOpcaoSelectModal(driver, "edit-reg-attendance", "Presente");

  const guardar = await driver.findElement(
    By.xpath(
      "//div[@role='dialog'][.//*[@id='edit-registration-title']]//button[normalize-space()='Guardar']",
    ),
  );
  await guardar.click();

  await driver.wait(async () => {
    const modais = await driver.findElements(By.id("edit-registration-title"));
    return modais.length === 0;
  }, 15000);

  await aguardarCarregamento(driver);
  await aguardarListaVoluntarios(driver);
  await pausa(driver);

  const presencaDepois = await lerPresencaNaTabela(driver);
  if (presencaDepois !== "Sim") {
    throw new Error(
      `Presença devia ser «Sim» após marcar manualmente; obtido: «${presencaDepois}».`,
    );
  }

  console.log(
    `Presença manual para ${VOLUNTARIO_NOME}: ${presencaAntes || "-"} → ${presencaDepois}.`,
  );
}

async function main() {
  const driver = await criarDriver();

  try {
    console.log("=== RF07 ===");
    await executarPasso(driver, 1, "Login como administrador", "login", () => fazerLogin(driver));
    await executarPasso(driver, 2, "Abrir separador de voluntários da campanha", "voluntarios_abertos", () => abrirVoluntariosCampanha(driver));
    await executarPasso(driver, 3, "Marcar presença manualmente", "presenca_marcada", () => marcarPresencaManual(driver));

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
    await fecharDriver(driver);
  }
}

main().catch((erro) => {
  console.error("Erro ao executar o script:", erro);
  process.exit(1);
});
